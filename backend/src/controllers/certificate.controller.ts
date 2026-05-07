import { Request, Response } from "express";
import { CertificateService } from "../services/certificate.service";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

export class CertificateController {
  static async generateMonthlyBest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { month } = req.body;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ success: false, message: "Format bulan harus YYYY-MM" });
        return;
      }
      const cert = await CertificateService.generateMonthlyBest(month, req.user.userId);
      res.status(201).json({ success: true, message: "Sertifikat berhasil dibuat", data: cert });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async generateAttendancePerfect(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { userId, month } = req.body;
      if (!userId || !month) {
        res.status(400).json({ success: false, message: "userId dan month wajib diisi" });
        return;
      }
      const cert = await CertificateService.generateAttendancePerfect(userId, month, req.user.userId);
      res.status(201).json({ success: true, message: "Sertifikat kehadiran berhasil dibuat", data: cert });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async generateMissionMaster(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ success: false, message: "userId wajib diisi" });
        return;
      }
      const cert = await CertificateService.generateMissionMaster(userId, req.user.userId);
      res.status(201).json({ success: true, message: "Sertifikat mission master berhasil dibuat", data: cert });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async generateSkillMaster(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { userId } = req.body;
      if (!userId) {
        res.status(400).json({ success: false, message: "userId wajib diisi" });
        return;
      }
      const cert = await CertificateService.generateSkillMaster(userId, req.user.userId);
      res.status(201).json({ success: true, message: "Sertifikat skill master berhasil dibuat", data: cert });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getUserCertificates(req: Request, res: Response): Promise<void> {
    try {
      const userId = getParam(req.params.userId);
      const certs = await CertificateService.getUserCertificates(userId);
      res.json({ success: true, data: certs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllCertificates(req: Request, res: Response): Promise<void> {
    try {
      const certs = await CertificateService.getAllCertificates();
      res.json({ success: true, data: certs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async downloadCertificate(req: Request, res: Response): Promise<void> {
    try {
      const certId = getParam(req.params.id);
      const buffer = await CertificateService.generateCertificatePDF(certId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=sertifikat-${certId}.pdf`);
      res.send(buffer);
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await CertificateService.getTemplates();
      res.json({ success: true, data: templates });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async uploadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: "File template wajib diupload" });
        return;
      }
      const { name, type } = req.body;
      if (!name || !type) {
        res.status(400).json({ success: false, message: "name dan type wajib diisi" });
        return;
      }
      const imageUrl = `/uploads/templates/${file.filename}`;
      const template = await CertificateService.createTemplate(name, type, imageUrl);
      res.status(201).json({ success: true, message: "Template berhasil diupload", data: template });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateId = getParam(req.params.templateId);
      await CertificateService.deleteTemplate(templateId);
      res.json({ success: true, message: "Template berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
