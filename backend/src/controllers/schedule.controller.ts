import { Request, Response } from "express";
import { ScheduleService } from "../services/schedule.service";
import { createScheduleSchema, updateScheduleSchema } from "../validators/schedule.validator";

const getParam = (param: string | string[]) => (Array.isArray(param) ? param[0] : param);

export class ScheduleController {
  static async getAllSchedules(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        labId: req.query.labId as string | undefined,
        day: req.query.day as string | undefined,
        semester: req.query.semester as string | undefined,
      };
      const schedules = await ScheduleService.getAllSchedules(filters);
      res.json({ success: true, data: schedules });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getScheduleById(req: Request, res: Response): Promise<void> {
    try {
      const schedule = await ScheduleService.getScheduleById(getParam(req.params.id));
      res.json({ success: true, data: schedule });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createSchedule(req: Request, res: Response): Promise<void> {
    try {
      const validated = createScheduleSchema.parse(req.body);
      const schedule = await ScheduleService.createSchedule(validated);
      res.status(201).json({ success: true, message: "Jadwal berhasil dibuat", data: schedule });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateSchedule(req: Request, res: Response): Promise<void> {
    try {
      const validated = updateScheduleSchema.parse(req.body);
      const schedule = await ScheduleService.updateSchedule(getParam(req.params.id), validated);
      res.json({ success: true, message: "Jadwal berhasil diupdate", data: schedule });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      await ScheduleService.deleteSchedule(getParam(req.params.id));
      res.json({ success: true, message: "Jadwal berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkDeleteSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ success: false, message: "ids harus berupa array" });
        return;
      }
      const result = await ScheduleService.bulkDeleteSchedules(ids);
      res.json({ success: true, message: `${result.count} jadwal berhasil dihapus` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteAllSchedules(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        labId: req.query.labId as string | undefined,
        day: req.query.day as string | undefined,
      };
      const result = await ScheduleService.deleteAllSchedules(filters);
      res.json({ success: true, message: `${result.count} jadwal berhasil dihapus` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getSchedulesByDay(req: Request, res: Response): Promise<void> {
    try {
      const schedules = await ScheduleService.getSchedulesByDay(
        getParam(req.params.labId),
        getParam(req.params.day)
      );
      res.json({ success: true, data: schedules });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.body;
      const schedule = await ScheduleService.updateStatus(getParam(req.params.id), status);
      res.json({ success: true, message: "Status jadwal berhasil diupdate", data: schedule });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getTodaySchedules(req: Request, res: Response): Promise<void> {
    try {
      const labId = req.query.labId as string | undefined;
      const schedules = await ScheduleService.getTodaySchedules(labId);
      res.json({ success: true, data: schedules });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await ScheduleService.getStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
