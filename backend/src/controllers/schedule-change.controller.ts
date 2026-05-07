import { Request, Response } from "express";
import { ScheduleChangeService } from "../services/schedule-change.service";
import {
  approveScheduleChangeSchema,
  createScheduleChangeSchema,
  rejectScheduleChangeSchema,
} from "../validators/schedule-change.validator";

function getParam(params: Record<string, string | string[]>, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

export class ScheduleChangeController {
  static async getAllRequests(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        requestedById: typeof req.query.requestedById === "string" ? req.query.requestedById : undefined,
        page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
        limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      };

      const requests = await ScheduleChangeService.getAllRequests(filters);
      res.json({ success: true, data: requests });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const requests = await ScheduleChangeService.getMyRequests(req.user.userId);
      res.json({ success: true, data: requests });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validated = createScheduleChangeSchema.parse(req.body);
      const request = await ScheduleChangeService.createRequest(validated, req.user.userId);

      res.status(201).json({ success: true, message: "Pengajuan perubahan jadwal berhasil dibuat", data: request });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }

      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validated = approveScheduleChangeSchema.parse(req.body);
      const request = await ScheduleChangeService.approveRequest(
        getParam(req.params, "id"),
        req.user.userId,
        validated.adminNotes
      );

      res.json({ success: true, message: "Pengajuan perubahan jadwal disetujui", data: request });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }

      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validated = rejectScheduleChangeSchema.parse(req.body);
      const request = await ScheduleChangeService.rejectRequest(
        getParam(req.params, "id"),
        req.user.userId,
        validated.rejectionReason
      );

      res.json({ success: true, message: "Pengajuan perubahan jadwal ditolak", data: request });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }

      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await ScheduleChangeService.getStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
