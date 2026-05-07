import prisma from "../config/database";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { CertificateType } from "@prisma/client";

export class CertificateService {
  static async generateMonthlyBest(month: string, issuedById: string) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    const topPoints = await prisma.point.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    });

    if (topPoints.length === 0) throw new Error("Tidak ada data poin untuk bulan ini");

    const winner = topPoints[0];
    const user = await prisma.user.findUnique({ where: { id: winner.userId } });
    if (!user) throw new Error("User tidak ditemukan");

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    const missionsCount = await prisma.missionClaim.count({
      where: { aslebId: winner.userId, status: "APPROVED", verifiedAt: { gte: start, lte: end } },
    });

    const certificate = await prisma.certificate.create({
      data: {
        userId: winner.userId,
        type: "MONTHLY_BEST",
        title: `Asisten Lab Terbaik — ${monthNames[m - 1]} ${year}`,
        description: `Penghargaan atas performa terbaik sebagai asisten laboratorium pada bulan ${monthNames[m - 1]} ${year}`,
        semester: month,
        totalPoints: winner._sum.amount || 0,
        missionsCompleted: missionsCount,
        issuedById,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return certificate;
  }

  static async generateAttendancePerfect(userId: string, month: string, issuedById: string) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    const lateOrAbsent = await prisma.attendance.count({
      where: { userId, createdAt: { gte: start, lte: end }, status: { in: ["LATE", "ABSENT"] } },
    });

    if (lateOrAbsent > 0) throw new Error("User memiliki keterlambatan/absen pada bulan ini");

    const totalPresent = await prisma.attendance.count({
      where: { userId, createdAt: { gte: start, lte: end }, status: { in: ["CHECKED_IN", "CHECKED_OUT", "APPROVED", "WAITING_VERIFICATION"] } },
    });

    if (totalPresent === 0) throw new Error("Tidak ada data kehadiran");

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    const certificate = await prisma.certificate.create({
      data: {
        userId,
        type: "ATTENDANCE_PERFECT",
        title: `Kehadiran Sempurna — ${monthNames[m - 1]} ${year}`,
        description: `Penghargaan atas kehadiran 100% tepat waktu selama bulan ${monthNames[m - 1]} ${year}`,
        semester: month,
        totalPoints: 0,
        missionsCompleted: 0,
        issuedById,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return certificate;
  }

  static async generateMissionMaster(userId: string, issuedById: string) {
    const missionsCount = await prisma.missionClaim.count({
      where: { aslebId: userId, status: "APPROVED" },
    });

    if (missionsCount < 10) throw new Error("User belum menyelesaikan minimal 10 misi");

    const totalPoints = await prisma.point.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const certificate = await prisma.certificate.create({
      data: {
        userId,
        type: "MISSION_MASTER",
        title: "Mission Master",
        description: `Penghargaan atas penyelesaian ${missionsCount} misi sebagai asisten laboratorium`,
        totalPoints: totalPoints._sum.amount || 0,
        missionsCompleted: missionsCount,
        issuedById,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return certificate;
  }

  static async generateSkillMaster(userId: string, issuedById: string) {
    const SKILL_MAP: Record<string, { category: string; minCount: number }> = {
      MAINTENANCE_PC: { category: "MAINTENANCE_PC", minCount: 5 },
      INSTALASI: { category: "INSTALASI", minCount: 5 },
      INVENTARIS: { category: "INVENTARIS", minCount: 3 },
      PENDAMPINGAN: { category: "PENDAMPINGAN", minCount: 5 },
      ADMINISTRASI: { category: "ADMINISTRASI", minCount: 3 },
    };

    const taskCounts = await prisma.dailyTaskLog.groupBy({
      by: ["category"],
      where: { userId, verified: true },
      _count: { id: true },
    });

    const earnedSkills: string[] = [];
    for (const tc of taskCounts) {
      const cat = tc.category as string;
      const mapping = SKILL_MAP[cat];
      if (mapping && tc._count.id >= mapping.minCount) {
        earnedSkills.push(cat);
      }
    }

    if (earnedSkills.length < 3) {
      throw new Error(`User baru menguasai ${earnedSkills.length} skill (minimal 3). Skills: ${earnedSkills.join(", ") || "belum ada"}`);
    }

    const totalVerifiedTasks = await prisma.dailyTaskLog.count({
      where: { userId, verified: true },
    });

    const totalPoints = await prisma.point.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const certificate = await prisma.certificate.create({
      data: {
        userId,
        type: "SKILL_MASTER",
        title: "Skill Master — Multi-Kompetensi Lab",
        description: `Penghargaan atas penguasaan ${earnedSkills.length} kompetensi: ${earnedSkills.join(", ")}. Total ${totalVerifiedTasks} tugas terverifikasi.`,
        totalPoints: totalPoints._sum.amount || 0,
        missionsCompleted: 0,
        skillsEarned: earnedSkills,
        issuedById,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return certificate;
  }

  static async getUserCertificates(userId: string) {
    return prisma.certificate.findMany({
      where: { userId },
      include: { issuedBy: { select: { id: true, name: true } } },
      orderBy: { issuedAt: "desc" },
    });
  }

  static async getAllCertificates() {
    return prisma.certificate.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        issuedBy: { select: { id: true, name: true } },
      },
      orderBy: { issuedAt: "desc" },
    });
  }

  static async generateCertificatePDF(certificateId: string): Promise<Buffer> {
    const cert = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: { select: { name: true, email: true, nim: true } },
        issuedBy: { select: { name: true } },
      },
    });

    if (!cert) throw new Error("Sertifikat tidak ditemukan");

    const template = await prisma.certificateTemplate.findFirst({
      where: { type: cert.type, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (template) {
      return this.generateWithTemplate(cert, template.imageUrl);
    }

    return this.generateDefaultPDF(cert);
  }

  private static async generateWithTemplate(
    cert: {
      type: CertificateType;
      title: string;
      description: string | null;
      totalPoints: number;
      missionsCompleted: number;
      issuedAt: Date;
      user: { name: string; email: string; nim: string | null };
      issuedBy: { name: string } | null;
    },
    imageUrl: string
  ): Promise<Buffer> {
    const imagePath = path.join(__dirname, "../../", imageUrl);

    if (!fs.existsSync(imagePath)) {
      return this.generateDefaultPDF(cert);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 0 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageW = doc.page.width;
      const pageH = doc.page.height;

      doc.image(imagePath, 0, 0, { width: pageW, height: pageH });

      const centerX = pageW / 2;

      doc.fontSize(24).font("Helvetica-Bold").fillColor("#1a1a1a");
      doc.text(cert.user.name, 0, pageH * 0.38, { align: "center", width: pageW });

      doc.fontSize(14).font("Helvetica").fillColor("#333333");
      doc.text(cert.title, 0, pageH * 0.50, { align: "center", width: pageW });

      const dateStr = cert.issuedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      doc.fontSize(11).font("Helvetica").fillColor("#555555");
      doc.text(dateStr, 0, pageH * 0.60, { align: "center", width: pageW });

      const typeLabels: Record<string, string> = {
        MONTHLY_BEST: "Asisten Lab Terbaik",
        ATTENDANCE_PERFECT: "Kehadiran Sempurna",
        MISSION_MASTER: "Mission Master",
        SKILL_MASTER: "Skill Master",
        SEMESTER_COMPLETION: "Semester Selesai",
      };
      doc.fontSize(10).font("Helvetica").fillColor("#4b607f");
      doc.text(typeLabels[cert.type] || cert.type, 0, pageH * 0.66, { align: "center", width: pageW });

      if (cert.issuedBy) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#1a1a1a");
        doc.text(cert.issuedBy.name, 0, pageH * 0.78, { align: "center", width: pageW });
        doc.fontSize(9).font("Helvetica").fillColor("#666666");
        doc.text("Koordinator Laboratorium", 0, pageH * 0.82, { align: "center", width: pageW });
      }

      doc.end();
    });
  }

  private static generateDefaultPDF(cert: {
    type: CertificateType;
    title: string;
    description: string | null;
    totalPoints: number;
    missionsCompleted: number;
    issuedAt: Date;
    user: { name: string; email: string; nim: string | null };
    issuedBy: { name: string } | null;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(3).stroke("#4b607f");
      doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(1).stroke("#f3701e");

      doc.moveDown(3);
      doc.fontSize(12).font("Helvetica").fillColor("#4b607f").text("LABKOM", { align: "center" });
      doc.fontSize(10).fillColor("#666666").text("Sistem Manajemen Laboratorium", { align: "center" });
      doc.moveDown(2);

      doc.fontSize(28).font("Helvetica-Bold").fillColor("#1a1a1a").text("SERTIFIKAT", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font("Helvetica").fillColor("#4b607f").text(cert.title, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12).font("Helvetica").fillColor("#333333").text("Diberikan kepada:", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a1a1a").text(cert.user.name, { align: "center" });
      if (cert.user.nim) {
        doc.fontSize(11).font("Helvetica").fillColor("#666666").text(`NIM: ${cert.user.nim}`, { align: "center" });
      }
      doc.moveDown(1.5);

      if (cert.description) {
        doc.fontSize(11).font("Helvetica").fillColor("#333333").text(cert.description, { align: "center", width: 500 });
        doc.moveDown(1);
      }

      const statsText = [];
      if (cert.totalPoints > 0) statsText.push(`Total Poin: ${cert.totalPoints}`);
      if (cert.missionsCompleted > 0) statsText.push(`Misi Selesai: ${cert.missionsCompleted}`);
      if (statsText.length > 0) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#f3701e").text(statsText.join("  |  "), { align: "center" });
        doc.moveDown(2);
      }

      doc.fontSize(10).font("Helvetica").fillColor("#666666").text(
        `Diterbitkan pada: ${cert.issuedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
        { align: "center" }
      );

      if (cert.issuedBy) {
        doc.moveDown(2);
        doc.fontSize(10).font("Helvetica").fillColor("#333333").text(cert.issuedBy.name, { align: "center" });
        doc.fontSize(9).fillColor("#666666").text("Koordinator Laboratorium", { align: "center" });
      }

      doc.end();
    });
  }

  static async getTemplates() {
    return prisma.certificateTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async createTemplate(name: string, type: string, imageUrl: string) {
    const validTypes: CertificateType[] = ["MONTHLY_BEST", "SEMESTER_COMPLETION", "MISSION_MASTER", "ATTENDANCE_PERFECT", "SKILL_MASTER"];
    if (!validTypes.includes(type as CertificateType)) {
      throw new Error(`Tipe sertifikat tidak valid. Pilih: ${validTypes.join(", ")}`);
    }

    return prisma.certificateTemplate.create({
      data: {
        name,
        type: type as CertificateType,
        imageUrl,
      },
    });
  }

  static async deleteTemplate(templateId: string) {
    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error("Template tidak ditemukan");

    const imagePath = path.join(__dirname, "../../", template.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    return prisma.certificateTemplate.delete({ where: { id: templateId } });
  }
}
