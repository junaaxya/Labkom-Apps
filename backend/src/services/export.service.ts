import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { ReportService } from "./report.service";
import { LeaderboardService } from "./leaderboard.service";

export class ExportService {
  static async generateMonthlyExcel(monthStr: string): Promise<Buffer> {
    const report = await ReportService.getMonthlyReport(monthStr);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Labkom";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet("Ringkasan");
    summarySheet.columns = [
      { header: "Metrik", key: "metric", width: 30 },
      { header: "Nilai", key: "value", width: 20 },
    ];

    summarySheet.addRows([
      { metric: "Total Sesi Logbook", value: report.summary.logbooks.total },
      { metric: "Sesi Selesai", value: report.summary.logbooks.completed },
      { metric: "Total Tiket", value: report.summary.tickets.total },
      { metric: "Tiket Resolved", value: report.summary.tickets.resolved },
      { metric: "Total Kehadiran", value: report.summary.attendance.total },
      { metric: "Kehadiran Terlambat", value: report.summary.attendance.late },
      { metric: "Total Misi", value: report.summary.missions.total },
      { metric: "Misi Disetujui", value: report.summary.missions.approved },
    ]);

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4B607F" },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    const labSheet = workbook.addWorksheet("Penggunaan Lab");
    labSheet.columns = [
      { header: "Lab", key: "labName", width: 25 },
      { header: "Total Sesi", key: "sessions", width: 15 },
    ];

    if (report.labUsage) {
      report.labUsage.forEach((lab: any) => {
        labSheet.addRow({ labName: lab.labName, sessions: lab.count });
      });
    }
    labSheet.getRow(1).font = { bold: true };

    const ticketSheet = workbook.addWorksheet("Kategori Tiket");
    ticketSheet.columns = [
      { header: "Kategori", key: "category", width: 20 },
      { header: "Jumlah", key: "count", width: 15 },
    ];

    if (report.ticketsByCategory) {
      report.ticketsByCategory.forEach((cat: any) => {
        ticketSheet.addRow({ category: cat.category, count: cat.count });
      });
    }
    ticketSheet.getRow(1).font = { bold: true };

    const assistantSheet = workbook.addWorksheet("Top Asisten");
    assistantSheet.columns = [
      { header: "Nama", key: "name", width: 25 },
      { header: "Poin", key: "points", width: 15 },
    ];

    if (report.topAssistants) {
      report.topAssistants.forEach((a: any) => {
        assistantSheet.addRow({ name: a.name, points: a.points });
      });
    }
    assistantSheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  static async generateMonthlyPDF(monthStr: string): Promise<Buffer> {
    const report = await ReportService.getMonthlyReport(monthStr);
    const [year, month] = monthStr.split("-").map(Number);
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).font("Helvetica-Bold").text("LAPORAN BULANAN LABORATORIUM", { align: "center" });
      doc.fontSize(14).font("Helvetica").text(`${monthNames[month - 1]} ${year}`, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).text("Labkom - Sistem Manajemen Laboratorium", { align: "center" });
      doc.moveDown(2);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold").text("1. Ringkasan");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");

      const summaryData = [
        ["Total Sesi Logbook", String(report.summary.logbooks.total)],
        ["Sesi Selesai", String(report.summary.logbooks.completed)],
        ["Total Tiket Kerusakan", String(report.summary.tickets.total)],
        ["Tiket Resolved", String(report.summary.tickets.resolved)],
        ["Total Kehadiran Asleb", String(report.summary.attendance.total)],
        ["Kehadiran Terlambat", String(report.summary.attendance.late)],
        ["Total Misi", String(report.summary.missions.total)],
        ["Misi Disetujui", String(report.summary.missions.approved)],
      ];

      summaryData.forEach(([label, value]) => {
        doc.text(`  ${label}: ${value}`);
      });

      doc.moveDown(1.5);
      doc.fontSize(14).font("Helvetica-Bold").text("2. Penggunaan Lab");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");

      if (report.labUsage && report.labUsage.length > 0) {
        report.labUsage.forEach((lab: any) => {
          doc.text(`  ${lab.labName}: ${lab.count} sesi`);
        });
      } else {
        doc.text("  Tidak ada data");
      }

      doc.moveDown(1.5);
      doc.fontSize(14).font("Helvetica-Bold").text("3. Kategori Tiket Kerusakan");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");

      if (report.ticketsByCategory && report.ticketsByCategory.length > 0) {
        report.ticketsByCategory.forEach((cat: any) => {
          doc.text(`  ${cat.category}: ${cat.count} tiket`);
        });
      } else {
        doc.text("  Tidak ada data");
      }

      doc.moveDown(1.5);
      doc.fontSize(14).font("Helvetica-Bold").text("4. Top 5 Asisten Lab");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");

      if (report.topAssistants && report.topAssistants.length > 0) {
        report.topAssistants.forEach((a: any, i: number) => {
          doc.text(`  ${i + 1}. ${a.name} — ${a.points} poin`);
        });
      } else {
        doc.text("  Tidak ada data");
      }

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").text(`Digenerate otomatis oleh Labkom pada ${new Date().toLocaleString("id-ID")}`, { align: "center" });

      doc.end();
    });
  }

  static async generateLeaderboardExcel(period?: string): Promise<Buffer> {
    const leaderboard = await LeaderboardService.getFullLeaderboard(period);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Labkom";

    const sheet = workbook.addWorksheet("Leaderboard");
    sheet.columns = [
      { header: "Rank", key: "rank", width: 8 },
      { header: "Nama", key: "name", width: 25 },
      { header: "Total Poin", key: "totalPoints", width: 15 },
      { header: "Misi Selesai", key: "missionsCompleted", width: 15 },
      { header: "Kehadiran", key: "totalAttendance", width: 15 },
      { header: "Rate Hadir (%)", key: "attendanceRate", width: 15 },
      { header: "Tugas Harian", key: "dailyTasksCompleted", width: 15 },
      { header: "Tiket Resolved", key: "ticketsResolved", width: 15 },
    ];

    leaderboard.forEach((entry) => {
      sheet.addRow(entry);
    });

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4B607F" },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
