import { Request, Response } from "express";
import { LogbookService } from "../services/logbook.service";

const getParam = (param: string | string[]) => (Array.isArray(param) ? param[0] : param);

export class LogbookController {
  static async getAllLogbooks(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        userId: req.query.userId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };
      const logbooks = await LogbookService.getAllLogbooks(filters);
      res.json({ success: true, data: logbooks });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getLogbookById(req: Request, res: Response): Promise<void> {
    try {
      const logbook = await LogbookService.getLogbookById(getParam(req.params.id));
      res.json({ success: true, data: logbook });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async checkin(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const logbook = await LogbookService.checkin(req.user.userId);
      res.status(201).json({ success: true, message: "Check-in berhasil", data: logbook });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getTodayLogbook(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const logbook = await LogbookService.getTodayLogbook(req.user.userId);
      res.json({ success: true, data: logbook });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async submitCondition(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { labId, fotoBukti, kerusakanBaru, catatanKondisi } = req.body;
      if (!labId) { res.status(400).json({ success: false, message: "labId wajib diisi" }); return; }
      if (!fotoBukti || !Array.isArray(fotoBukti) || fotoBukti.length === 0) {
        res.status(400).json({ success: false, message: "Minimal 1 foto bukti" }); return;
      }
      const condition = await LogbookService.submitCondition(
        getParam(req.params.id), labId, req.user.userId, req.user.role,
        { fotoBukti, kerusakanBaru, catatanKondisi }
      );
      res.json({ success: true, message: "Kondisi berhasil disubmit", data: condition });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async verifyCondition(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const condition = await LogbookService.verifyCondition(getParam(req.params.conditionId), req.user.userId);
      res.json({ success: true, message: "Kondisi berhasil diverifikasi", data: condition });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async checkout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const logbook = await LogbookService.checkout(getParam(req.params.id), req.user.userId);
      res.json({ success: true, message: "Check-out berhasil", data: logbook });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await LogbookService.getStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
