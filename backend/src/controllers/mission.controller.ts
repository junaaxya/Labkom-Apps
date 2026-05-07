import { Request, Response } from "express";
import { MissionService } from "../services/mission.service";

const getParam = (p: string | string[]) => (Array.isArray(p) ? p[0] : p);

export class MissionController {
  static async getAllMissions(req: Request, res: Response): Promise<void> {
    try {
      const missions = await MissionService.getAllMissions({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        createdById: typeof req.query.createdById === "string" ? req.query.createdById : undefined,
        page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
        limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      });
      res.json({ success: true, data: missions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMissionById(req: Request, res: Response): Promise<void> {
    try {
      const mission = await MissionService.getMissionById(getParam(req.params.id));
      res.json({ success: true, data: mission });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createMission(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const mission = await MissionService.createMission({ ...req.body, createdById: req.user.userId });
      res.status(201).json({ success: true, message: "Misi berhasil dibuat", data: mission });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async claimMission(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const claim = await MissionService.claimMission(getParam(req.params.id), req.user.userId);
      res.json({ success: true, message: "Misi berhasil diklaim", data: claim });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async submitMission(req: Request, res: Response): Promise<void> {
    try {
      const { proof } = req.body;
      const claim = await MissionService.submitMission(getParam(req.params.claimId), proof);
      res.json({ success: true, message: "Bukti berhasil disubmit", data: claim });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async verifyMission(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { approved, notes } = req.body;
      const claim = await MissionService.verifyMission(getParam(req.params.claimId), req.user.userId, approved, notes);
      res.json({ success: true, message: approved ? "Misi disetujui" : "Misi ditolak", data: claim });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyMissions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const missions = await MissionService.getMyMissions(req.user.userId);
      res.json({ success: true, data: missions });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMissionStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await MissionService.getMissionStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateMission(req: Request, res: Response): Promise<void> {
    try {
      const mission = await MissionService.updateMission(getParam(req.params.id), {
        title: req.body.title,
        description: req.body.description,
        points: req.body.points,
        deadline: req.body.deadline,
      });
      res.json({ success: true, message: "Misi berhasil diperbarui", data: mission });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteMission(req: Request, res: Response): Promise<void> {
    try {
      const result = await MissionService.deleteMission(getParam(req.params.id));
      res.json({ success: true, message: "Misi berhasil dihapus", data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const leaderboard = await MissionService.getLeaderboard();
      res.json({ success: true, data: leaderboard });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
