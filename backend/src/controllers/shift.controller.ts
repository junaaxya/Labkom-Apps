import { Request, Response } from "express";
import { ShiftService } from "../services/shift.service";

const getParam = (p: string | string[]) => (Array.isArray(p) ? p[0] : p);

export class ShiftController {
  static async getAllShifts(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        labId: typeof req.query.labId === "string" ? req.query.labId : undefined,
        aslebId: typeof req.query.aslebId === "string" ? req.query.aslebId : undefined,
        day: typeof req.query.day === "string" ? req.query.day : undefined,
      };
      const shifts = await ShiftService.getAllShifts(filters);
      res.json({ success: true, data: shifts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getShiftById(req: Request, res: Response): Promise<void> {
    try {
      const shift = await ShiftService.getShiftById(getParam(req.params.id));
      res.json({ success: true, data: shift });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createShift(req: Request, res: Response): Promise<void> {
    try {
      const shift = await ShiftService.createShift(req.body);
      res.status(201).json({ success: true, message: "Shift berhasil dibuat", data: shift });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateShift(req: Request, res: Response): Promise<void> {
    try {
      const shift = await ShiftService.updateShift(getParam(req.params.id), req.body);
      res.json({ success: true, message: "Shift berhasil diupdate", data: shift });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteShift(req: Request, res: Response): Promise<void> {
    try {
      await ShiftService.deleteShift(getParam(req.params.id));
      res.json({ success: true, message: "Shift berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getTodayShifts(req: Request, res: Response): Promise<void> {
    try {
      const shifts = await ShiftService.getTodayShifts();
      res.json({ success: true, data: shifts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAslebSchedule(req: Request, res: Response): Promise<void> {
    try {
      const shifts = await ShiftService.getAslebWeeklySchedule(getParam(req.params.aslebId));
      res.json({ success: true, data: shifts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
