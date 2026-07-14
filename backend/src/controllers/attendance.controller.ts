import { Request, Response } from "express";
import { AsLabPicketDestination, ShiftScheduleStatus } from "@prisma/client";
import {
  AttendanceService,
  AttendanceSettingsService,
  AttendanceLocationService,
  TaskCategoryConfigService,
  ShiftScheduleService,
  DailyTaskService,
  CorrectionRequestService,
  LeaveRequestService,
  WeeklyPlannerError,
} from "../services/attendance.service";
import { recurringShiftPlanSchema, weeklyShiftPlanSchema, weeklyShiftPreviewSchema } from "../validators/attendance.validator";

const picketDestinations = new Set<string>(Object.values(AsLabPicketDestination));
const shiftScheduleStatuses = new Set<string>(Object.values(ShiftScheduleStatus));

function parsePicketDestination(value: unknown): AsLabPicketDestination | undefined {
  return typeof value === "string" && picketDestinations.has(value) ? (value as AsLabPicketDestination) : undefined;
}

function parseShiftScheduleStatus(value: unknown): ShiftScheduleStatus | undefined {
  return typeof value === "string" && shiftScheduleStatuses.has(value) ? (value as ShiftScheduleStatus) : undefined;
}

export class AttendanceController {
  static async checkin(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { latitude, longitude } = req.body;
      const attendance = await AttendanceService.checkin(req.user.userId, latitude, longitude);
      res.status(201).json({ success: true, message: "Check-in berhasil", data: attendance });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async checkout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { latitude, longitude } = req.body;
      const attendance = await AttendanceService.checkout(req.user.userId, latitude, longitude);
      res.json({ success: true, message: "Check-out berhasil", data: attendance });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyAttendance(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const month = req.query.month as string | undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const data = await AttendanceService.getMyAttendance(req.user.userId, month, page, limit);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllAttendance(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceService.getAllAttendance({
        date: req.query.date as string | undefined,
        status: req.query.status as string | undefined,
        userId: req.query.userId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTodayMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceService.getTodayMonitoring();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async verifyAttendance(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { action, notes } = req.body;
      if (!action || !["APPROVED", "REJECTED"].includes(action)) {
        res.status(400).json({ success: false, message: "Action harus APPROVED atau REJECTED" }); return;
      }
      const data = await AttendanceService.verifyAttendance(req.params.id as string, req.user.userId, action, notes);
      res.json({ success: true, message: `Absensi ${action.toLowerCase()}`, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAttendanceStats(req: Request, res: Response): Promise<void> {
    try {
      const month = req.query.month as string | undefined;
      const userId = req.user?.role === "KOORDINATOR_LAB" ? (req.query.userId as string | undefined) : req.user?.userId;
      const data = await AttendanceService.getAttendanceStats(userId, month);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTodayCount(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceService.getTodayCount();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMonthlyRecap(req: Request, res: Response): Promise<void> {
    try {
      const month = req.query.month as string;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({ success: false, message: "Format bulan harus YYYY-MM" }); return;
      }
      const data = await AttendanceService.getMonthlyRecap(month);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async markAbsent(req: Request, res: Response): Promise<void> {
    try {
      const { userId, reason, date } = req.body;
      if (!userId || !reason) {
        res.status(400).json({ success: false, message: "userId dan reason wajib diisi" }); return;
      }
      const data = await AttendanceService.markAbsent(userId, reason, date);
      res.json({ success: true, message: "Status absensi diperbarui", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getAslebDetail(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId as string;
      const month = req.query.month as string | undefined;
      const data = await AttendanceService.getAslebDetail(userId, month);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Daily Tasks
  static async addDailyTask(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { task, description, category, categoryConfigId, photoUrl, duration, labId, relatedTicketId, relatedMissionId, relatedScheduleId } = req.body;
      if (!task) { res.status(400).json({ success: false, message: "Task wajib diisi" }); return; }
      const data = await DailyTaskService.create(req.user.userId, {
        task, description, category, categoryConfigId, photoUrl, duration, labId, relatedTicketId, relatedMissionId, relatedScheduleId,
      });
      res.status(201).json({ success: true, message: "Task berhasil ditambahkan", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateDailyTask(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const data = await DailyTaskService.updateTask(req.params.taskId as string, req.user.userId, req.body);
      res.json({ success: true, message: "Task berhasil diupdate", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyDailyTasks(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const date = req.query.date as string | undefined;
      const category = req.query.category as string | undefined;
      const data = await DailyTaskService.getMyTasks(req.user.userId, date, category);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllDailyTasks(req: Request, res: Response): Promise<void> {
    try {
      const data = await DailyTaskService.getAllTasks({
        date: req.query.date as string | undefined,
        category: req.query.category as string | undefined,
        status: req.query.status as string | undefined,
        userId: req.query.userId as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPendingTasks(req: Request, res: Response): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      const data = await DailyTaskService.getAllPending(date);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async reviewTask(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { action, reviewNote } = req.body;
      if (!action || !["APPROVED", "REJECTED", "NEED_REVISION"].includes(action)) {
        res.status(400).json({ success: false, message: "Action harus APPROVED, REJECTED, atau NEED_REVISION" }); return;
      }
      const data = await DailyTaskService.review(req.params.taskId as string, req.user.userId, action, reviewNote);
      res.json({ success: true, message: `Task ${action.toLowerCase()}`, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getDailyTaskStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const month = req.query.month as string | undefined;
      const userId = req.user.role === "KOORDINATOR_LAB" ? (req.query.userId as string || req.user.userId) : req.user.userId;
      const data = await DailyTaskService.getStats(userId, month);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Settings
  static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceSettingsService.get();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceSettingsService.update(req.body);
      res.json({ success: true, message: "Pengaturan berhasil diupdate", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Locations
  static async getLocations(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceLocationService.getAll();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createLocation(req: Request, res: Response): Promise<void> {
    try {
      const { name, latitude, longitude, radiusMeter } = req.body;
      if (!name || latitude === undefined || longitude === undefined) {
        res.status(400).json({ success: false, message: "name, latitude, longitude wajib diisi" }); return;
      }
      const data = await AttendanceLocationService.create({ name, latitude, longitude, radiusMeter });
      res.status(201).json({ success: true, message: "Lokasi berhasil ditambahkan", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      const data = await AttendanceLocationService.update(req.params.id as string, req.body);
      res.json({ success: true, message: "Lokasi berhasil diupdate", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteLocation(req: Request, res: Response): Promise<void> {
    try {
      await AttendanceLocationService.delete(req.params.id as string);
      res.json({ success: true, message: "Lokasi berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Task Categories
  static async getTaskCategories(req: Request, res: Response): Promise<void> {
    try {
      const data = await TaskCategoryConfigService.getAll();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createTaskCategory(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, defaultPoints, isEvidenceRequired } = req.body;
      if (!name) { res.status(400).json({ success: false, message: "Nama kategori wajib diisi" }); return; }
      const data = await TaskCategoryConfigService.create({ name, description, defaultPoints, isEvidenceRequired });
      res.status(201).json({ success: true, message: "Kategori berhasil ditambahkan", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateTaskCategory(req: Request, res: Response): Promise<void> {
    try {
      const data = await TaskCategoryConfigService.update(req.params.id as string, req.body);
      res.json({ success: true, message: "Kategori berhasil diupdate", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteTaskCategory(req: Request, res: Response): Promise<void> {
    try {
      await TaskCategoryConfigService.delete(req.params.id as string);
      res.json({ success: true, message: "Kategori berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Shift Schedules
  static async getShiftSchedules(req: Request, res: Response): Promise<void> {
    try {
      const data = await ShiftScheduleService.getAll({
        date: req.query.date as string | undefined,
        month: req.query.month as string | undefined,
        userId: req.query.userId as string | undefined,
        destination: parsePicketDestination(req.query.destination),
        labId: req.query.labId as string | undefined,
        status: parseShiftScheduleStatus(req.query.status),
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyShiftSchedules(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const month = req.query.month as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const data = await ShiftScheduleService.getMySchedules(req.user.userId, { month, from, to });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createShiftSchedule(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { userId, destination, shiftId, scheduleDate, dates, schedules, notes } = req.body;
      const parsedDestination = parsePicketDestination(destination);
      if (!userId || !parsedDestination || !shiftId) {
        res.status(400).json({ success: false, message: "userId, destination, shiftId wajib diisi" }); return;
      }

      if (dates && Array.isArray(dates)) {
        const data = await ShiftScheduleService.bulkCreate({ userId, destination: parsedDestination, shiftId, dates, assignedBy: req.user.userId, notes });
        res.status(201).json({ success: true, message: `${data.length} jadwal shift berhasil dibuat`, data });
      } else if (schedules && Array.isArray(schedules)) {
        const requestDates = schedules
          .map((item) => typeof item?.scheduleDate === "string" ? item.scheduleDate : undefined)
          .filter((date): date is string => Boolean(date));
        const data = await ShiftScheduleService.bulkCreate({ userId, destination: parsedDestination, shiftId, dates: requestDates, assignedBy: req.user.userId, notes });
        res.status(201).json({ success: true, message: `${data.length} jadwal shift berhasil dibuat`, data });
      } else if (scheduleDate) {
        const data = await ShiftScheduleService.create({ userId, destination: parsedDestination, shiftId, scheduleDate, assignedBy: req.user.userId, notes });
        res.status(201).json({ success: true, message: "Jadwal shift berhasil dibuat", data });
      } else {
        res.status(400).json({ success: false, message: "scheduleDate atau dates wajib diisi" });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async previewWeeklyShiftPlan(req: Request, res: Response): Promise<void> {
    try {
      const parsed = weeklyShiftPreviewSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Payload preview jadwal mingguan tidak valid",
          errors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        });
        return;
      }

      const data = await ShiftScheduleService.previewWeeklyPlan(parsed.data);
      res.json({ success: true, message: "Draft jadwal mingguan berhasil dibuat dan belum disimpan", data });
    } catch (error: unknown) {
      if (error instanceof WeeklyPlannerError) {
        res.status(400).json({ success: false, message: error.message, errors: error.details });
        return;
      }
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Gagal membuat preview jadwal mingguan" });
    }
  }

  static async saveWeeklyShiftPlan(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const parsed = weeklyShiftPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: "Payload jadwal mingguan tidak valid",
          errors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        });
        return;
      }

      const data = await ShiftScheduleService.saveWeeklyPlan(parsed.data, req.user.userId);
      res.status(201).json({
        success: true,
        message: `${data.schedules.length} jadwal piket mingguan berhasil disimpan`,
        data,
      });
    } catch (error: unknown) {
      if (error instanceof WeeklyPlannerError) {
        res.status(409).json({ success: false, message: error.message, errors: error.details });
        return;
      }
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Gagal menyimpan jadwal mingguan" });
    }
  }

  static async getRecurringShiftPattern(req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await ShiftScheduleService.getRecurringPattern() });
    } catch (error: unknown) {
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Gagal mengambil pola piket" });
    }
  }

  static async saveRecurringShiftPlan(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const parsed = recurringShiftPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: "Payload pola piket tidak valid", errors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
        return;
      }
      const data = await ShiftScheduleService.saveRecurringPlan(parsed.data, req.user.userId);
      res.status(201).json({ success: true, message: `${data.createdCount} jadwal piket berulang berhasil dibuat`, data });
    } catch (error: unknown) {
      if (error instanceof WeeklyPlannerError) { res.status(409).json({ success: false, message: error.message, errors: error.details }); return; }
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Gagal menyimpan pola piket" });
    }
  }

  static async updateShiftSchedule(req: Request, res: Response): Promise<void> {
    try {
      const data = await ShiftScheduleService.update(req.params.id as string, req.body);
      res.json({ success: true, message: "Jadwal shift berhasil diupdate", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteShiftSchedule(req: Request, res: Response): Promise<void> {
    try {
      await ShiftScheduleService.delete(req.params.id as string);
      res.json({ success: true, message: "Jadwal shift berhasil dihapus" });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteWeekShiftSchedules(req: Request, res: Response): Promise<void> {
    try {
      const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : "";
      if (!weekStart) {
        res.status(400).json({ success: false, message: "Query weekStart wajib diisi (Senin YYYY-MM-DD)" });
        return;
      }
      const data = await ShiftScheduleService.deleteWeek(weekStart);
      res.json({
        success: true,
        message: `${data.deletedCount} jadwal piket minggu ${data.weekStart} berhasil dihapus`,
        data,
      });
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Gagal menghapus jadwal minggu",
      });
    }
  }

  static async deleteRecurringShiftPattern(req: Request, res: Response): Promise<void> {
    try {
      const patternId = typeof req.query.patternId === "string" ? req.query.patternId : undefined;
      const data = await ShiftScheduleService.deleteRecurringPattern(patternId);
      res.json({
        success: true,
        message: `Pola piket berulang dihapus (${data.deletedFutureCount} jadwal mendatang dibersihkan)`,
        data,
      });
    } catch (error: unknown) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Gagal menghapus pola piket berulang",
      });
    }
  }

  // Correction Requests
  static async createCorrectionRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { attendanceId, requestType, oldValue, newValue, reason, evidenceUrl } = req.body;
      if (!attendanceId || !requestType || !reason) {
        res.status(400).json({ success: false, message: "attendanceId, requestType, reason wajib diisi" }); return;
      }
      const data = await CorrectionRequestService.create(req.user.userId, { attendanceId, requestType, oldValue, newValue, reason, evidenceUrl });
      res.status(201).json({ success: true, message: "Request koreksi berhasil diajukan", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyCorrectionRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const data = await CorrectionRequestService.getMyRequests(req.user.userId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPendingCorrections(req: Request, res: Response): Promise<void> {
    try {
      const data = await CorrectionRequestService.getAllPending();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async reviewCorrection(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const { action, reviewNote } = req.body;
      if (!action || !["APPROVED", "REJECTED"].includes(action)) {
        res.status(400).json({ success: false, message: "Action harus APPROVED atau REJECTED" }); return;
      }
      const data = await CorrectionRequestService.review(req.params.id as string, req.user.userId, action, reviewNote);
      res.json({ success: true, message: `Koreksi ${action.toLowerCase()}`, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async submitLeaveRequest(req: Request, res: Response) {
    try {
      const { type, date, reason, evidenceUrl } = req.body;
      if (!type || !date || !reason) {
        res.status(400).json({ success: false, message: "Type, date, dan reason wajib diisi" }); return;
      }
      if (!["SICK", "PERMISSION"].includes(type)) {
        res.status(400).json({ success: false, message: "Type harus SICK atau PERMISSION" }); return;
      }
      const data = await LeaveRequestService.submit(req.user!.userId, { type, date, reason, evidenceUrl });
      res.status(201).json({ success: true, message: "Pengajuan izin berhasil dikirim", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyLeaveRequests(req: Request, res: Response) {
    try {
      const { month } = req.query;
      const data = await LeaveRequestService.getMyRequests(req.user!.userId, month as string);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPendingLeaveRequests(req: Request, res: Response) {
    try {
      const data = await LeaveRequestService.getPending();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAllLeaveRequests(req: Request, res: Response) {
    try {
      const { status, month, userId } = req.query;
      const data = await LeaveRequestService.getAll({
        status: status as string,
        month: month as string,
        userId: userId as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async reviewLeaveRequest(req: Request, res: Response) {
    try {
      const { action, reviewNote } = req.body;
      if (!action || !["APPROVED", "REJECTED"].includes(action)) {
        res.status(400).json({ success: false, message: "Action harus APPROVED atau REJECTED" }); return;
      }
      const data = await LeaveRequestService.review(req.params.id as string, req.user!.userId, action, reviewNote);
      res.json({ success: true, message: `Pengajuan ${action.toLowerCase()}`, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
