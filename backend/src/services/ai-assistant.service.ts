import prisma from "../config/database";
import { config } from "../config";

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIResponse {
  answer: string;
  context: string;
  confidence: number;
  sources: string[];
  suggestions?: string[];
}

// In-memory conversation store (per user, last 10 messages)
const conversationMemory: Map<string, ConversationMessage[]> = new Map();

class AIAssistantService {
  private readonly MAX_MEMORY = 10;

  // ============================================
  // MAIN CHAT METHOD
  // ============================================

  async chat(userId: string, message: string): Promise<AIResponse> {
    // 1. Get user context
    const userContext = await this.getUserContext(userId);

    // 2. Detect intent & gather relevant data
    const intent = this.detectIntent(message);
    const contextData = await this.gatherContextData(intent, userId, message);

    // 3. Get conversation history
    const history = this.getConversationHistory(userId);

    // 4. Build system prompt with real-time data
    const systemPrompt = this.buildSystemPrompt(userContext, contextData);

    // 5. Try AI response (OpenAI) or fallback to rule-based
    let response: AIResponse;

    if (config.openaiApiKey) {
      response = await this.getOpenAIResponse(systemPrompt, history, message, intent);
    } else {
      response = this.getRuleBasedResponse(intent, contextData, message);
    }

    // 6. Save to conversation memory
    this.addToMemory(userId, { role: "user", content: message });
    this.addToMemory(userId, { role: "assistant", content: response.answer });

    return response;
  }

  // ============================================
  // INTENT DETECTION
  // ============================================

  private detectIntent(message: string): string {
    const lower = message.toLowerCase();

    // Lab status
    if (lower.match(/status\s*(lab|pc|komputer)/)) return "lab_status";
    if (lower.match(/(berapa|jumlah)\s*(pc|komputer)\s*(rusak|mati|broken)/)) return "broken_pcs";
    if (lower.match(/(pc|komputer)\s*(yang\s*)?(online|nyala|aktif)/)) return "online_pcs";

    // Schedule
    if (lower.match(/jadwal\s*(hari ini|besok|minggu ini)/)) return "schedule_today";
    if (lower.match(/jadwal\s*(saya|ku|gue)/)) return "my_schedule";
    if (lower.match(/(lab\s*kosong|available|tersedia)/)) return "available_labs";

    // Tickets
    if (lower.match(/tiket\s*(saya|ku|gue|open|pending)/)) return "my_tickets";
    if (lower.match(/(tiket|kerusakan)\s*(terbanyak|paling|sering)/)) return "ticket_trends";
    if (lower.match(/(pc|komputer)\s*(paling\s*)?(sering\s*rusak|bermasalah)/)) return "problematic_pcs";

    // Attendance
    if (lower.match(/absen(si)?\s*(saya|ku|gue|hari ini)/)) return "my_attendance";
    if (lower.match(/(siapa|asleb)\s*(yang\s*)?(belum\s*absen|telat)/)) return "attendance_status";

    // Keys
    if (lower.match(/kunci\s*(status|siapa|dimana|available)/)) return "key_status";
    if (lower.match(/(siapa\s*pegang|pemegang)\s*kunci/)) return "key_holder";

    // Missions & Points
    if (lower.match(/misi\s*(tersedia|open|baru)/)) return "available_missions";
    if (lower.match(/(poin|point|ranking|leaderboard)\s*(saya|ku)?/)) return "my_points";

    // Logbook
    if (lower.match(/logbook\s*(hari ini|status|aktif)/)) return "logbook_status";

    // Reports & Analytics
    if (lower.match(/(laporan|report|statistik|analytics)/)) return "analytics";
    if (lower.match(/(trend|tren|pattern|pola)/)) return "trends";

    // Troubleshooting
    if (lower.match(/(cara|bagaimana|gimana)\s*(perbaiki|fix|atasi|solve)/)) return "troubleshoot";
    if (lower.match(/(error|masalah|problem|issue|bug)/)) return "troubleshoot";

    // Recommendations
    if (lower.match(/(saran|rekomendasi|suggest|recommend)/)) return "recommendation";

    // General
    if (lower.match(/(halo|hai|hi|hello|hey)/)) return "greeting";
    if (lower.match(/(terima\s*kasih|thanks|makasih)/)) return "thanks";

    return "general";
  }

