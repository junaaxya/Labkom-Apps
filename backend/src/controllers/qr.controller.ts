import { Request, Response } from "express";
import { QRService } from "../services/qr.service";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

export class QRController {
  static async getKeyQRImage(req: Request, res: Response): Promise<void> {
    try {
      const result = await QRService.getKeyQRImage(getParam(req.params.id));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async generateKeyQR(req: Request, res: Response): Promise<void> {
    try {
      const result = await QRService.generateKeyQR(getParam(req.params.id));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkGenerateKeyQR(_req: Request, res: Response): Promise<void> {
    try {
      const results = await QRService.bulkGenerateKeyQR();
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPCQRImage(req: Request, res: Response): Promise<void> {
    try {
      const result = await QRService.getPCQRImage(getParam(req.params.id));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async generatePCQR(req: Request, res: Response): Promise<void> {
    try {
      const result = await QRService.generatePCQR(getParam(req.params.id));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkGeneratePCQR(req: Request, res: Response): Promise<void> {
    try {
      const labId = req.query.labId as string;
      if (!labId) { res.status(400).json({ success: false, message: "labId wajib diisi" }); return; }
      const results = await QRService.bulkGeneratePCQR(labId);
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async bulkGenerateAssetCodes(req: Request, res: Response): Promise<void> {
    try {
      const labId = req.query.labId as string;
      if (!labId) { res.status(400).json({ success: false, message: "labId wajib diisi" }); return; }
      const results = await QRService.bulkGenerateAssetCodes(labId);
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async scanKey(req: Request, res: Response): Promise<void> {
    try {
      const keyCode = getParam(req.params.code);
      if (!keyCode) { res.status(400).json({ success: false, message: "Key code wajib diisi" }); return; }
      const key = await QRService.findKeyByCode(keyCode);
      res.json({ success: true, data: key });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async scanPC(req: Request, res: Response): Promise<void> {
    try {
      const assetCode = getParam(req.params.code);
      if (!assetCode) { res.status(400).json({ success: false, message: "Asset code wajib diisi" }); return; }
      const pc = await QRService.findPCByAssetCode(assetCode);
      res.json({ success: true, data: pc });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async getPrintSheet(req: Request, res: Response): Promise<void> {
    try {
      const labId = req.query.labId as string;
      const type = (req.query.type as "pc" | "key" | "all") || "all";
      if (!labId) { res.status(400).json({ success: false, message: "labId wajib diisi" }); return; }
      const html = await QRService.generatePrintSheet(labId, type);
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getKeyQRPng(req: Request, res: Response): Promise<void> {
    try {
      const result = await QRService.getKeyQRImage(getParam(req.params.id));
      const base64 = result.qrImage.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `inline; filename="${result.keyCode}.png"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async getPCQRPng(req: Request, res: Response): Promise<void> {
    try {
      const result = await QRService.getPCQRImage(getParam(req.params.id));
      const base64 = result.qrImage.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `inline; filename="${result.assetCode}.png"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }
}
