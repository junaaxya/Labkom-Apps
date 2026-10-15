import { Request, Response } from "express";
import { KeyService } from "../services/key.service";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

function isBodyObject(body: unknown): body is Record<string, unknown> {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

function optionalBodyText(body: unknown, field: "notes" | "reason"): string | undefined {
  if (body === undefined) return undefined;
  if (!isBodyObject(body)) throw new Error("Body harus berupa objek");

  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${field} harus berupa string`);
  return value.trim() ? value : undefined;
}

function requiredBodyText(body: unknown, field: "reason"): string {
  const value = optionalBodyText(body, field);
  if (!value) throw new Error("Alasan force return wajib diisi.");
  return value;
}

function photoUrls(body: unknown): string[] {
  if (!isBodyObject(body) || !Array.isArray(body.fotoBukti) || body.fotoBukti.length === 0) {
    throw new Error("Minimal satu foto kondisi lab wajib diisi.");
  }
  if (!body.fotoBukti.every((url) => typeof url === "string" && url.trim())) {
    throw new Error("URL foto kondisi tidak valid.");
  }
  return body.fotoBukti;
}

export class KeyController {
  static async getAllKeys(req: Request, res: Response): Promise<void> {
    try {
      const labId = req.query.labId as string | undefined;
      const keys = await KeyService.getAllKeys(labId);
      res.json({ success: true, data: keys });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getKeyById(req: Request, res: Response): Promise<void> {
    try {
      const key = await KeyService.getKeyById(getParam(req.params.id));
      res.json({ success: true, data: key });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async takeKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const key = await KeyService.takeKey(
        getParam(req.params.id),
        req.user.userId,
        req.user.role,
        optionalBodyText(req.body, "notes"),
      );
      res.json({ success: true, message: "Kunci berhasil diambil", data: key });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getReturnStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const status = await KeyService.getReturnStatus(getParam(req.params.id), req.user.userId);
      res.json({ success: true, data: status });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getEligibility(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const eligibility = await KeyService.getEligibility(getParam(req.params.id), req.user.userId, req.user.role);
      res.json({ success: true, data: eligibility });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async saveReturnEvidence(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const evidence = await KeyService.saveReturnEvidence(getParam(req.params.id), req.user.userId, photoUrls(req.body));
      res.json({ success: true, data: evidence });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async returnKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const key = await KeyService.returnKey(
        getParam(req.params.id),
        req.user.userId,
        optionalBodyText(req.body, "notes"),
      );
      res.json({ success: true, message: "Kunci berhasil dikembalikan", data: key });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async forceReturnKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const key = await KeyService.forceReturnKey(
        getParam(req.params.id),
        req.user.userId,
        requiredBodyText(req.body, "reason"),
      );
      res.json({ success: true, message: "Kunci berhasil dikembalikan paksa", data: key });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getKeyLogs(req: Request, res: Response): Promise<void> {
    try {
      const keyId = req.query.keyId as string | undefined;
      const logs = await KeyService.getKeyLogs(keyId);
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async findByQR(req: Request, res: Response): Promise<void> {
    try {
      const qrCode = isBodyObject(req.body) ? req.body.qrCode : undefined;
      if (typeof qrCode !== "string" || !qrCode) { res.status(400).json({ success: false, message: "QR Code wajib diisi" }); return; }
      const key = await KeyService.findKeyByQR(qrCode);
      res.json({ success: true, data: key });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }
}
