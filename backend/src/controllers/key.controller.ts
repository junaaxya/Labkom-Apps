import { Request, Response } from "express";
import { KeyService } from "../services/key.service";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
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
      const key = await KeyService.takeKey(getParam(req.params.id), req.user.userId, req.user.role, req.body.notes);
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

  static async returnKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const key = await KeyService.returnKey(getParam(req.params.id), req.user.userId, req.body.notes);
      res.json({ success: true, message: "Kunci berhasil dikembalikan", data: key });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async forceReturnKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const key = await KeyService.forceReturnKey(getParam(req.params.id), req.user.userId, req.body.reason);
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
      const { qrCode } = req.body;
      if (!qrCode) { res.status(400).json({ success: false, message: "QR Code wajib diisi" }); return; }
      const key = await KeyService.findKeyByQR(qrCode);
      res.json({ success: true, data: key });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }
}
