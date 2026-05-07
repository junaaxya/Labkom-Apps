import { Request, Response } from "express";
import { LabService } from "../services/lab.service";
import { createLabSchema, updateLabSchema, createPCSchema, updatePCSchema } from "../validators/lab.validator";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

export class LabController {
  static async getAllLabs(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.all === "true";
      const labs = await LabService.getAllLabs(includeInactive);
      res.json({ success: true, data: labs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getLabById(req: Request, res: Response): Promise<void> {
    try {
      const lab = await LabService.getLabById(getParam(req.params.id));
      res.json({ success: true, data: lab });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createLab(req: Request, res: Response): Promise<void> {
    try {
      const validated = createLabSchema.parse(req.body);
      const lab = await LabService.createLab(validated);
      res.status(201).json({ success: true, message: "Lab berhasil dibuat", data: lab });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateLab(req: Request, res: Response): Promise<void> {
    try {
      const validated = updateLabSchema.parse(req.body);
      const lab = await LabService.updateLab(getParam(req.params.id), validated);
      res.json({ success: true, message: "Lab berhasil diupdate", data: lab });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteLab(req: Request, res: Response): Promise<void> {
    try {
      await LabService.deleteLab(getParam(req.params.id));
      res.json({ success: true, message: "Lab berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getLabStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await LabService.getLabStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPCsByLab(req: Request, res: Response): Promise<void> {
    try {
      const pcs = await LabService.getPCsByLab(getParam(req.params.labId));
      res.json({ success: true, data: pcs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPCById(req: Request, res: Response): Promise<void> {
    try {
      const pc = await LabService.getPCById(getParam(req.params.id));
      res.json({ success: true, data: pc });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createPC(req: Request, res: Response): Promise<void> {
    try {
      const validated = createPCSchema.parse(req.body);
      const pc = await LabService.createPC(validated);
      res.status(201).json({ success: true, message: "PC berhasil ditambahkan", data: pc });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updatePC(req: Request, res: Response): Promise<void> {
    try {
      const validated = updatePCSchema.parse(req.body);
      const pc = await LabService.updatePC(getParam(req.params.id), validated);
      res.json({ success: true, message: "PC berhasil diupdate", data: pc });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deletePC(req: Request, res: Response): Promise<void> {
    try {
      await LabService.deletePC(getParam(req.params.id));
      res.json({ success: true, message: "PC berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
