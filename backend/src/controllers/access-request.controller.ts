import { Request, Response } from "express";
import { ZodError } from "zod";
import { AccessRequestService } from "../services/access-request.service";
import { ApprovalConflictError } from "../services/approval-conflict.error";
import {
  createAccessRequestSchema,
  getAccessRequestsQuerySchema,
  updateAccessRequestStatusSchema,
  resendMagangVerificationSchema,
  verifyMagangEmailSchema,
} from "../validators/access-request.validator";
import { VerificationDeliveryError } from "../services/magang-verification-email.service";

const DUPLICATE_EMAIL_MESSAGE = "Email sudah terdaftar";
const VERIFICATION_DELIVERY_MESSAGE = "Pengajuan tersimpan tetapi email verifikasi belum dapat dikirim. Hubungi administrator.";
const CREATE_REQUEST_FAILURE_MESSAGE = "Pengajuan tidak dapat diproses. Silakan coba lagi.";
const INVALID_VERIFICATION_TOKEN_MESSAGE = "Token verifikasi tidak valid atau sudah kedaluwarsa";
const RESEND_RESPONSE_MESSAGE = "Jika pengajuan MAGANG yang belum diverifikasi ditemukan, email verifikasi baru akan dikirim.";

function getParam(params: Record<string, string | string[]>, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatZodIssues(error: ZodError) {
  return error.issues;
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
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: formatZodIssues(error) });
        return;
      }
      if (error instanceof VerificationDeliveryError) {
        res.status(503).json({ success: false, message: VERIFICATION_DELIVERY_MESSAGE });
        return;
      }
      if (error instanceof Error && error.message === DUPLICATE_EMAIL_MESSAGE) {
        res.status(400).json({ success: false, message: DUPLICATE_EMAIL_MESSAGE });
        return;
      }
      res.status(500).json({ success: false, message: CREATE_REQUEST_FAILURE_MESSAGE });
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

  static async verifyMagangEmail(req: Request, res: Response): Promise<void> {
    try {
      const validated = verifyMagangEmailSchema.parse(req.body);
      await AccessRequestService.verifyMagangEmail(validated.token);
      res.json({ success: true, message: "Email berhasil diverifikasi" });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: formatZodIssues(error) });
        return;
      }
      res.status(400).json({ success: false, message: INVALID_VERIFICATION_TOKEN_MESSAGE });
    }
  }

  static async resendMagangVerification(req: Request, res: Response): Promise<void> {
    try {
      const validated = resendMagangVerificationSchema.parse(req.body);
      await AccessRequestService.resendMagangVerification(validated.email);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: formatZodIssues(error) });
        return;
      }
    }
    res.status(200).json({ success: true, message: RESEND_RESPONSE_MESSAGE });
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
      if (error instanceof ApprovalConflictError) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      if (error.message === "Pengajuan tidak ditemukan") {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async requeueApprovalEmail(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const success = await AccessRequestService.requeueApprovalEmail(getParam(req.params, "id"));
      res.json({
        success: true,
        message: "Pengiriman email persetujuan berhasil diantrekan ulang",
        data: { requeued: success },
      });
    } catch (error: any) {
      if (error.message === "Data pengiriman email tidak ditemukan") {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message || "Gagal mengantrekan ulang" });
    }
  }
}
