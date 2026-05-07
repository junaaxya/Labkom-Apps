import { Request, Response } from "express";
import { ReportService } from "../services/report.service";

export class ReportController {
  static async getMonthlyReport(req: Request, res: Response): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ success: false, message: "Format bulan harus YYYY-MM" });
        return;
      }
      const report = await ReportService.getMonthlyReport(month);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