  // ============================================
  // CONTEXT GATHERING
  // ============================================

  private async gatherContextData(intent: string, userId: string, _message: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    try {
      switch (intent) {
        case "lab_status":
        case "broken_pcs":
        case "online_pcs": {
          const labs = await prisma.lab.findMany({
            include: {
              pcs: { select: { id: true, status: true, isOnline: true, pcCode: true, name: true } },
            },
          });
          data.labs = labs.map((l) => ({
            name: l.name,
            status: l.status,
            totalPCs: l.pcs.length,
            online: l.pcs.filter((p) => p.isOnline).length,
            available: l.pcs.filter((p) => p.status === "AVAILABLE").length,
            broken: l.pcs.filter((p) => p.status === "BROKEN").length,
            maintenance: l.pcs.filter((p) => p.status === "MAINTENANCE").length,
            inUse: l.pcs.filter((p) => p.status === "IN_USE").length,
          }));
          if (intent === "broken_pcs") {
            data.brokenPCs = labs.flatMap((l) =>
              l.pcs.filter((p) => p.status === "BROKEN").map((p) => ({ ...p, labName: l.name }))
            );
          }
          break;
        }

        case "schedule_today":
        case "my_schedule":
        case "available_labs": {
          const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
          const today = days[new Date().getDay()] as any;
          const schedules = await prisma.schedule.findMany({
            where: {
              day: today,
              isActive: true,
              ...(intent === "my_schedule" ? { assistantId: userId } : {}),
            },
            include: {
              lab: { select: { name: true } },
              assistant: { select: { name: true } },
            },
            orderBy: { startTime: "asc" },
          });
          data.schedules = schedules;
          data.today = today;

          if (intent === "available_labs") {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            const busyLabIds = schedules
              .filter((s) => s.startTime <= currentTime && s.endTime >= currentTime)
              .map((s) => s.labId);
            const allLabs = await prisma.lab.findMany({ where: { status: "ACTIVE" } });
            data.availableLabs = allLabs.filter((l) => !busyLabIds.includes(l.id));
          }
          break;
        }

        case "my_tickets": {
          const tickets = await prisma.ticket.findMany({
            where: { OR: [{ reportedBy: userId }, { assignedTo: userId }] },
            include: { lab: { select: { name: true } }, pc: { select: { pcCode: true } } },
            orderBy: { createdAt: "desc" },
            take: 10,
          });
          data.tickets = tickets;
          break;
        }

        case "ticket_trends":
        case "problematic_pcs": {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const tickets = await prisma.ticket.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            include: { pc: { select: { pcCode: true, name: true } }, lab: { select: { name: true } } },
          });

          // Category breakdown
          const categoryCount: Record<string, number> = {};
          tickets.forEach((t) => {
            categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
          });
          data.ticketsByCategory = categoryCount;
          data.totalTickets30d = tickets.length;

          // Problematic PCs
          const pcCount: Record<string, { count: number; code: string; name: string }> = {};
          tickets.forEach((t) => {
            if (t.pc) {
              const key = t.pc.pcCode;
              if (!pcCount[key]) pcCount[key] = { count: 0, code: t.pc.pcCode, name: t.pc.name };
              pcCount[key].count++;
            }
          });
          data.problematicPCs = Object.values(pcCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          break;
        }

        case "my_attendance":
        case "attendance_status": {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          if (intent === "my_attendance") {
            const attendance = await prisma.attendance.findMany({
              where: { userId, createdAt: { gte: startOfMonth } },
              orderBy: { createdAt: "desc" },
            });
            data.attendance = attendance;
            data.stats = {
              total: attendance.length,
              present: attendance.filter((a) => ["CHECKED_IN", "CHECKED_OUT", "APPROVED", "WAITING_VERIFICATION"].includes(a.status)).length,
              late: attendance.filter((a) => a.status === "LATE").length,
              absent: attendance.filter((a) => a.status === "ABSENT").length,
            };
          } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayAttendance = await prisma.attendance.findMany({
              where: { createdAt: { gte: today } },
              include: { user: { select: { name: true } } },
            });
            const allAslab = await prisma.user.findMany({
              where: { role: "ASISTEN_LAB", isActive: true },
              select: { id: true, name: true },
            });
            const checkedInIds = todayAttendance.map((a) => a.userId);
            data.notCheckedIn = allAslab.filter((a) => !checkedInIds.includes(a.id));
            data.lateToday = todayAttendance.filter((a) => a.status === "LATE");
          }
          break;
        }

        case "key_status":
        case "key_holder": {
          const keys = await prisma.key.findMany({
            include: {
              lab: { select: { name: true } },
              currentHolder: { select: { name: true, role: true } },
            },
          });
          data.keys = keys;
          break;
        }

        case "available_missions": {
          const missions = await prisma.mission.findMany({
            where: { status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 5,
          });
          data.missions = missions;
          break;
        }

        case "my_points": {
          const points = await prisma.point.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 10,
          });
          const totalPoints = await prisma.point.aggregate({
            where: { userId },
            _sum: { amount: true },
          });
          data.recentPoints = points;
          data.totalPoints = totalPoints._sum.amount || 0;

          // Ranking
          const allPoints = await prisma.point.groupBy({
            by: ["userId"],
            _sum: { amount: true },
            orderBy: { _sum: { amount: "desc" } },
          });
          const rank = allPoints.findIndex((p) => p.userId === userId) + 1;
          data.rank = rank || "N/A";
          data.totalParticipants = allPoints.length;
          break;
        }

