import { Request, Response } from "express";
import { LeaveService } from "../services/leave.service";

function getParam(params: Record<string, string | string[]>, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

export class LeaveController {
  static async createRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { type, date, reason } = req.body;
      if (!type || !date || !reason) {
        res.status(400).json({ success: false, message: "type, date, dan reason wajib diisi" });
        return;
      }

      const validTypes = ["SICK", "PERMISSION"];
      if (!validTypes.includes(type)) {
        res.status(400).json({ success: false, message: "Type harus SICK atau PERMISSION" });
        return;
      }

      const request = await LeaveService.createRequest(req.user.userId, type, date, reason);
      res.status(201).json({ success: true, message: "Pengajuan izin/sakit berhasil dibuat", data: request });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

      const requests = await LeaveService.getMyRequests(req.user.userId, status, page, limit);
      res.json({ success: true, data: requests });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllRequests(req: Request, res: Response): Promise<void> {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

      const requests = await LeaveService.getAllRequests(status, page, limit);
      res.json({ success: true, data: requests });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPendingCount(_req: Request, res: Response): Promise<void> {
    try {
      const total = await LeaveService.getPendingCount();
      res.json({ success: true, data: { pendingCount: total } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const reviewNote = typeof req.body.reviewNote === "string" ? req.body.reviewNote : undefined;
      const request = await LeaveService.approveRequest(getParam(req.params, "id"), req.user.userId, reviewNote);
      res.json({ success: true, message: "Pengajuan izin/sakit disetujui", data: request });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const reviewNote = typeof req.body.reviewNote === "string" ? req.body.reviewNote : undefined;
      const request = await LeaveService.rejectRequest(getParam(req.params, "id"), req.user.userId, reviewNote);
      res.json({ success: true, message: "Pengajuan izin/sakit ditolak", data: request });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getRequestsByUser(req: Request, res: Response): Promise<void> {
    try {
      const requests = await LeaveService.getRequestsByUser(getParam(req.params, "userId"));
      res.json({ success: true, data: requests });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
