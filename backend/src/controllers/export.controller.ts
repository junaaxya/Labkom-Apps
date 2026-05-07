import { Request, Response } from "express";
import { ExportService } from "../services/export.service";

export class ExportController {
  static async exportMonthlyExcel(req: Request, res: Response): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ success: false, message: "Format bulan harus YYYY-MM" });
        return;
      }

      const buffer = await ExportService.generateMonthlyExcel(month);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=laporan-${month}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async exportMonthlyPDF(req: Request, res: Response): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ success: false, message: "Format bulan harus YYYY-MM" });
        return;
      }

      const buffer = await ExportService.generateMonthlyPDF(month);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=laporan-${month}.pdf`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async exportLeaderboardExcel(req: Request, res: Response): Promise<void> {
    try {
      const period = req.query.period as string | undefined;
      const buffer = await ExportService.generateLeaderboardExcel(period);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=leaderboard-${period || "all"}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
