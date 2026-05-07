import { Request, Response } from "express";
import { LeaderboardService } from "../services/leaderboard.service";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

export class LeaderboardController {
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const period = req.query.period as string | undefined;
      const leaderboard = await LeaderboardService.getFullLeaderboard(period);
      res.json({ success: true, data: leaderboard });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await LeaderboardService.getUserStats(getParam(req.params.userId));
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async getOverallStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await LeaderboardService.getOverallStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
