import { Request, Response } from "express";
import { AccessRequestService } from "../services/access-request.service";
import {
  createAccessRequestSchema,
  getAccessRequestsQuerySchema,
  updateAccessRequestStatusSchema,
} from "../validators/access-request.validator";

function getParam(params: Record<string, string | string[]>, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatZodIssues(error: any) {
  return error.issues ?? error.errors ?? [];
}

export class AccessRequestController {
  static async getPublicLabs(_req: Request, res: Response): Promise<void> {
    try {
      const labs = await AccessRequestService.getPublicLabs();
      res.json({ success: true, data: labs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const validated = createAccessRequestSchema.parse(req.body);
      const request = await AccessRequestService.createRequest(validated);
      res.status(201).json({ success: true, message: "Pengajuan berhasil dikirim", data: request });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: formatZodIssues(error) });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getByCode(req: Request, res: Response): Promise<void> {
    try {
      const request = await AccessRequestService.getByCode(getParam(req.params, "requestCode"));
      res.json({ success: true, data: request });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query = getAccessRequestsQuerySchema.parse(req.query);
      const result = await AccessRequestService.getAll(query);
      res.json({ success: true, data: result });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: formatZodIssues(error) });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const request = await AccessRequestService.getById(getParam(req.params, "id"));
      res.json({ success: true, data: request });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async review(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validated = updateAccessRequestStatusSchema.parse(req.body);
      const request = await AccessRequestService.reviewRequest(getParam(req.params, "id"), req.user.userId, validated);
      res.json({ success: true, message: "Pengajuan berhasil diproses", data: request });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: formatZodIssues(error) });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
