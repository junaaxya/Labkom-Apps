import * as path from "path";
import * as fs from "fs";
import * as QRCode from "qrcode";
import prisma from "../config/database";
import { sseManager } from "./sse.service";
import { faqBotService } from "./faq-bot.service";

let baileys: any = null;
async function loadBaileys() {
  if (!baileys) {
    baileys = await import("@whiskeysockets/baileys");
  }
  return baileys;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "qr_ready";

interface WAMessage {
  to: string;
  message: string;
}

class WhatsAppService {
  private socket: any = null;
  private status: ConnectionStatus = "disconnected";
  private qrCode: string | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private authDir: string;

  constructor() {
    this.authDir = path.join(process.cwd(), ".wa-auth");
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): { status: ConnectionStatus; qrCode: string | null } {
    return { status: this.status, qrCode: this.qrCode };
  }

  /**
   * Initialize WhatsApp connection
   */
  async connect(): Promise<void> {
    if (this.status === "connected" || this.status === "connecting") {
      console.log("[WhatsApp] Already connected or connecting");
      return;
    }

    this.status = "connecting";
    console.log("[WhatsApp] Initializing connection...");

    try {
      const wa = await loadBaileys();
      const { state, saveCreds } = await wa.useMultiFileAuthState(this.authDir);

      this.socket = wa.default({
        auth: {
          creds: state.creds,
          keys: wa.makeCacheableSignalKeyStore(state.keys, undefined as any),
        },
        printQRInTerminal: true,
        browser: ["Labkom Bot", "Chrome", "1.0.0"],
        generateHighQualityLinkPreview: false,
      });

      // Handle connection updates
      this.socket.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Generate QR code as data URL for frontend
          this.qrCode = await QRCode.toDataURL(qr);
          this.status = "qr_ready";
          console.log("[WhatsApp] QR Code ready — scan with WhatsApp");
          // Notify admin via SSE
          sseManager.sendToAll("whatsapp_qr", { qrCode: this.qrCode });
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== wa.DisconnectReason.loggedOut;

          console.log(`[WhatsApp] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

          this.status = "disconnected";
          this.qrCode = null;

          if (shouldReconnect && this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`[WhatsApp] Reconnecting... attempt ${this.retryCount}/${this.maxRetries}`);
            setTimeout(() => this.connect(), 3000 * this.retryCount);
          } else if (statusCode === wa.DisconnectReason.loggedOut) {
            // Clear auth state on logout
            console.log("[WhatsApp] Logged out. Clearing auth state...");
            this.clearAuth();
          }

          sseManager.sendToAll("whatsapp_status", { status: this.status });
        }

        if (connection === "open") {
          this.status = "connected";
          this.qrCode = null;
          this.retryCount = 0;
          console.log("[WhatsApp] Connected successfully!");
          sseManager.sendToAll("whatsapp_status", { status: "connected" });
        }
      });

      // Save credentials on update
      this.socket.ev.on("creds.update", saveCreds);

      // Handle incoming messages (for commands)
      this.socket.ev.on("messages.upsert", async ({ messages }: any) => {
        for (const msg of messages) {
          if (!msg.key.fromMe && msg.message) {
            await this.handleIncomingMessage(msg);
          }
        }
      });
    } catch (error) {
      console.error("[WhatsApp] Connection error:", error);
      this.status = "disconnected";
    }
  }

  /**
   * Disconnect WhatsApp
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.socket = null;
    }
    this.status = "disconnected";
    this.qrCode = null;
    console.log("[WhatsApp] Disconnected");
  }

  /**
   * Clear auth state (force re-scan QR)
   */
  clearAuth(): void {
    if (fs.existsSync(this.authDir)) {
      fs.rmSync(this.authDir, { recursive: true, force: true });
      fs.mkdirSync(this.authDir, { recursive: true });
    }
    this.status = "disconnected";
    this.qrCode = null;
  }

  /**
   * Send a text message
   */
  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.socket || this.status !== "connected") {
      console.warn("[WhatsApp] Cannot send — not connected");
      return false;
    }

    try {
      // Ensure phone format: 628xxx@s.whatsapp.net
      const jid = this.formatJid(to);
      await this.socket.sendMessage(jid, { text: message });
      return true;
    } catch (error) {
      console.error("[WhatsApp] Send message error:", error);
      return false;
    }
  }

  /**
   * Send message to a user by their userId (looks up phone from DB)
   */
  async sendToUser(userId: string, message: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, waNotify: true, name: true },
    });

    if (!user?.phone || !user.waNotify) {
      return false;
    }

    return this.sendMessage(user.phone, message);
  }

  /**
   * Send notification to user via WhatsApp
   */
  async sendNotification(userId: string, title: string, message: string): Promise<boolean> {
    const formattedMsg = `🔔 *${title}*\n\n${message}\n\n_— Labkom Bot_`;
    return this.sendToUser(userId, formattedMsg);
  }

  /**
   * Bulk send notifications
   */
  async sendBulkNotification(userIds: string[], title: string, message: string): Promise<void> {
    for (const userId of userIds) {
      await this.sendNotification(userId, title, message);
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Handle incoming messages (command handler)
   */
  private async handleIncomingMessage(msg: any): Promise<void> {
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      "";

    if (!text) return;

    const sender = msg.key?.remoteJid;
    if (!sender) return;

    const command = text.trim().toLowerCase();

    // Find user by phone number
    const phone = sender.replace("@s.whatsapp.net", "");
    const user = await prisma.user.findFirst({
      where: { phone },
      select: { id: true, name: true, role: true },
    });

    if (!user) {
      await this.socket?.sendMessage(sender, {
        text: "❌ Nomor Anda belum terdaftar di sistem Labkom.\nHubungi Koordinator Lab untuk mendaftarkan nomor WhatsApp Anda.",
      });
      return;
    }

    // Command routing
    switch (true) {
      case command === "/help" || command === "help" || command === "menu":
        await this.handleHelp(sender, user);
        break;

      case command === "/jadwal" || command === "jadwal":
        await this.handleJadwal(sender, user);
        break;

      case command === "/status" || command === "status":
        await this.handleStatus(sender, user);
        break;

      case command === "/absen" || command === "absen":
        await this.handleAbsen(sender, user);
        break;

      case command === "/kunci" || command === "kunci":
        await this.handleKunci(sender, user);
        break;

      case command === "/tiket" || command === "tiket":
        await this.handleTiket(sender, user);
        break;

      case command === "/misi" || command === "misi":
        await this.handleMisi(sender, user);
        break;

      case command === "/poin" || command === "poin":
        await this.handlePoin(sender, user);
        break;

      default:
        // Pass to FAQ handler
        await this.handleFAQ(sender, text, user);
        break;
    }
  }

  // ============================================
  // COMMAND HANDLERS
  // ============================================

  private async handleHelp(
    sender: string,
    user: { name: string; role: string }
  ): Promise<void> {
    let menu = `👋 Halo *${user.name}*!\n\n`;
    menu += `📋 *Menu Labkom Bot*\n\n`;
    menu += `📅 /jadwal — Lihat jadwal hari ini\n`;
    menu += `📊 /status — Status lab saat ini\n`;

    if (user.role === "ASISTEN_LAB") {
      menu += `✅ /absen — Status absensi hari ini\n`;
      menu += `🎯 /misi — Misi yang tersedia\n`;
      menu += `⭐ /poin — Poin & ranking Anda\n`;
    }

    if (user.role === "KOORDINATOR_LAB" || user.role === "ASISTEN_LAB") {
      menu += `🔑 /kunci — Status kunci lab\n`;
      menu += `🎫 /tiket — Tiket terbuka\n`;
    }

    menu += `\n💬 Atau ketik pertanyaan apapun tentang lab!`;

    await this.socket?.sendMessage(sender, { text: menu });
  }

  private async handleJadwal(
    sender: string,
    user: { id: string; role: string }
  ): Promise<void> {
    const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const today = days[new Date().getDay()] as any;

    const schedules = await prisma.schedule.findMany({
      where: { day: today, status: "SCHEDULED" },
      include: { lab: true, assistant: true },
      orderBy: { startTime: "asc" },
    });

    if (schedules.length === 0) {
      await this.socket?.sendMessage(sender, {
        text: `📅 *Jadwal Hari Ini (${today})*\n\nTidak ada jadwal hari ini. 🎉`,
      });
      return;
    }

    let msg = `📅 *Jadwal Hari Ini (${today})*\n\n`;
    for (const s of schedules) {
      msg += `🕐 ${s.startTime} - ${s.endTime}\n`;
      msg += `📍 ${s.lab.name}\n`;
      msg += `📚 ${s.title}\n`;
      if (s.lecturerName) msg += `👨‍🏫 ${s.lecturerName}\n`;
      if (s.assistant) msg += `🧑‍💻 ${s.assistant.name}\n`;
      msg += `\n`;
    }

    await this.socket?.sendMessage(sender, { text: msg });
  }

  private async handleStatus(
    sender: string,
    _user: { id: string }
  ): Promise<void> {
    const labs = await prisma.lab.findMany({
      where: { status: "ACTIVE" },
      include: {
        pcs: { select: { status: true } },
        keys: { select: { status: true } },
      },
    });

    let msg = `🏢 *Status Lab Saat Ini*\n\n`;
    for (const lab of labs) {
      const totalPCs = lab.pcs.length;
      const available = lab.pcs.filter((p) => p.status === "AVAILABLE").length;
      const broken = lab.pcs.filter((p) => p.status === "BROKEN").length;
      const keyStatus = lab.keys.find((k) => true)?.status || "N/A";

      msg += `📍 *${lab.name}*\n`;
      msg += `   💻 PC: ${available}/${totalPCs} tersedia`;
      if (broken > 0) msg += ` (${broken} rusak)`;
      msg += `\n`;
      msg += `   🔑 Kunci: ${keyStatus === "AVAILABLE" ? "✅ Tersedia" : "🔒 Dipinjam"}\n\n`;
    }

    await this.socket?.sendMessage(sender, { text: msg });
  }

  private async handleAbsen(
    sender: string,
    user: { id: string; role: string }
  ): Promise<void> {
    if (user.role !== "ASISTEN_LAB") {
      await this.socket?.sendMessage(sender, {
        text: "❌ Fitur absensi hanya untuk Asisten Lab.",
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: today },
      },
    });

    if (!attendance) {
      await this.socket?.sendMessage(sender, {
        text: `✅ *Status Absensi Hari Ini*\n\n⚠️ Anda belum check-in hari ini.\nSilakan buka aplikasi Labkom untuk absen.`,
      });
    } else {
      const status = attendance.status === "LATE"
        ? "⚠️ Terlambat"
        : ["CHECKED_IN", "CHECKED_OUT", "APPROVED", "WAITING_VERIFICATION"].includes(attendance.status)
          ? "✅ Hadir"
          : attendance.status;
      await this.socket?.sendMessage(sender, {
        text: `✅ *Status Absensi Hari Ini*\n\nStatus: ${status}\nCheck-in: ${attendance.checkinAt ? new Date(attendance.checkinAt).toLocaleTimeString("id-ID") : "-"}\nCheck-out: ${attendance.checkoutAt ? new Date(attendance.checkoutAt).toLocaleTimeString("id-ID") : "Belum"}`,
      });
    }
  }

  private async handleKunci(
    sender: string,
    user: { id: string; role: string }
  ): Promise<void> {
    const keys = await prisma.key.findMany({
      include: {
        lab: true,
        currentHolder: { select: { name: true } },
      },
    });

    let msg = `🔑 *Status Kunci Lab*\n\n`;
    for (const key of keys) {
      const icon = key.status === "AVAILABLE" ? "✅" : "🔒";
      msg += `${icon} *${key.keyCode}* — ${key.lab.name}\n`;
      if (key.currentHolder) {
        msg += `   Dipinjam oleh: ${key.currentHolder.name}\n`;
      }
      msg += `\n`;
    }

    await this.socket?.sendMessage(sender, { text: msg });
  }

  private async handleTiket(
    sender: string,
    _user: { id: string }
  ): Promise<void> {
    const openTickets = await prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: { lab: true, pc: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (openTickets.length === 0) {
      await this.socket?.sendMessage(sender, {
        text: `🎫 *Tiket Terbuka*\n\nTidak ada tiket terbuka saat ini. 👍`,
      });
      return;
    }

    let msg = `🎫 *Tiket Terbuka (${openTickets.length})*\n\n`;
    for (const t of openTickets) {
      const priority = t.priority === "CRITICAL" ? "🔴" : t.priority === "HIGH" ? "🟠" : t.priority === "MEDIUM" ? "🟡" : "🟢";
      msg += `${priority} *${t.title}*\n`;
      msg += `   📍 ${t.lab.name} | ${t.pc?.pcCode || "Umum"}\n`;
      msg += `   Status: ${t.status}\n\n`;
    }

    await this.socket?.sendMessage(sender, { text: msg });
  }

  private async handleMisi(
    sender: string,
    user: { id: string; role: string }
  ): Promise<void> {
    if (user.role !== "ASISTEN_LAB") {
      await this.socket?.sendMessage(sender, {
        text: "❌ Fitur misi hanya untuk Asisten Lab.",
      });
      return;
    }

    const openMissions = await prisma.mission.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (openMissions.length === 0) {
      await this.socket?.sendMessage(sender, {
        text: `🎯 *Misi Tersedia*\n\nTidak ada misi terbuka saat ini.`,
      });
      return;
    }

    let msg = `🎯 *Misi Tersedia (${openMissions.length})*\n\n`;
    for (const m of openMissions) {
      msg += `⭐ *${m.title}* (+${m.points} poin)\n`;
      msg += `   ${m.description?.substring(0, 50) || ""}...\n`;
      msg += `   Deadline: ${m.deadline ? new Date(m.deadline).toLocaleDateString("id-ID") : "Tidak ada"}\n\n`;
    }
    msg += `\nBuka aplikasi Labkom untuk claim misi.`;

    await this.socket?.sendMessage(sender, { text: msg });
  }

  private async handlePoin(
    sender: string,
    user: { id: string; role: string }
  ): Promise<void> {
    if (user.role !== "ASISTEN_LAB") {
      await this.socket?.sendMessage(sender, {
        text: "❌ Fitur poin hanya untuk Asisten Lab.",
      });
      return;
    }

    const totalPoints = await prisma.point.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });

    const missionsCompleted = await prisma.missionClaim.count({
      where: { userId: user.id, status: "APPROVED" },
    });

    // Get rank
    const allPoints = await prisma.point.groupBy({
      by: ["userId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    const rank = allPoints.findIndex((p) => p.userId === user.id) + 1;

    await this.socket?.sendMessage(sender, {
      text: `⭐ *Statistik Poin Anda*\n\n🏆 Total Poin: *${totalPoints._sum.amount || 0}*\n📊 Ranking: #${rank || "N/A"}\n✅ Misi Selesai: ${missionsCompleted}\n\nTerus semangat! 💪`,
    });
  }

  private async handleFAQ(
    sender: string,
    text: string,
    _user: { id: string; name: string }
  ): Promise<void> {
    const result = await faqBotService.getAnswer(text);

    if (result && result.confidence > 0) {
      const source = result.category === "AI" ? "\n\n_🤖 Dijawab oleh AI_" : "";
      await this.socket?.sendMessage(sender, { text: result.answer + source });
    } else {
      await this.socket?.sendMessage(sender, {
        text: `🤖 Maaf, saya belum bisa menjawab pertanyaan itu.\n\nKetik */help* untuk melihat menu yang tersedia.\nAtau hubungi Asisten Lab untuk bantuan lebih lanjut.`,
      });
    }
  }

  // ============================================
  // UTILITY
  // ============================================

  /**
   * Format phone number to WhatsApp JID
   */
  private formatJid(phone: string): string {
    // Remove non-numeric characters
    let cleaned = phone.replace(/\D/g, "");

    // Convert 08xxx to 628xxx
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.substring(1);
    }

    // Add @s.whatsapp.net suffix
    if (!cleaned.includes("@")) {
      cleaned = cleaned + "@s.whatsapp.net";
    }

    return cleaned;
  }
}

export const whatsappService = new WhatsAppService();