        case "logbook_status": {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const logbooks = await prisma.logbook.findMany({
            where: { createdAt: { gte: today } },
            include: {
              lab: { select: { name: true } },
              officialCheckinBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
          });
          data.logbooks = logbooks;
          break;
        }

        case "analytics":
        case "trends": {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const [ticketCount, logbookCount, attendanceCount, missionCount] = await Promise.all([
            prisma.ticket.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
            prisma.logbook.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
            prisma.attendance.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
            prisma.missionClaim.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: "APPROVED" } }),
          ]);

          data.monthly = { ticketCount, logbookCount, attendanceCount, missionCount };

          // Ticket trend by week
          const tickets = await prisma.ticket.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true, category: true },
          });
          const weeklyTickets: Record<string, number> = {};
          tickets.forEach((t) => {
            const week = `Week ${Math.ceil(((new Date().getTime() - t.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)}`;
            weeklyTickets[week] = (weeklyTickets[week] || 0) + 1;
          });
          data.weeklyTicketTrend = weeklyTickets;
          break;
        }

        case "troubleshoot": {
          // Get recent similar tickets for context
          const recentTickets = await prisma.ticket.findMany({
            where: { status: "RESOLVED" },
            orderBy: { resolvedAt: "desc" },
            take: 20,
            select: { category: true, title: true, description: true },
          });
          data.resolvedTickets = recentTickets;
          break;
        }

        case "recommendation": {
          // Get overall stats for recommendations
          const [pcStats, ticketStats] = await Promise.all([
            prisma.pC.groupBy({ by: ["status"], _count: true }),
            prisma.ticket.groupBy({ by: ["category"], _count: true, orderBy: { _count: { category: "desc" } } }),
          ]);
          data.pcStats = pcStats;
          data.topTicketCategories = ticketStats.slice(0, 3);
          break;
        }
      }
    } catch (error) {
      console.error("Error gathering context data:", error);
    }

    return data;
  }

  // ============================================
  // USER CONTEXT
  // ============================================

  private async getUserContext(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true, isKetuaKelas: true, className: true, semester: true },
    });
    return user;
  }

  // ============================================
  // SYSTEM PROMPT BUILDER
  // ============================================

  private buildSystemPrompt(userContext: any, contextData: Record<string, any>): string {
    const now = new Date();
    const timeStr = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    return `Kamu adalah AI Assistant untuk Labkom (Laboratorium Komputer) di kampus.
Nama kamu: Labkom AI Assistant.
Waktu sekarang: ${timeStr}

TENTANG USER:
- Nama: ${userContext?.name || "Unknown"}
- Role: ${userContext?.role || "Unknown"}
- ${userContext?.isKetuaKelas ? "Ketua Kelas" : ""}
- ${userContext?.className ? `Kelas: ${userContext.className}` : ""}

TENTANG LABKOM:
- 2 Lab: Lab Dasar (20 PC), Lab Multimedia (12 PC)
- Jam operasional: Senin-Jumat 07:30-21:00, Sabtu 08:00-17:00
- Fitur: Logbook digital, peminjaman kunci QR, ticketing kerusakan, absensi GPS, misi & poin, jadwal lab
- Roles: Koordinator Lab, Asisten Lab, Dosen, Mahasiswa

DATA REAL-TIME:
${JSON.stringify(contextData, null, 2)}

INSTRUKSI:
1. Jawab dalam Bahasa Indonesia yang natural dan ramah
2. Gunakan data real-time di atas untuk menjawab pertanyaan
3. Jika data menunjukkan masalah, berikan saran proaktif
4. Format jawaban dengan bullet points jika ada list
5. Jangan mengarang data — jika tidak ada data, bilang "data tidak tersedia"
6. Berikan saran actionable jika relevan
7. Jika pertanyaan di luar konteks lab, jawab sopan bahwa kamu fokus membantu urusan lab
8. Gunakan emoji secukupnya untuk membuat jawaban lebih friendly`;
  }

  // ============================================
  // OPENAI RESPONSE
  // ============================================

  private async getOpenAIResponse(
    systemPrompt: string,
    history: ConversationMessage[],
    message: string,
    intent: string
  ): Promise<AIResponse> {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        return this.getRuleBasedResponse(intent, {}, message);
      }

      const data = (await response.json()) as any;
      const answer = data.choices?.[0]?.message?.content;

      if (!answer) {
        return this.getRuleBasedResponse(intent, {}, message);
      }

      return {
        answer,
        context: intent,
        confidence: 0.9,
        sources: ["OpenAI GPT-4o-mini", "Real-time Lab Data"],
        suggestions: this.getSuggestions(intent),
      };
    } catch {
      return this.getRuleBasedResponse(intent, {}, message);
    }
  }

  // ============================================
  // RULE-BASED FALLBACK
  // ============================================

  private getRuleBasedResponse(intent: string, data: Record<string, any>, _message: string): AIResponse {
    let answer = "";
    const sources: string[] = ["Local Database"];

    switch (intent) {
      case "lab_status": {
        if (data.labs) {
          answer = "📊 **Status Lab Saat Ini:**\n\n";
          data.labs.forEach((lab: any) => {
            answer += `🏢 **${lab.name}** (${lab.status})\n`;
            answer += `  • Total PC: ${lab.totalPCs}\n`;
            answer += `  • Online: ${lab.online} | Available: ${lab.available}\n`;
            answer += `  • Broken: ${lab.broken} | Maintenance: ${lab.maintenance}\n\n`;
          });
        } else {
          answer = "Data status lab tidak tersedia saat ini.";
        }
        break;
      }

      case "broken_pcs": {
        if (data.brokenPCs?.length > 0) {
          answer = `⚠️ **PC Rusak (${data.brokenPCs.length} unit):**\n\n`;
          data.brokenPCs.forEach((pc: any) => {
            answer += `• ${pc.pcCode} (${pc.labName}) — ${pc.name}\n`;
          });
          answer += "\n💡 Gunakan menu Ticketing untuk melihat detail kerusakan.";
        } else {
          answer = "✅ Tidak ada PC yang berstatus rusak saat ini. Semua dalam kondisi baik!";
        }
        break;
      }

      case "online_pcs": {
        if (data.labs) {
          const totalOnline = data.labs.reduce((sum: number, l: any) => sum + l.online, 0);
          const totalPCs = data.labs.reduce((sum: number, l: any) => sum + l.totalPCs, 0);
          answer = `🖥️ **PC Online: ${totalOnline}/${totalPCs}**\n\n`;
          data.labs.forEach((lab: any) => {
            answer += `• ${lab.name}: ${lab.online}/${lab.totalPCs} online\n`;
          });
        } else {
          answer = "Data PC online tidak tersedia.";
        }
        break;
      }

      case "schedule_today": {
        if (data.schedules?.length > 0) {
          answer = `📅 **Jadwal Hari Ini (${data.today}):**\n\n`;
          data.schedules.forEach((s: any) => {
            answer += `• ${s.startTime} - ${s.endTime} | ${s.title}\n`;
            answer += `  📍 ${s.lab.name} | 👨‍🏫 ${s.lecturerName || "-"} | 🧑‍💻 ${s.assistant?.name || "-"}\n\n`;
          });
        } else {
          answer = `📅 Tidak ada jadwal hari ini (${data.today}). Lab tersedia untuk peminjaman!`;
        }
        break;
      }

      case "my_schedule": {
        if (data.schedules?.length > 0) {
          answer = "📅 **Jadwal Kamu Hari Ini:**\n\n";
          data.schedules.forEach((s: any) => {
            answer += `• ${s.startTime} - ${s.endTime} | ${s.title} @ ${s.lab.name}\n`;
          });
        } else {
          answer = "📅 Kamu tidak punya jadwal hari ini.";
        }
        break;
      }

      case "available_labs": {
        if (data.availableLabs?.length > 0) {
          answer = "✅ **Lab Tersedia Sekarang:**\n\n";
          data.availableLabs.forEach((l: any) => {
            answer += `• ${l.name} (Kapasitas: ${l.capacity})\n`;
          });
        } else {
          answer = "❌ Semua lab sedang digunakan saat ini.";
        }
        break;
      }

      case "my_tickets": {
        if (data.tickets?.length > 0) {
          answer = "🎫 **Tiket Terbaru Kamu:**\n\n";
          data.tickets.slice(0, 5).forEach((t: any) => {
            const statusEmoji = t.status === "RESOLVED" ? "✅" : t.status === "OPEN" ? "🔴" : "🟡";
            answer += `${statusEmoji} ${t.title} (${t.status})\n`;
            answer += `  📍 ${t.lab.name} ${t.pc ? `| 🖥️ ${t.pc.pcCode}` : ""}\n\n`;
          });
        } else {
          answer = "🎫 Kamu belum punya tiket.";
        }
        break;
      }

      case "ticket_trends": {
        if (data.ticketsByCategory) {
          answer = `📈 **Trend Tiket (30 hari terakhir): ${data.totalTickets30d} tiket**\n\n`;
          answer += "Kategori terbanyak:\n";
          Object.entries(data.ticketsByCategory)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .forEach(([cat, count]) => {
              answer += `• ${cat}: ${count} tiket\n`;
            });
        } else {
          answer = "Data trend tiket tidak tersedia.";
        }
        break;
      }

      case "problematic_pcs": {
        if (data.problematicPCs?.length > 0) {
          answer = "⚠️ **PC Paling Sering Bermasalah (30 hari):**\n\n";
          data.problematicPCs.forEach((pc: any, i: number) => {
            answer += `${i + 1}. ${pc.code} — ${pc.count} tiket\n`;
          });
          answer += "\n💡 Pertimbangkan maintenance preventif untuk PC-PC ini.";
        } else {
          answer = "✅ Tidak ada PC yang sering bermasalah dalam 30 hari terakhir.";
        }
        break;
      }

      case "my_attendance": {
        if (data.stats) {
          answer = "📋 **Absensi Bulan Ini:**\n\n";
          answer += `• Total: ${data.stats.total} hari\n`;
          answer += `• ✅ Hadir: ${data.stats.present}\n`;
          answer += `• ⏰ Terlambat: ${data.stats.late}\n`;
          answer += `• ❌ Absen: ${data.stats.absent}\n`;
        } else {
          answer = "Data absensi tidak tersedia.";
        }
        break;
      }

      case "attendance_status": {
        answer = "📋 **Status Absensi Hari Ini:**\n\n";
        if (data.notCheckedIn?.length > 0) {
          answer += "❌ Belum check-in:\n";
          data.notCheckedIn.forEach((u: any) => {
            answer += `• ${u.name}\n`;
          });
        }
        if (data.lateToday?.length > 0) {
          answer += "\n⏰ Terlambat:\n";
          data.lateToday.forEach((a: any) => {
            answer += `• ${a.user?.name || "Unknown"}\n`;
          });
        }
        if (!data.notCheckedIn?.length && !data.lateToday?.length) {
          answer += "✅ Semua asisten lab sudah check-in tepat waktu!";
        }
        break;
      }

      case "key_status": {
        if (data.keys) {
          answer = "🔑 **Status Kunci Lab:**\n\n";
          data.keys.forEach((k: any) => {
            const statusEmoji = k.status === "AVAILABLE" ? "✅" : k.status === "BORROWED" ? "🔴" : "⚠️";
            answer += `${statusEmoji} ${k.keyCode} (${k.lab.name}) — ${k.status}`;
            if (k.currentHolder) answer += ` | Dipegang: ${k.currentHolder.name}`;
            answer += "\n";
          });
        } else {
          answer = "Data kunci tidak tersedia.";
        }
        break;
      }

      case "key_holder": {
        if (data.keys) {
          const borrowed = data.keys.filter((k: any) => k.status === "BORROWED");
          if (borrowed.length > 0) {
            answer = "🔑 **Kunci Sedang Dipinjam:**\n\n";
            borrowed.forEach((k: any) => {
              answer += `• ${k.keyCode} (${k.lab.name}) → ${k.currentHolder?.name || "Unknown"}\n`;
            });
          } else {
            answer = "✅ Semua kunci tersedia (tidak ada yang dipinjam).";
          }
        } else {
          answer = "Data kunci tidak tersedia.";
        }
        break;
      }

      case "available_missions": {
        if (data.missions?.length > 0) {
          answer = "🎯 **Misi Tersedia:**\n\n";
          data.missions.forEach((m: any) => {
            answer += `• ${m.title} (${m.points} poin)\n`;
            if (m.deadline) answer += `  ⏰ Deadline: ${new Date(m.deadline).toLocaleDateString("id-ID")}\n`;
          });
        } else {
          answer = "🎯 Tidak ada misi yang tersedia saat ini.";
        }
        break;
      }

      case "my_points": {
        answer = `🏆 **Poin Kamu:**\n\n`;
        answer += `• Total: ${data.totalPoints || 0} poin\n`;
        answer += `• Ranking: #${data.rank} dari ${data.totalParticipants} peserta\n\n`;
        if (data.recentPoints?.length > 0) {
          answer += "Riwayat terakhir:\n";
          data.recentPoints.slice(0, 5).forEach((p: any) => {
            answer += `• +${p.amount} — ${p.reason}\n`;
          });
        }
        break;
      }

      case "logbook_status": {
        if (data.logbooks?.length > 0) {
          answer = "📖 **Logbook Hari Ini:**\n\n";
          data.logbooks.forEach((l: any) => {
            answer += `• ${l.lab.name} — ${l.status}\n`;
            if (l.officialCheckinBy) answer += `  Check-in oleh: ${l.officialCheckinBy.name}\n`;
          });
        } else {
          answer = "📖 Belum ada logbook hari ini.";
        }
        break;
      }

      case "analytics": {
        if (data.monthly) {
          answer = "📊 **Statistik 30 Hari Terakhir:**\n\n";
          answer += `• 🎫 Tiket: ${data.monthly.ticketCount}\n`;
          answer += `• 📖 Logbook: ${data.monthly.logbookCount}\n`;
          answer += `• 📋 Absensi: ${data.monthly.attendanceCount}\n`;
          answer += `• 🎯 Misi selesai: ${data.monthly.missionCount}\n`;
        } else {
          answer = "Data analytics tidak tersedia.";
        }
        break;
      }

      case "greeting":
        answer = "Halo! 👋 Saya Labkom AI Assistant. Saya bisa membantu kamu dengan:\n\n• 📊 Status lab & PC\n• 📅 Jadwal hari ini\n• 🎫 Info tiket kerusakan\n• 🔑 Status kunci\n• 📋 Absensi\n• 🎯 Misi & poin\n• 💡 Troubleshooting\n\nSilakan tanya apa saja!";
        break;

      case "thanks":
        answer = "Sama-sama! 😊 Jika ada pertanyaan lain, jangan ragu untuk bertanya.";
        break;

      default:
        answer = "Maaf, saya belum bisa memahami pertanyaan tersebut dengan baik. Coba tanyakan tentang:\n\n• Status lab/PC\n• Jadwal hari ini\n• Tiket kerusakan\n• Status kunci\n• Absensi\n• Misi & poin\n\nAtau jelaskan lebih detail apa yang kamu butuhkan.";
    }

    return {
      answer,
      context: intent,
      confidence: intent === "general" ? 0.3 : 0.7,
      sources,
      suggestions: this.getSuggestions(intent),
    };
  }

  // ============================================
  // SUGGESTIONS
  // ============================================

  private getSuggestions(intent: string): string[] {
    const suggestionMap: Record<string, string[]> = {
      lab_status: ["PC mana yang rusak?", "Lab mana yang kosong?", "Trend kerusakan bulan ini"],
      broken_pcs: ["Buat tiket untuk PC ini", "PC mana paling sering rusak?", "Status lab keseluruhan"],
      schedule_today: ["Lab mana yang kosong?", "Jadwal saya minggu ini", "Siapa yang bertugas?"],
      my_tickets: ["Trend kerusakan", "PC paling bermasalah", "Status tiket open"],
      ticket_trends: ["PC paling sering rusak", "Rekomendasi maintenance", "Laporan bulanan"],
      my_attendance: ["Ranking saya", "Misi tersedia", "Jadwal saya"],
      key_status: ["Siapa pegang kunci?", "Status logbook", "Jadwal hari ini"],
      greeting: ["Status lab sekarang", "Jadwal hari ini", "Ada misi baru?"],
      general: ["Status lab", "Jadwal hari ini", "PC yang rusak", "Poin saya"],
    };

    return suggestionMap[intent] || suggestionMap.general;
  }

  // ============================================
  // CONVERSATION MEMORY
  // ============================================

  private getConversationHistory(userId: string): ConversationMessage[] {
    return conversationMemory.get(userId) || [];
  }

  private addToMemory(userId: string, message: ConversationMessage) {
    const history = conversationMemory.get(userId) || [];
    history.push(message);
    if (history.length > this.MAX_MEMORY) {
      history.splice(0, history.length - this.MAX_MEMORY);
    }
    conversationMemory.set(userId, history);
  }

  clearMemory(userId: string) {
    conversationMemory.delete(userId);
  }

  // ============================================
  // PROACTIVE INSIGHTS
  // ============================================

  async getProactiveInsights(userId: string): Promise<string[]> {
    const insights: string[] = [];

    try {
      // Check for broken PCs
      const brokenCount = await prisma.pC.count({ where: { status: "BROKEN" } });
      if (brokenCount > 0) {
        insights.push(`⚠️ ${brokenCount} PC berstatus rusak — perlu ditangani`);
      }

      // Check unreturned keys
      const borrowedKeys = await prisma.key.count({ where: { status: "BORROWED" } });
      if (borrowedKeys > 0) {
        insights.push(`🔑 ${borrowedKeys} kunci masih dipinjam`);
      }

      // Check open tickets
      const openTickets = await prisma.ticket.count({ where: { status: "OPEN" } });
      if (openTickets > 3) {
        insights.push(`🎫 ${openTickets} tiket open — perlu di-assign`);
      }

      // Check today's schedule
      const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
      const today = days[new Date().getDay()] as any;
      const todaySchedules = await prisma.schedule.count({ where: { day: today, isActive: true } });
      insights.push(`📅 ${todaySchedules} jadwal hari ini`);

      // User-specific: unread notifications
      const unread = await prisma.notification.count({ where: { userId, isRead: false } });
      if (unread > 0) {
        insights.push(`🔔 ${unread} notifikasi belum dibaca`);
      }
    } catch (error) {
      console.error("Error getting proactive insights:", error);
    }

    return insights;
  }
}

export const aiAssistantService = new AIAssistantService();
