import * as QRCode from "qrcode";
import prisma from "../config/database";
import { config } from "../config";

export class QRService {
  private static getAppUrl(): string {
    return config.appUrl;
  }

  // ============================================
  // ASSET CODE GENERATION
  // ============================================

  /**
   * Generate asset code for a PC based on lab prefix and sequence number
   * Format: ASSET-{LAB_PREFIX}-PC-{NUMBER}
   * Example: ASSET-LABD-PC-001, ASSET-LABM-PC-012
   */
  static async generateAssetCode(pcId: string): Promise<string> {
    const pc = await prisma.pC.findUnique({
      where: { id: pcId },
      include: { lab: true },
    });
    if (!pc) throw new Error("PC tidak ditemukan");

    const labPrefix = this.deriveLabPrefix(pc.lab.name, pc.pcCode);

    const existingPCs = await prisma.pC.findMany({
      where: { labId: pc.labId },
      orderBy: { pcCode: "asc" },
      select: { id: true, pcCode: true },
    });

    const index = existingPCs.findIndex((p) => p.id === pcId);
    const seqNum = String(index + 1).padStart(3, "0");

    const assetCode = `ASSET-${labPrefix}-PC-${seqNum}`;
    return assetCode;
  }

  /**
   * Bulk generate asset codes for all PCs in a lab
   */
  static async bulkGenerateAssetCodes(labId: string): Promise<{ pcId: string; assetCode: string }[]> {
    const lab = await prisma.lab.findUnique({ where: { id: labId } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    const pcs = await prisma.pC.findMany({
      where: { labId },
      orderBy: { pcCode: "asc" },
      select: { id: true, pcCode: true },
    });

    const labPrefix = this.deriveLabPrefix(lab.name, pcs[0]?.pcCode || "");
    const results: { pcId: string; assetCode: string }[] = [];

    for (let i = 0; i < pcs.length; i++) {
      const seqNum = String(i + 1).padStart(3, "0");
      const assetCode = `ASSET-${labPrefix}-PC-${seqNum}`;

      await prisma.pC.update({
        where: { id: pcs[i].id },
        data: { assetCode },
      });

      results.push({ pcId: pcs[i].id, assetCode });
    }

    return results;
  }

  // ============================================
  // QR URL GENERATION
  // ============================================

  /**
   * Generate QR URL for a key
   * Format: ${APP_URL}/scan/key/KEY-LABD-001
   */
  static getKeyQRUrl(keyCode: string): string {
    return `${this.getAppUrl()}/scan/key/${keyCode}`;
  }

  /**
   * Generate QR URL for a PC
   * Format: ${APP_URL}/scan/pc/ASSET-LABD-PC-001
   */
  static getPCQRUrl(assetCode: string): string {
    return `${this.getAppUrl()}/scan/pc/${assetCode}`;
  }

  // ============================================
  // QR IMAGE GENERATION
  // ============================================

  /**
   * Generate QR code as PNG data URL
   */
  static async generateQRDataUrl(content: string, size: number = 400): Promise<string> {
    return QRCode.toDataURL(content, {
      width: size,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }

  /**
   * Generate QR code as PNG buffer
   */
  static async generateQRBuffer(content: string, size: number = 400): Promise<Buffer> {
    return QRCode.toBuffer(content, {
      width: size,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }

  /**
   * Generate QR code as SVG string
   */
  static async generateQRSvg(content: string): Promise<string> {
    return QRCode.toString(content, {
      type: "svg",
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  }

  // ============================================
  // KEY QR OPERATIONS
  // ============================================

  /**
   * Generate and store QR URL for a key
   */
  static async generateKeyQR(keyId: string): Promise<{ keyCode: string; qrUrl: string; qrImage: string }> {
    const key = await prisma.key.findUnique({ where: { id: keyId } });
    if (!key) throw new Error("Kunci tidak ditemukan");

    const qrUrl = this.getKeyQRUrl(key.keyCode);
    const qrImage = await this.generateQRDataUrl(qrUrl);

    await prisma.key.update({
      where: { id: keyId },
      data: { qrCode: qrUrl },
    });

    return { keyCode: key.keyCode, qrUrl, qrImage };
  }

  static async getKeyQRImage(keyId: string): Promise<{ keyCode: string; qrUrl: string; qrImage: string }> {
    const key = await prisma.key.findUnique({
      where: { id: keyId },
      include: { lab: { select: { name: true } } },
    });
    if (!key) throw new Error("Kunci tidak ditemukan");

    const qrUrl = this.getKeyQRUrl(key.keyCode);

    if (key.qrCode !== qrUrl) {
      await prisma.key.update({
        where: { id: keyId },
        data: { qrCode: qrUrl },
      });
    }

    const qrImage = await this.generateQRDataUrl(qrUrl);
    return { keyCode: key.keyCode, qrUrl, qrImage };
  }

  /**
   * Bulk generate QR for all keys
   */
  static async bulkGenerateKeyQR(): Promise<{ keyCode: string; qrUrl: string; qrImage: string }[]> {
    const keys = await prisma.key.findMany({ orderBy: { keyCode: "asc" } });
    const results: { keyCode: string; qrUrl: string; qrImage: string }[] = [];

    for (const key of keys) {
      const qrUrl = this.getKeyQRUrl(key.keyCode);
      const qrImage = await this.generateQRDataUrl(qrUrl);

      await prisma.key.update({
        where: { id: key.id },
        data: { qrCode: qrUrl },
      });

      results.push({ keyCode: key.keyCode, qrUrl, qrImage });
    }

    return results;
  }

  // ============================================
  // PC QR OPERATIONS
  // ============================================

  /**
   * Generate and store QR URL for a PC (generates assetCode if missing)
   */
  static async generatePCQR(pcId: string): Promise<{ pcCode: string; assetCode: string; qrUrl: string; qrImage: string }> {
    let pc = await prisma.pC.findUnique({
      where: { id: pcId },
      include: { lab: true },
    });
    if (!pc) throw new Error("PC tidak ditemukan");

    let assetCode = pc.assetCode;
    if (!assetCode) {
      assetCode = await this.generateAssetCode(pcId);
      await prisma.pC.update({
        where: { id: pcId },
        data: { assetCode },
      });
    }

    const qrUrl = this.getPCQRUrl(assetCode);
    const qrImage = await this.generateQRDataUrl(qrUrl);

    await prisma.pC.update({
      where: { id: pcId },
      data: { qrCode: qrUrl },
    });

    return { pcCode: pc.pcCode, assetCode, qrUrl, qrImage };
  }

  static async getPCQRImage(pcId: string): Promise<{ pcCode: string; assetCode: string; qrUrl: string; qrImage: string }> {
    const pc = await prisma.pC.findUnique({ where: { id: pcId } });
    if (!pc) throw new Error("PC tidak ditemukan");

    if (!pc.assetCode) {
      return this.generatePCQR(pcId);
    }

    const qrUrl = this.getPCQRUrl(pc.assetCode);
    const qrImage = await this.generateQRDataUrl(qrUrl);

    return { pcCode: pc.pcCode, assetCode: pc.assetCode, qrUrl, qrImage };
  }

  /**
   * Bulk generate QR for all PCs in a lab
   */
  static async bulkGeneratePCQR(labId: string): Promise<{ pcCode: string; assetCode: string; qrUrl: string; qrImage: string }[]> {
    await this.bulkGenerateAssetCodes(labId);

    const pcs = await prisma.pC.findMany({
      where: { labId },
      orderBy: { pcCode: "asc" },
    });

    const results: { pcCode: string; assetCode: string; qrUrl: string; qrImage: string }[] = [];

    for (const pc of pcs) {
      const assetCode = pc.assetCode!;
      const qrUrl = this.getPCQRUrl(assetCode);
      const qrImage = await this.generateQRDataUrl(qrUrl);

      await prisma.pC.update({
        where: { id: pc.id },
        data: { qrCode: qrUrl },
      });

      results.push({ pcCode: pc.pcCode, assetCode, qrUrl, qrImage });
    }

    return results;
  }

  // ============================================
  // SCAN / LOOKUP
  // ============================================

  /**
   * Find key by keyCode (from scanned QR URL)
   */
  static async findKeyByCode(keyCode: string) {
    const key = await prisma.key.findFirst({
      where: { keyCode },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        currentHolder: { select: { id: true, name: true, email: true } },
        keyLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    if (!key) throw new Error("Kunci tidak ditemukan");

    const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const now = new Date();
    const today = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const todaySchedules = await prisma.schedule.findMany({
      where: {
        labId: key.labId,
        day: today as never,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        semester: true,
        className: true,
        lecturerName: true,
        type: true,
      },
      orderBy: { startTime: "asc" },
    });

    const activeSchedule = todaySchedules.find((s) => {
      return currentTime >= s.startTime && currentTime <= s.endTime;
    });

    return { ...key, todaySchedules, activeSchedule: activeSchedule || null, currentTime };
  }

  /**
   * Find PC by assetCode (from scanned QR URL)
   */
  static async findPCByAssetCode(assetCode: string) {
    const pc = await prisma.pC.findFirst({
      where: { assetCode },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        tickets: {
          where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, status: true, category: true, createdAt: true },
        },
      },
    });
    if (!pc) throw new Error("PC tidak ditemukan. Asset code tidak valid.");
    return pc;
  }

  // ============================================
  // PRINT SHEET (HTML for printing)
  // ============================================

  /**
   * Generate printable HTML sheet with all QR codes for a lab
   */
  static async generatePrintSheet(labId: string, type: "pc" | "key" | "all"): Promise<string> {
    const lab = await prisma.lab.findUnique({ where: { id: labId } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    const items: { code: string; label: string; qrImage: string }[] = [];

    if (type === "pc" || type === "all") {
      const pcs = await prisma.pC.findMany({
        where: { labId },
        orderBy: { pcCode: "asc" },
      });

      for (const pc of pcs) {
        let assetCode = pc.assetCode;
        if (!assetCode) {
          assetCode = await this.generateAssetCode(pc.id);
          await prisma.pC.update({ where: { id: pc.id }, data: { assetCode } });
        }
        const qrUrl = this.getPCQRUrl(assetCode);
        const qrImage = await this.generateQRDataUrl(qrUrl, 200);
        items.push({ code: assetCode, label: `${pc.name} (${pc.pcCode})`, qrImage });
      }
    }

    if (type === "key" || type === "all") {
      const keys = await prisma.key.findMany({
        where: { labId },
        orderBy: { keyCode: "asc" },
      });

      for (const key of keys) {
        const qrUrl = this.getKeyQRUrl(key.keyCode);
        const qrImage = await this.generateQRDataUrl(qrUrl, 200);
        items.push({ code: key.keyCode, label: `Kunci ${lab.name}`, qrImage });
      }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>QR Codes - ${lab.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; padding: 20px; }
    h1 { text-align: center; margin-bottom: 20px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .item { border: 2px solid #1a1a1a; border-radius: 8px; padding: 12px; text-align: center; page-break-inside: avoid; }
    .item img { width: 150px; height: 150px; margin: 0 auto 8px; display: block; }
    .item .code { font-size: 10px; font-weight: 700; color: #1a1a1a; word-break: break-all; }
    .item .label { font-size: 9px; color: #666; margin-top: 4px; }
    @media print {
      .grid { grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .item { border-width: 1px; padding: 8px; }
      .item img { width: 120px; height: 120px; }
    }
  </style>
</head>
<body>
  <h1>QR Codes — ${lab.name}</h1>
  <div class="grid">
    ${items.map((item) => `
    <div class="item">
      <img src="${item.qrImage}" alt="${item.code}" />
      <div class="code">${item.code}</div>
      <div class="label">${item.label}</div>
    </div>`).join("")}
  </div>
</body>
</html>`;

    return html;
  }

  // ============================================
  // HELPERS
  // ============================================

  private static deriveLabPrefix(labName: string, pcCode: string): string {
    const match = pcCode.match(/^([A-Z]+)-/);
    if (match) return match[1];

    const name = labName.toLowerCase();
    if (name.includes("dasar")) return "LABD";
    if (name.includes("multimedia")) return "LABM";
    if (name.includes("jaringan")) return "LABJ";
    if (name.includes("keamanan")) return "LABK";

    return labName.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase();
  }
}
