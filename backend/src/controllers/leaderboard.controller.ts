import { Request, Response } from "express";
import { LeaderboardService } from "../services/leaderboard.service";
import { canViewLeaderboardDetail } from "../services/leaderboard-security";

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
      const targetUserId = getParam(req.params.userId);
      if (!req.user || !canViewLeaderboardDetail(req.user, targetUserId)) {
        res.status(403).json({ success: false, message: "Anda hanya dapat melihat detail leaderboard milik sendiri." });
        return;
      }
      const stats = await LeaderboardService.getUserStats(targetUserId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async getOverallStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await LeaderboardService.getOverallStats(req.query.period as string | undefined);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
