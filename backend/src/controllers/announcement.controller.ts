import { Request, Response } from "express";
import AnnouncementService from "../services/announcement.service";

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

function parsePagination(req: Request): { page: number; limit: number } {
  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1);
  const limitRaw = parseInt((req.query.limit as string) || "20", 10) || 20;
  const limit = Math.min(100, Math.max(1, limitRaw));
  return { page, limit };
}

export class AnnouncementController {
  static async getActive(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || "";
      const { page, limit } = parsePagination(req);
      const result = await AnnouncementService.getActiveAnnouncements(userId, page, limit);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getManage(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = parsePagination(req);
      const status = (req.query.status as string) || undefined;
      const result = await AnnouncementService.getAllForManage(page, limit, status);
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || "";
      const announcement = await AnnouncementService.getAnnouncementById(
        getParam(req.params.id),
        userId
      );
      res.json({ success: true, data: announcement });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || "";
      const announcement = await AnnouncementService.create(req.body, userId);
      res.status(201).json({
        success: true,
        message: "Pengumuman berhasil dibuat.",
        data: announcement,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const announcement = await AnnouncementService.update(
        getParam(req.params.id),
        req.body
      );
      res.json({
        success: true,
        message: "Pengumuman berhasil diupdate.",
        data: announcement,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      await AnnouncementService.delete(getParam(req.params.id));
      res.json({ success: true, message: "Pengumuman berhasil dihapus." });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async togglePublish(req: Request, res: Response): Promise<void> {
    try {
      const announcement = await AnnouncementService.togglePublish(
        getParam(req.params.id)
      );
      res.json({ success: true, data: announcement });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async togglePin(req: Request, res: Response): Promise<void> {
    try {
      const announcement = await AnnouncementService.togglePin(
        getParam(req.params.id)
      );
      res.json({ success: true, data: announcement });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

export default AnnouncementController;
