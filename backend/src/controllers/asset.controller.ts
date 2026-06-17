import type { Request, Response } from "express";
import { AssetService } from "../services/asset.service";
import { assetListQuerySchema, createAssetSchema, maintenanceLogSchema, updateAssetSchema } from "../validators/asset.validator";

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function getUser(req: Request) {
  return { userId: req.user!.userId, role: req.user!.role };
}

export class AssetController {
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const query = assetListQuerySchema.parse(req.query);
      const result = await AssetService.list(query);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data aset";
      res.status(400).json({ success: false, message });
    }
  }

  static async summary(_req: Request, res: Response): Promise<void> {
    try {
      const result = await AssetService.getSummary();
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil ringkasan aset";
      res.status(500).json({ success: false, message });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const asset = await AssetService.getById(getParam(req, "id"));
      res.json({ success: true, data: asset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aset tidak ditemukan";
      res.status(404).json({ success: false, message });
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const data = createAssetSchema.parse(req.body);
      const asset = await AssetService.create(data, getUser(req));
      res.status(201).json({ success: true, data: asset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat aset";
      res.status(400).json({ success: false, message });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const data = updateAssetSchema.parse(req.body);
      const asset = await AssetService.update(getParam(req, "id"), data, getUser(req));
      res.json({ success: true, data: asset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengupdate aset";
      res.status(400).json({ success: false, message });
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      const asset = await AssetService.softDelete(getParam(req, "id"), getUser(req));
      res.json({ success: true, data: asset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus aset";
      res.status(400).json({ success: false, message });
    }
  }

  static async addMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const data = maintenanceLogSchema.parse(req.body);
      const log = await AssetService.addMaintenanceLog(getParam(req, "id"), data, getUser(req));
      res.status(201).json({ success: true, data: log });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menambah riwayat maintenance";
      res.status(400).json({ success: false, message });
    }
  }

  static async audit(req: Request, res: Response): Promise<void> {
    try {
      const logs = await AssetService.getAuditLogs(getParam(req, "id"));
      res.json({ success: true, data: logs });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil audit aset";
      res.status(400).json({ success: false, message });
    }
  }

  static async backfillPCs(req: Request, res: Response): Promise<void> {
    try {
      const result = await AssetService.backfillFromPCs(getUser(req));
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal backfill PC ke aset";
      res.status(400).json({ success: false, message });
    }
  }
}
