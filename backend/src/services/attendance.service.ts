import prisma from "../config/database";
import { AsLabPicketDestination, Prisma, ShiftScheduleStatus } from "@prisma/client";
import { notificationService } from "./notification.service";
import { RecurringShiftPlanInput, WeeklyShiftPlanInput, WeeklyShiftPreviewInput } from "../validators/attendance.validator";
import {
  assertCoordinates,
  assertRadius,
  buildAttendanceCorrection,
  evaluateShiftWindow,
  pickAttendanceLocationUpdate,
  pickDailyTaskUpdate,
  pickShiftScheduleUpdate,
} from "./attendance-security";
import { LeaveService } from "./leave.service";
import { AttendanceQrService } from "./attendance-qr.service";
import { attendancePointAwards } from "./attendance-gamification";

// ============================================
// UTILITY FUNCTIONS
// ============================================

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function getMonthRange(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0, 23, 59, 59, 999);
  return { start, end };
}

function getTodayRange(): { start: Date; end: Date } {
  const { date } = getJakartaDateParts(new Date());
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return { start, end };
}

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function getJakartaDateParts(now: Date): { date: string; hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hours: value("hour"),
    minutes: value("minute"),
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function resolveLateTolerance(shiftTolerance: number | null | undefined, defaultTolerance: number): number {
  return typeof shiftTolerance === "number" ? shiftTolerance : defaultTolerance;
}

export function isLateCheckin(checkinAt: Date, startTime: string, toleranceMinutes: number): boolean {
  const { hours, minutes } = getJakartaDateParts(checkinAt);
  return hours * 60 + minutes > timeToMinutes(startTime) + toleranceMinutes;
}

type TodayScheduleCandidate = {
  id: string;
  shift: {
    startTime: string;
  };
};

export function pickTodaySchedule<T extends TodayScheduleCandidate>(
  schedules: T[],
  now: Date,
): T | null {
  if (schedules.length === 0) return null;
  const currentMinutes = (() => {
    const { hours, minutes } = getJakartaDateParts(now);
    return hours * 60 + minutes;
  })();
  const sorted = [...schedules].sort((left, right) => {
    const minuteDiff = timeToMinutes(left.shift.startTime) - timeToMinutes(right.shift.startTime);
    return minuteDiff !== 0 ? minuteDiff : left.id.localeCompare(right.id);
  });
  const started = sorted.filter((schedule) => timeToMinutes(schedule.shift.startTime) <= currentMinutes);
  return started.length > 0 ? started[started.length - 1] : sorted[0];
}

const picketDestinationLabels: Record<AsLabPicketDestination, string> = {
  RUANGAN_ASLAB: "Ruangan Aslab",
  LAB_MULTIMEDIA: "Lab Multimedia",
  LAB_DASAR: "Lab Dasar",
};

type WeeklyAssignment = {
  date: string;
  labId: string;
  requiredAssistantCount: number;
  userIds: string[];
};

type WeeklyPlannerErrorDetail = {
  field?: string;
  date?: string;
  labId?: string;
  userIds?: string[];
};

const defaultActivePicketWeekdays = [1, 2, 3, 4, 5];

function normalizeActivePicketWeekdays(value: unknown, fallback = defaultActivePicketWeekdays): number[] {
  if (!Array.isArray(value)) return fallback;
  const weekdays = value.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 6);
  return weekdays.length === value.length && weekdays.length > 0 && new Set(weekdays).size === weekdays.length
    ? [...weekdays].sort((left, right) => left - right)
    : fallback;
}

export class WeeklyPlannerError extends Error {
  constructor(message: string, public readonly details: WeeklyPlannerErrorDetail[] = []) {
    super(message);
    this.name = "WeeklyPlannerError";
  }
}

function getWeeklyDates(weekStart: string, activePicketWeekdays: number[]): string[] {
  const monday = new Date(`${weekStart}T00:00:00.000Z`);
  return activePicketWeekdays.map((weekday) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + weekday - 1);
    return date.toISOString().slice(0, 10);
  });
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function getRecurringHorizon(effectiveFrom: string): { start: string; end: string; weekStarts: string[] } {
  const monday = dateOnly(effectiveFrom);
  const weekStarts = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index * 7);
    return date.toISOString().slice(0, 10);
  });
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + 55);
  return { start: effectiveFrom, end: end.toISOString().slice(0, 10), weekStarts };
}

export function materializeRecurringAssignments(
  effectiveFrom: string,
  activePicketWeekdays: number[],
  assignments: WeeklyAssignment[],
): WeeklyAssignment[] {
  const templateDates = getWeeklyDates(effectiveFrom, activePicketWeekdays);
  const weekdayByDate = new Map(templateDates.map((date, index) => [date, activePicketWeekdays[index]]));
  const horizon = getRecurringHorizon(effectiveFrom);
  return horizon.weekStarts.flatMap((weekStart) => assignments.map((assignment) => {
    const weekday = weekdayByDate.get(assignment.date);
    if (weekday === undefined) throw new WeeklyPlannerError("Tanggal template tidak termasuk hari piket aktif", [{ date: assignment.date }]);
    return { ...assignment, date: getWeeklyDates(weekStart, [weekday])[0] };
  }));
}

function validateWeeklyGroups(weekStart: string, activePicketWeekdays: number[], assignments: WeeklyAssignment[], labIds: string[]): void {
  const dates = new Set(getWeeklyDates(weekStart, activePicketWeekdays));
  const expectedGroups = new Set([...dates].flatMap((date) => labIds.map((labId) => `${date}:${labId}`)));
  const seenGroups = new Set<string>();
  const usersByDate = new Map<string, Set<string>>();
  const details: WeeklyPlannerErrorDetail[] = [];

  for (const assignment of assignments) {
    const groupKey = `${assignment.date}:${assignment.labId}`;
    if (!dates.has(assignment.date)) {
      details.push({ field: "date", date: assignment.date, labId: assignment.labId });
    }
    if (!expectedGroups.has(groupKey) || seenGroups.has(groupKey)) {
      details.push({ field: "assignments", date: assignment.date, labId: assignment.labId });
    }
    if (assignment.userIds.length !== assignment.requiredAssistantCount) {
      details.push({ field: "requiredAssistantCount", date: assignment.date, labId: assignment.labId, userIds: assignment.userIds });
    }
    seenGroups.add(groupKey);

    const dailyUsers = usersByDate.get(assignment.date) ?? new Set<string>();
    const duplicates = assignment.userIds.filter((userId) => dailyUsers.has(userId));
    if (duplicates.length > 0) {
      details.push({ field: "userIds", date: assignment.date, labId: assignment.labId, userIds: duplicates });
    }
    assignment.userIds.forEach((userId) => dailyUsers.add(userId));
    usersByDate.set(assignment.date, dailyUsers);
  }

  for (const groupKey of expectedGroups) {
    if (!seenGroups.has(groupKey)) {
      const [date, labId] = groupKey.split(":");
      details.push({ field: "assignments", date, labId });
    }
  }

  if (details.length > 0) {
    throw new WeeklyPlannerError("Kelompok jadwal mingguan tidak valid atau tidak lengkap", details);
  }
}

// ============================================
// ATTENDANCE SETTINGS
// ============================================

export class AttendanceSettingsService {
  static async get() {
    let settings = await prisma.attendanceSettings.findFirst();
    if (!settings) {
      settings = await prisma.attendanceSettings.create({ data: {} });
    }
    return settings;
  }

  static async update(data: {
    isGeofencingEnabled?: boolean;
    isQrRequired?: boolean;
    defaultRadiusMeter?: number;
    lateToleranceMinutes?: number;
    checkoutGraceMinutes?: number;
    forgotCheckoutAfterMinutes?: number;
    isTaskRequired?: boolean;
    isVerificationRequired?: boolean;
    activePicketWeekdays?: unknown;
  }) {
    const existing = await this.get();
    const validatedWeekdays = data.activePicketWeekdays === undefined ? null : normalizeActivePicketWeekdays(data.activePicketWeekdays, []);
    if (validatedWeekdays !== null && validatedWeekdays.length === 0) throw new Error("Hari piket aktif harus berisi hari Senin sampai Sabtu yang berbeda");

    const settingsData: Prisma.AttendanceSettingsUpdateInput = {};
    if (typeof data.isGeofencingEnabled === "boolean") settingsData.isGeofencingEnabled = data.isGeofencingEnabled;
    if (typeof data.isQrRequired === "boolean") settingsData.isQrRequired = data.isQrRequired;
    if (typeof data.isTaskRequired === "boolean") settingsData.isTaskRequired = data.isTaskRequired;
    if (typeof data.isVerificationRequired === "boolean") settingsData.isVerificationRequired = data.isVerificationRequired;

    const boundedNumbers: Array<[keyof typeof data, string, number, number]> = [
      ["defaultRadiusMeter", "defaultRadiusMeter", 10, 2000],
      ["lateToleranceMinutes", "lateToleranceMinutes", 0, 180],
      ["checkoutGraceMinutes", "checkoutGraceMinutes", 0, 360],
      ["forgotCheckoutAfterMinutes", "forgotCheckoutAfterMinutes", 0, 1440],
    ];
    for (const [source, target, min, max] of boundedNumbers) {
      const value = data[source];
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Nilai ${String(source)} harus bilangan bulat ${min}-${max}`);
      }
      (settingsData as Record<string, unknown>)[target] = value;
    }

    return prisma.attendanceSettings.update({
      where: { id: existing.id },
      data: {
        ...settingsData,
        ...(validatedWeekdays !== null ? { activePicketWeekdays: validatedWeekdays } : {}),
      },
    });
  }

  static async getActivePicketWeekdays(): Promise<number[]> {
    const settings = await this.get();
    return normalizeActivePicketWeekdays(settings.activePicketWeekdays);
  }
}

// ============================================
// ATTENDANCE LOCATIONS
// ============================================

export class AttendanceLocationService {
  static async getAll() {
    return prisma.attendanceLocation.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(data: { name: string; latitude: number; longitude: number; radiusMeter?: number }) {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name || name.length > 100) throw new Error("Nama lokasi wajib diisi (maksimal 100 karakter)");
    assertCoordinates(data.latitude, data.longitude);
    const radiusMeter = data.radiusMeter ?? 100;
    assertRadius(radiusMeter);
    return prisma.attendanceLocation.create({ data: { name, latitude: data.latitude, longitude: data.longitude, radiusMeter } });
  }

  static async update(id: string, data: { name?: string; latitude?: number; longitude?: number; radiusMeter?: number; isActive?: boolean }) {
    const safe = pickAttendanceLocationUpdate(data as Record<string, unknown>) as typeof data;
    const existing = await prisma.attendanceLocation.findUnique({ where: { id } });
    if (!existing) throw new Error("Lokasi absensi tidak ditemukan");
    const name = safe.name === undefined ? existing.name : safe.name.trim();
    if (!name || name.length > 100) throw new Error("Nama lokasi wajib diisi (maksimal 100 karakter)");
    const latitude = safe.latitude ?? existing.latitude;
    const longitude = safe.longitude ?? existing.longitude;
    assertCoordinates(latitude, longitude);
    const radiusMeter = safe.radiusMeter ?? existing.radiusMeter;
    assertRadius(radiusMeter);
    if (safe.isActive !== undefined && typeof safe.isActive !== "boolean") throw new Error("isActive harus boolean");
    return prisma.attendanceLocation.update({ where: { id }, data: { ...safe, name, latitude, longitude, radiusMeter } });
  }

  static async delete(id: string) {
    return prisma.attendanceLocation.delete({ where: { id } });
  }

  static async findNearestValid(latitude: number, longitude: number): Promise<{ location: any; distance: number } | null> {
    const locations = await prisma.attendanceLocation.findMany({ where: { isActive: true } });
    for (const loc of locations) {
      const distance = calculateDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
      if (distance <= loc.radiusMeter) {
        return { location: loc, distance };
      }
    }
    return null;
  }
}

// ============================================
// TASK CATEGORY CONFIG
// ============================================

export class TaskCategoryConfigService {
  static async getAll() {
    return prisma.taskCategoryConfig.findMany({ orderBy: { name: "asc" } });
  }

  static async getActive() {
    return prisma.taskCategoryConfig.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  static async create(data: { name: string; description?: string; defaultPoints?: number; isEvidenceRequired?: boolean }) {
    return prisma.taskCategoryConfig.create({ data });
  }

  static async update(id: string, data: { name?: string; description?: string; defaultPoints?: number; isEvidenceRequired?: boolean; isActive?: boolean }) {
    return prisma.taskCategoryConfig.update({ where: { id }, data });
  }

  static async delete(id: string) {
    return prisma.taskCategoryConfig.delete({ where: { id } });
  }
}

// ============================================
// SHIFT SCHEDULE (Date-specific assignments)
// ============================================

export class ShiftScheduleService {
  private static async getWeeklyPlannerContext(weekStart: string, shiftId: string, requestedRooms: Array<{ labId: string; requiredAssistantCount?: number }>) {
    const activePicketWeekdays = await AttendanceSettingsService.getActivePicketWeekdays();
    const dates = getWeeklyDates(weekStart, activePicketWeekdays);
    const start = dateOnly(dates[0]);
    const end = dateOnly(dates[dates.length - 1]);
    const [shift, rooms, assistants, existingSchedules, history] = await Promise.all([
      prisma.shift.findUnique({
        where: { id: shiftId, isActive: true },
        select: { id: true, name: true, startTime: true, endTime: true },
      }),
      prisma.lab.findMany({
        where: { id: { in: requestedRooms.map(({ labId }) => labId) }, status: "ACTIVE", isPicketEnabled: true },
        select: { id: true, name: true, defaultPicketAssistantCount: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: { in: ["ASISTEN_LAB", "MAGANG"] }, isActive: true },
        select: { id: true, name: true, nim: true },
        orderBy: { name: "asc" },
      }),
      prisma.asLabShiftSchedule.findMany({
        where: { scheduleDate: { gte: start, lte: end }, status: "SCHEDULED" },
        select: { userId: true, scheduleDate: true },
      }),
      prisma.asLabShiftSchedule.findMany({
        where: { status: { not: "CANCELLED" }, scheduleDate: { lt: start }, labId: { not: null } },
        select: { userId: true, labId: true },
      }),
    ]);

    if (!shift) throw new WeeklyPlannerError("Shift tidak ditemukan", [{ field: "shiftId" }]);
    if (rooms.length !== requestedRooms.length) {
      const enabledLabIds = new Set(rooms.map(({ id }) => id));
      throw new WeeklyPlannerError("rooms hanya boleh memuat Lab ACTIVE yang diaktifkan untuk piket", requestedRooms
        .filter(({ labId }) => !enabledLabIds.has(labId))
        .map(({ labId }) => ({ field: "rooms.labId", labId })));
    }

    const requestedByLabId = new Map(requestedRooms.map((room) => [room.labId, room]));
    const configuredRooms = rooms.map((room) => ({
      ...room,
      requiredAssistantCount: requestedByLabId.get(room.id)?.requiredAssistantCount ?? room.defaultPicketAssistantCount,
    }));
    const assistantsRequiredPerDay = configuredRooms.reduce((sum, room) => sum + room.requiredAssistantCount, 0);
    if (assistants.length < assistantsRequiredPerDay) {
      throw new WeeklyPlannerError(`Petugas aktif tidak cukup; diperlukan ${assistantsRequiredPerDay} per hari`, [{ field: "rooms" }]);
    }

    const unavailableByDate = new Map<string, Set<string>>();
    for (const schedule of existingSchedules) {
      const date = schedule.scheduleDate.toISOString().slice(0, 10);
      const users = unavailableByDate.get(date) ?? new Set<string>();
      users.add(schedule.userId);
      unavailableByDate.set(date, users);
    }

    const historyCounts = new Map<string, number>();
    for (const schedule of history) {
      const key = `${schedule.userId}:${schedule.labId}`;
      historyCounts.set(key, (historyCounts.get(key) ?? 0) + 1);
    }

    return { dates, shift, rooms: configuredRooms, assistants, unavailableByDate, historyCounts, activePicketWeekdays };
  }

  static async getAll(filters?: { date?: string; month?: string; userId?: string; destination?: AsLabPicketDestination; labId?: string; status?: ShiftScheduleStatus }) {
    const where: any = {};
    if (filters?.date) {
      where.scheduleDate = new Date(filters.date);
    } else if (filters?.month) {
      const { start, end } = getMonthRange(filters.month);
      where.scheduleDate = { gte: start, lte: end };
    }
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.destination) where.destination = filters.destination;
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.status) where.status = filters.status;

    return prisma.asLabShiftSchedule.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, nim: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { scheduleDate: "asc" },
    });
  }

  static async getMySchedules(userId: string, filters?: { month?: string; from?: string; to?: string }) {
    const where: any = { userId };
    if (filters?.from && filters?.to) {
      where.scheduleDate = { gte: dateOnly(filters.from), lte: dateOnly(filters.to) };
    } else if (filters?.month) {
      const { start, end } = getMonthRange(filters.month);
      where.scheduleDate = { gte: start, lte: end };
    }
    return prisma.asLabShiftSchedule.findMany({
      where,
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, lateToleranceMinutes: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { scheduleDate: "asc" },
    });
  }

  static async getTodaySchedule(userId: string, now = new Date()) {
    const today = dateOnly(getJakartaDateParts(now).date);
    const schedules = await prisma.asLabShiftSchedule.findMany({
      where: {
        userId,
        scheduleDate: today,
        status: "SCHEDULED",
      },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, lateToleranceMinutes: true, checkoutGraceMinutes: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: [{ id: "asc" }],
    });
    return pickTodaySchedule(schedules, now);
  }

  static async getUpcomingPicketReminders(now: Date, leadMinutes: number) {
    const scheduleDate = dateOnly(getJakartaDateParts(now).date);

    const schedules = await prisma.asLabShiftSchedule.findMany({
      where: { scheduleDate, status: "SCHEDULED" },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        lab: { select: { id: true, name: true } },
      },
    });

    const attendances = await prisma.attendance.findMany({
      where: { shiftScheduleId: { in: schedules.map((schedule) => schedule.id) } },
      select: { shiftScheduleId: true },
    });
    const checkedInScheduleIds = new Set(attendances.flatMap((attendance) => attendance.shiftScheduleId ? [attendance.shiftScheduleId] : []));

    return schedules.filter((schedule) => {
      if (checkedInScheduleIds.has(schedule.id)) return false;
      const window = evaluateShiftWindow(now, schedule.shift.startTime, schedule.shift.endTime, 0, schedule.scheduleDate);
      const minutesUntilStart = (window.startsAt.getTime() - now.getTime()) / 60_000;
      return minutesUntilStart >= leadMinutes - 1 && minutesUntilStart <= leadMinutes + 1;
    });
  }

  static async create(data: { userId: string; destination: AsLabPicketDestination; shiftId: string; scheduleDate: string; assignedBy: string; notes?: string }) {
    const activeShift = await prisma.shift.findUnique({ where: { id: data.shiftId, isActive: true }, select: { id: true } });
    if (!activeShift) throw new Error("Shift tidak ditemukan atau sudah tidak aktif");
    const eligibleUser = await prisma.user.findFirst({
      where: { id: data.userId, role: { in: ["ASISTEN_LAB", "MAGANG"] }, isActive: true },
      select: { id: true },
    });
    if (!eligibleUser) throw new Error("User tujuan harus Asisten Lab atau Magang aktif");
    const existing = await prisma.asLabShiftSchedule.findFirst({
      where: {
        userId: data.userId,
        scheduleDate: new Date(data.scheduleDate),
        status: "SCHEDULED",
      },
    });
    if (existing) throw new Error("Petugas sudah memiliki jadwal shift pada tanggal tersebut");

    const schedule = await prisma.asLabShiftSchedule.create({
      data: {
        userId: data.userId,
        destination: data.destination,
        shiftId: data.shiftId,
        scheduleDate: new Date(data.scheduleDate),
        assignedBy: data.assignedBy,
        notes: data.notes,
      },
      include: {
        user: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      },
    });

    await notificationService.notifyShiftAssigned({
      userId: data.userId,
      destinationLabel: picketDestinationLabels[data.destination],
      scheduleDate: data.scheduleDate,
      shiftName: schedule.shift.name ?? `${schedule.shift.startTime} - ${schedule.shift.endTime}`,
    });

    return schedule;
  }

  static async bulkCreate(data: { userId: string; destination: AsLabPicketDestination; shiftId: string; dates: string[]; assignedBy: string; notes?: string }) {
    const results = [];
    for (const date of data.dates) {
      try {
        const schedule = await this.create({
          userId: data.userId,
          destination: data.destination,
          shiftId: data.shiftId,
          scheduleDate: date,
          assignedBy: data.assignedBy,
          notes: data.notes,
        });
        results.push(schedule);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Petugas sudah memiliki jadwal shift")) {
          throw error;
        }
      }
    }
    return results;
  }

  static async previewWeeklyPlan(data: WeeklyShiftPreviewInput) {
    const context = await this.getWeeklyPlannerContext(data.weekStart, data.shiftId, data.rooms);
    const draft: WeeklyAssignment[] = [];
    const draftCounts = new Map(context.historyCounts);

    for (const date of context.dates) {
      const usedToday = new Set<string>();
      for (const room of context.rooms) {
        const candidates = context.assistants
          .filter((assistant) => !usedToday.has(assistant.id) && !context.unavailableByDate.get(date)?.has(assistant.id))
          .map((assistant) => ({
            assistant,
            count: draftCounts.get(`${assistant.id}:${room.id}`) ?? 0,
            tieBreaker: Math.random(),
          }))
          .sort((left, right) => left.count - right.count || left.tieBreaker - right.tieBreaker);

        if (candidates.length < room.requiredAssistantCount) {
          throw new WeeklyPlannerError("Petugas tanpa konflik tidak cukup untuk melengkapi jadwal", [{ date, labId: room.id }]);
        }

        const userIds = candidates.slice(0, room.requiredAssistantCount).map(({ assistant }) => assistant.id);
        userIds.forEach((userId) => {
          usedToday.add(userId);
          const countKey = `${userId}:${room.id}`;
          draftCounts.set(countKey, (draftCounts.get(countKey) ?? 0) + 1);
        });
        draft.push({ date, labId: room.id, requiredAssistantCount: room.requiredAssistantCount, userIds });
      }
    }

    const assistantsById = new Map(context.assistants.map((assistant) => [assistant.id, assistant]));
    return {
      weekStart: data.weekStart,
      dates: context.dates,
      shift: context.shift,
      rooms: context.rooms,
      assignments: draft.map((assignment) => ({
        ...assignment,
        users: assignment.userIds.map((userId) => assistantsById.get(userId)),
      })),
    };
  }

  static async saveWeeklyPlan(data: WeeklyShiftPlanInput, assignedBy: string) {
    const assignments: WeeklyAssignment[] = data.assignments;
    const labIds = [...new Set(assignments.map((assignment) => assignment.labId))];
    const activePicketWeekdays = await AttendanceSettingsService.getActivePicketWeekdays();
    validateWeeklyGroups(data.weekStart, activePicketWeekdays, assignments, labIds);
    const dates = getWeeklyDates(data.weekStart, activePicketWeekdays);
    const userIds = [...new Set(assignments.flatMap((assignment) => assignment.userIds))];
    const requestedUserDates = new Set(
      assignments.flatMap((assignment) => assignment.userIds.map((userId) => `${userId}:${assignment.date}`)),
    );

    const schedules = await prisma.$transaction(async (tx) => {
      const [shift, labs, activeUsers, conflicts] = await Promise.all([
        tx.shift.findUnique({ where: { id: data.shiftId, isActive: true }, select: { id: true } }),
        tx.lab.findMany({
          where: { id: { in: labIds }, status: "ACTIVE", isPicketEnabled: true },
          select: { id: true, name: true },
        }),
        tx.user.findMany({
          where: { id: { in: userIds }, role: { in: ["ASISTEN_LAB", "MAGANG"] }, isActive: true },
          select: { id: true },
        }),
        tx.asLabShiftSchedule.findMany({
          where: {
            userId: { in: userIds },
            scheduleDate: { gte: dateOnly(dates[0]), lte: dateOnly(dates[dates.length - 1]) },
            status: "SCHEDULED",
          },
          select: { userId: true, scheduleDate: true },
        }),
      ]);

      if (!shift) throw new WeeklyPlannerError("Shift tidak ditemukan", [{ field: "shiftId" }]);
      if (labs.length !== labIds.length) {
        const enabledLabIds = new Set(labs.map(({ id }) => id));
        throw new WeeklyPlannerError("assignments hanya boleh memuat Lab ACTIVE yang diaktifkan untuk piket", labIds
          .filter((labId) => !enabledLabIds.has(labId))
          .map((labId) => ({ field: "assignments.labId", labId })));
      }
      const activeUserIds = new Set(activeUsers.map((user) => user.id));
      const invalidUserIds = userIds.filter((userId) => !activeUserIds.has(userId));
      if (invalidUserIds.length > 0) {
        throw new WeeklyPlannerError("assignments memuat user yang bukan petugas aktif", [{ field: "assignments.userIds", userIds: invalidUserIds }]);
      }
       const matchingConflicts = conflicts.filter((conflict) =>
         requestedUserDates.has(`${conflict.userId}:${conflict.scheduleDate.toISOString().slice(0, 10)}`),
       );
       if (matchingConflicts.length > 0) {
          throw new WeeklyPlannerError("Satu atau lebih petugas sudah memiliki jadwal pada tanggal yang sama", matchingConflicts.map((conflict) => ({
           date: conflict.scheduleDate.toISOString().slice(0, 10),
           userIds: [conflict.userId],
         })));
      }

      await tx.asLabShiftSchedule.createMany({
        data: assignments.flatMap((assignment) => assignment.userIds.map((userId) => ({
          userId,
          destination: null,
          labId: assignment.labId,
          shiftId: data.shiftId,
          scheduleDate: dateOnly(assignment.date),
          assignedBy,
          notes: data.notes,
        }))),
      });

      return tx.asLabShiftSchedule.findMany({
        where: {
          userId: { in: userIds },
          shiftId: data.shiftId,
          scheduleDate: { gte: dateOnly(dates[0]), lte: dateOnly(dates[dates.length - 1]) },
          status: "SCHEDULED",
        },
        include: {
          user: { select: { id: true, name: true, nim: true } },
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          lab: { select: { id: true, name: true } },
        },
        orderBy: [{ scheduleDate: "asc" }, { labId: "asc" }, { userId: "asc" }],
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const notificationErrors: Array<{ userId: string; message: string }> = [];
    for (const schedule of schedules) {
      try {
        await notificationService.notifyShiftAssigned({
          userId: schedule.userId,
          destinationLabel: schedule.lab?.name ?? (schedule.destination ? picketDestinationLabels[schedule.destination] : "Lab"),
          scheduleDate: schedule.scheduleDate.toISOString().slice(0, 10),
          shiftName: schedule.shift.name ?? `${schedule.shift.startTime} - ${schedule.shift.endTime}`,
        });
      } catch (error) {
        notificationErrors.push({
          userId: schedule.userId,
          message: error instanceof Error ? error.message : "Notifikasi gagal dikirim",
        });
      }
    }

    return { schedules, notificationErrors };
  }

  static async getRecurringPattern() {
    const pattern = await prisma.asLabPicketPattern.findFirst({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        creator: { select: { id: true, name: true } },
        assignments: {
          include: { lab: { select: { id: true, name: true } }, user: { select: { id: true, name: true, nim: true } } },
          orderBy: [{ weekday: "asc" }, { labId: "asc" }, { userId: "asc" }],
        },
      },
    });
    return { pattern, horizon: pattern ? { start: pattern.horizonStart, end: pattern.horizonEnd, weeks: 8 } : null };
  }

  static async maintainRecurringPicketHorizon(): Promise<{ createdCount: number; skippedDates: string[] }> {
    const today = new Date();
    const currentMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    currentMonday.setUTCDate(currentMonday.getUTCDate() - ((currentMonday.getUTCDay() + 6) % 7));

    const [pattern, nextPattern] = await Promise.all([
      prisma.asLabPicketPattern.findFirst({
        where: { effectiveFrom: { lte: currentMonday }, shift: { isActive: true } },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        include: {
          shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          assignments: {
            include: { lab: { select: { id: true, name: true } } },
            orderBy: [{ weekday: "asc" }, { labId: "asc" }, { userId: "asc" }],
          },
        },
      }),
      prisma.asLabPicketPattern.findFirst({
        where: { effectiveFrom: { gt: currentMonday } },
        orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
        select: { effectiveFrom: true },
      }),
    ]);
    if (!pattern) return { createdCount: 0, skippedDates: [] };

    const activePicketWeekdays = normalizeActivePicketWeekdays(pattern.activePicketWeekdays);
    const templateDates = getWeeklyDates(currentMonday.toISOString().slice(0, 10), activePicketWeekdays);
    const dateByWeekday = new Map(activePicketWeekdays.map((weekday, index) => [weekday, templateDates[index]]));
    const groupedTemplate = new Map<string, WeeklyAssignment>();
    for (const assignment of pattern.assignments) {
      const date = dateByWeekday.get(assignment.weekday);
      if (!date) continue;
      const key = `${date}:${assignment.labId}`;
      const group = groupedTemplate.get(key) ?? {
        date,
        labId: assignment.labId,
        requiredAssistantCount: assignment.requiredAssistantCount,
        userIds: [],
      };
      group.userIds.push(assignment.userId);
      groupedTemplate.set(key, group);
    }
    const templateAssignments = [...groupedTemplate.values()];
    if (templateAssignments.length === 0) return { createdCount: 0, skippedDates: [] };
    const labNames = new Map(pattern.assignments.map((assignment) => [assignment.labId, assignment.lab.name]));

    const horizon = getRecurringHorizon(currentMonday.toISOString().slice(0, 10));
    const cappedEnd = nextPattern
      ? new Date(nextPattern.effectiveFrom.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : horizon.end;
    if (cappedEnd < horizon.start) return { createdCount: 0, skippedDates: [] };

    const materialized = materializeRecurringAssignments(horizon.start, activePicketWeekdays, templateAssignments)
      .filter((assignment) => assignment.date <= cappedEnd);
    const labIds = [...new Set(materialized.map((assignment) => assignment.labId))];
    const userIds = [...new Set(materialized.flatMap((assignment) => assignment.userIds))];
    const expectedByDate = new Map<string, WeeklyAssignment[]>();
    for (const assignment of materialized) {
      const rows = expectedByDate.get(assignment.date) ?? [];
      rows.push(assignment);
      expectedByDate.set(assignment.date, rows);
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.asLabShiftSchedule.findMany({
        where: {
          scheduleDate: { gte: dateOnly(horizon.start), lte: dateOnly(cappedEnd) },
          status: "SCHEDULED",
          OR: [{ userId: { in: userIds } }, { labId: { in: labIds } }],
        },
        select: { userId: true, labId: true, scheduleDate: true, patternId: true },
      });
      const existingByDate = new Map<string, typeof existing>();
      for (const row of existing) {
        const date = row.scheduleDate.toISOString().slice(0, 10);
        const rows = existingByDate.get(date) ?? [];
        rows.push(row);
        existingByDate.set(date, rows);
      }

      const data: Array<{ userId: string; destination: null; labId: string; shiftId: string; scheduleDate: Date; assignedBy: string; notes: string | null; patternId: string }> = [];
      const skippedDates: string[] = [];
      for (const [date, assignments] of expectedByDate) {
        const existingRows = existingByDate.get(date) ?? [];
        const expectedSlots = new Set(assignments.flatMap((assignment) => assignment.userIds.map((userId) => `${userId}:${assignment.labId}`)));
        const existingSlots = new Set(existingRows.map((row) => `${row.userId}:${row.labId ?? ""}`));
        const complete = expectedSlots.size > 0 && [...expectedSlots].every((slot) => existingSlots.has(slot));
        if (complete) continue;
        if (existingRows.length > 0) {
          skippedDates.push(date);
          continue;
        }
        data.push(...assignments.flatMap((assignment) => assignment.userIds.map((userId) => ({
          userId,
          destination: null,
          labId: assignment.labId,
          shiftId: pattern.shiftId,
          scheduleDate: dateOnly(date),
          assignedBy: pattern.createdBy,
          notes: pattern.notes,
          patternId: pattern.id,
        }))));
      }
      if (data.length > 0) await tx.asLabShiftSchedule.createMany({ data });
      if (cappedEnd > pattern.horizonEnd.toISOString().slice(0, 10)) {
        await tx.asLabPicketPattern.update({ where: { id: pattern.id }, data: { horizonEnd: dateOnly(cappedEnd) } });
      }
      return { data, skippedDates };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    for (const schedule of result.data) {
      try {
        await notificationService.notifyShiftAssigned({
          userId: schedule.userId,
          destinationLabel: labNames.get(schedule.labId) ?? "Lab",
          scheduleDate: schedule.scheduleDate.toISOString().slice(0, 10),
          shiftName: pattern.shift.name ?? `${pattern.shift.startTime} - ${pattern.shift.endTime}`,
        });
      } catch (error) {
        console.error("[Recurring Picket] Failed to notify assignment", error);
      }
    }
    return { createdCount: result.data.length, skippedDates: result.skippedDates };
  }

  static async saveRecurringPlan(data: RecurringShiftPlanInput, assignedBy: string) {
    const today = new Date();
    const currentMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    currentMonday.setUTCDate(currentMonday.getUTCDate() - ((currentMonday.getUTCDay() + 6) % 7));
    if (dateOnly(data.effectiveFrom) < currentMonday) {
      throw new WeeklyPlannerError("effectiveFrom tidak boleh minggu lalu", [{ field: "effectiveFrom" }]);
    }
    const activePicketWeekdays = await AttendanceSettingsService.getActivePicketWeekdays();
    const labIds = [...new Set(data.assignments.map(({ labId }) => labId))];
    validateWeeklyGroups(data.effectiveFrom, activePicketWeekdays, data.assignments, labIds);
    const materialized = materializeRecurringAssignments(data.effectiveFrom, activePicketWeekdays, data.assignments);
    const horizon = getRecurringHorizon(data.effectiveFrom);
    const userIds = [...new Set(materialized.flatMap(({ userIds }) => userIds))];
    const requestedUserDates = new Set(materialized.flatMap((assignment) => assignment.userIds.map((userId) => `${userId}:${assignment.date}`)));

    const result = await prisma.$transaction(async (tx) => {
      const [shift, labs, activeUsers, conflicts] = await Promise.all([
        tx.shift.findUnique({ where: { id: data.shiftId, isActive: true }, select: { id: true, name: true, startTime: true, endTime: true } }),
        tx.lab.findMany({ where: { id: { in: labIds }, status: "ACTIVE", isPicketEnabled: true }, select: { id: true, name: true } }),
        tx.user.findMany({ where: { id: { in: userIds }, role: { in: ["ASISTEN_LAB", "MAGANG"] }, isActive: true }, select: { id: true } }),
        tx.asLabShiftSchedule.findMany({
          where: {
            userId: { in: userIds }, scheduleDate: { gte: dateOnly(horizon.start), lte: dateOnly(horizon.end) },
          },
          select: { userId: true, scheduleDate: true, status: true, patternId: true },
        }),
      ]);
      if (!shift) throw new WeeklyPlannerError("Shift tidak ditemukan", [{ field: "shiftId" }]);
      if (labs.length !== labIds.length) throw new WeeklyPlannerError("assignments hanya boleh memuat Lab ACTIVE yang diaktifkan untuk piket", [{ field: "assignments.labId" }]);
      const activeUserIds = new Set(activeUsers.map(({ id }) => id));
      const invalidUserIds = userIds.filter((id) => !activeUserIds.has(id));
      if (invalidUserIds.length) throw new WeeklyPlannerError("assignments memuat user yang bukan petugas aktif", [{ field: "assignments.userIds", userIds: invalidUserIds }]);
      const matchingConflicts = conflicts.filter((row) =>
        requestedUserDates.has(`${row.userId}:${row.scheduleDate.toISOString().slice(0, 10)}`)
        && !(row.patternId !== null && row.status === "SCHEDULED" && row.scheduleDate >= dateOnly(data.effectiveFrom)),
      );
      if (matchingConflicts.length) throw new WeeklyPlannerError("Satu atau lebih petugas memiliki jadwal yang tidak dapat diganti", matchingConflicts.map((row) => ({ date: row.scheduleDate.toISOString().slice(0, 10), userIds: [row.userId] })));

      const replaceWhere = { patternId: { not: null }, status: "SCHEDULED" as const, scheduleDate: { gte: dateOnly(data.effectiveFrom), lte: dateOnly(horizon.end) } };
      const linkedSchedules = await tx.attendance.count({ where: { shiftSchedule: { is: replaceWhere } } });
      if (linkedSchedules > 0) throw new WeeklyPlannerError("Pola tidak dapat diganti karena jadwal sudah memiliki data absensi", [{ field: "effectiveFrom" }]);
      await tx.asLabShiftSchedule.deleteMany({ where: replaceWhere });
      const pattern = await tx.asLabPicketPattern.create({
        data: {
          effectiveFrom: dateOnly(data.effectiveFrom), horizonStart: dateOnly(horizon.start), horizonEnd: dateOnly(horizon.end),
          activePicketWeekdays, shiftId: data.shiftId, createdBy: assignedBy, notes: data.notes,
        },
      });
      await tx.asLabPicketPatternAssignment.createMany({
        data: data.assignments.flatMap((assignment) => assignment.userIds.map((userId) => ({
          patternId: pattern.id, weekday: new Date(`${assignment.date}T00:00:00.000Z`).getUTCDay(), labId: assignment.labId,
          requiredAssistantCount: assignment.requiredAssistantCount, userId,
        }))),
      });
      await tx.asLabShiftSchedule.createMany({
        data: materialized.flatMap((assignment) => assignment.userIds.map((userId) => ({
          userId, destination: null, labId: assignment.labId, shiftId: data.shiftId, scheduleDate: dateOnly(assignment.date),
          assignedBy, notes: data.notes, patternId: pattern.id,
        }))),
      });
      const schedules = await tx.asLabShiftSchedule.findMany({
        where: { patternId: pattern.id },
        include: { user: { select: { id: true, name: true, nim: true } }, shift: { select: { id: true, name: true, startTime: true, endTime: true } }, lab: { select: { id: true, name: true } } },
        orderBy: [{ scheduleDate: "asc" }, { labId: "asc" }, { userId: "asc" }],
      });
      return { pattern, schedules, shift };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const notificationErrors: Array<{ userId: string; message: string }> = [];
    for (const schedule of result.schedules) {
      try {
        await notificationService.notifyShiftAssigned({ userId: schedule.userId, destinationLabel: schedule.lab?.name ?? "Lab", scheduleDate: schedule.scheduleDate.toISOString().slice(0, 10), shiftName: result.shift.name ?? `${result.shift.startTime} - ${result.shift.endTime}` });
      } catch (error) {
        notificationErrors.push({ userId: schedule.userId, message: error instanceof Error ? error.message : "Notifikasi gagal dikirim" });
      }
    }
    return { createdCount: result.schedules.length, horizon: { ...horizon, weeks: 8 }, pattern: result.pattern, schedules: result.schedules, notificationErrors };
  }

  static async update(id: string, data: { status?: ShiftScheduleStatus; notes?: string; destination?: AsLabPicketDestination }) {
    const safe = pickShiftScheduleUpdate(data as Record<string, unknown>) as typeof data;
    if (safe.status !== undefined && !Object.values(ShiftScheduleStatus).includes(safe.status)) throw new Error("Status jadwal tidak valid");
    if (safe.destination !== undefined && !Object.values(AsLabPicketDestination).includes(safe.destination)) throw new Error("Tujuan piket tidak valid");
    if (safe.notes !== undefined && (typeof safe.notes !== "string" || safe.notes.length > 1000)) throw new Error("Catatan jadwal maksimal 1000 karakter");
    return prisma.asLabShiftSchedule.update({ where: { id }, data: safe });
  }

  static async delete(id: string) {
    return prisma.$transaction(async (tx) => {
      const linked = await tx.attendance.count({ where: { shiftScheduleId: id } });
      if (linked > 0) throw new Error("Jadwal tidak dapat dihapus karena sudah memiliki data absensi");
      return tx.asLabShiftSchedule.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async deleteWeek(weekStart: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw new Error("weekStart harus format YYYY-MM-DD");
    }
    const monday = new Date(`${weekStart}T00:00:00.000Z`);
    if (Number.isNaN(monday.getTime()) || monday.getUTCDay() !== 1) {
      throw new Error("weekStart harus hari Senin");
    }
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);

    const result = await prisma.$transaction(async (tx) => {
      const where = { status: "SCHEDULED" as const, scheduleDate: { gte: monday, lte: sunday } };
      const linked = await tx.attendance.count({ where: { shiftSchedule: { is: where } } });
      if (linked > 0) throw new Error("Jadwal minggu tidak dapat dihapus karena sudah memiliki data absensi");
      return tx.asLabShiftSchedule.deleteMany({ where });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      deletedCount: result.count,
      weekStart,
      weekEnd: sunday.toISOString().slice(0, 10),
    };
  }

  static async deleteRecurringPattern(patternId?: string) {
    const pattern = patternId
      ? await prisma.asLabPicketPattern.findUnique({ where: { id: patternId } })
      : await prisma.asLabPicketPattern.findFirst({
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        });
    if (!pattern) throw new Error("Pola piket berulang tidak ditemukan");

    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const result = await prisma.$transaction(async (tx) => {
      const futureWhere = {
        patternId: pattern.id,
        status: "SCHEDULED" as const,
        scheduleDate: { gte: todayDate },
      };
      const linked = await tx.attendance.count({ where: { shiftSchedule: { is: futureWhere } } });
      if (linked > 0) throw new Error("Pola tidak dapat dihapus karena jadwal mendatang sudah memiliki data absensi");
      const deletedFuture = await tx.asLabShiftSchedule.deleteMany({ where: futureWhere });

      await tx.asLabShiftSchedule.updateMany({
        where: { patternId: pattern.id },
        data: { patternId: null },
      });

      await tx.asLabPicketPatternAssignment.deleteMany({ where: { patternId: pattern.id } });
      await tx.asLabPicketPattern.delete({ where: { id: pattern.id } });

      return { deletedFutureCount: deletedFuture.count };
    });

    return {
      patternId: pattern.id,
      effectiveFrom: pattern.effectiveFrom.toISOString().slice(0, 10),
      deletedFutureCount: result.deletedFutureCount,
    };
  }
}

// ============================================
// ATTENDANCE (Check-in / Check-out)
// ============================================

export class AttendanceService {
  static async checkin(userId: string, latitude?: number, longitude?: number, qrToken?: string) {
    const settings = await AttendanceSettingsService.get();
    if (settings.isGeofencingEnabled) assertCoordinates(latitude, longitude);
    else if (latitude !== undefined || longitude !== undefined) assertCoordinates(latitude, longitude);

    const qrPayload = settings.isQrRequired ? AttendanceQrService.verify(qrToken || "") : undefined;
    let checkinLocationId: string | undefined;
    if (settings.isGeofencingEnabled) {
      const result = await AttendanceLocationService.findNearestValid(latitude as number, longitude as number);
      if (!result) throw new Error("Lokasi check-in di luar jangkauan area lab");
      checkinLocationId = result.location.id;
      if (qrPayload && qrPayload.locationId !== checkinLocationId) {
        throw new Error("QR absensi tidak sesuai dengan lokasi GPS saat ini");
      }
    }
    if (qrPayload) await AttendanceQrService.markUsed(qrPayload, userId);

    const now = new Date();
    try {
      return await prisma.$transaction(async (tx) => {
        const scheduleDate = dateOnly(getJakartaDateParts(now).date);
        const previousDate = new Date(scheduleDate);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);
        const schedules = await tx.asLabShiftSchedule.findMany({
          where: {
            userId,
            scheduleDate: { in: [previousDate, scheduleDate] },
            status: "SCHEDULED",
            shift: { isActive: true },
          },
          include: {
            shift: { select: { id: true, name: true, startTime: true, endTime: true, lateToleranceMinutes: true, checkoutGraceMinutes: true } },
            lab: { select: { id: true, name: true } },
          },
        });
        const eligible = schedules
          .map((schedule) => ({
            schedule,
            window: evaluateShiftWindow(
              now,
              schedule.shift.startTime,
              schedule.shift.endTime,
              schedule.shift.checkoutGraceMinutes ?? settings.checkoutGraceMinutes,
              schedule.scheduleDate,
            ),
          }))
          .filter(({ window }) => window.canCheckin)
          .sort((left, right) => right.window.startsAt.getTime() - left.window.startsAt.getTime());
        const selected = eligible[0];
        if (!selected) {
          const future = schedules.some((schedule) => evaluateShiftWindow(
            now,
            schedule.shift.startTime,
            schedule.shift.endTime,
            schedule.shift.checkoutGraceMinutes ?? settings.checkoutGraceMinutes,
            schedule.scheduleDate,
          ).reason === "CHECKIN_NOT_OPEN");
          if (future) throw new Error("Check-in belum dibuka. Check-in tersedia maksimal 60 menit sebelum shift");
          throw new Error("Anda tidak memiliki jadwal piket aktif pada waktu ini");
        }
        const todaySchedule = selected.schedule;
        const window = selected.window;
        const existing = await tx.attendance.findFirst({ where: { shiftScheduleId: todaySchedule.id } });
        if (existing) throw new Error("Absensi untuk shift ini sudah tercatat");

        const tolerance = resolveLateTolerance(todaySchedule.shift.lateToleranceMinutes, settings.lateToleranceMinutes);
        const status: "CHECKED_IN" | "LATE" = now.getTime() > window.startsAt.getTime() + tolerance * 60_000 ? "LATE" : "CHECKED_IN";

        const created = await tx.attendance.create({
          data: {
            userId,
            shiftScheduleId: todaySchedule.id,
            checkinAt: now,
            checkinLatitude: latitude,
            checkinLongitude: longitude,
            checkinLocationId,
            status,
          },
          include: {
            shiftSchedule: { include: { shift: { select: { name: true, startTime: true, endTime: true } } } },
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "ATTENDANCE_CHECKIN",
            targetType: "Attendance",
            targetId: created.id,
            description: `Check-in shift ${todaySchedule.shift.name}`,
          },
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Absensi untuk shift ini sudah tercatat");
      }
      throw error;
    }
  }

  static async checkout(userId: string, latitude?: number, longitude?: number, qrToken?: string) {
    const attendance = await prisma.attendance.findFirst({
      where: { userId, checkoutAt: null, checkinAt: { not: null }, status: { in: ["CHECKED_IN", "LATE"] } },
      include: { shiftSchedule: { include: { shift: true } } },
      orderBy: { checkinAt: "desc" },
    });
    if (!attendance) throw new Error("Belum check-in atau sudah check-out");

    const settings = await AttendanceSettingsService.get();
    if (settings.isGeofencingEnabled) assertCoordinates(latitude, longitude);
    else if (latitude !== undefined || longitude !== undefined) assertCoordinates(latitude, longitude);

    const qrPayload = settings.isQrRequired ? AttendanceQrService.verify(qrToken || "") : undefined;
    let checkoutLocationId: string | undefined;
    if (settings.isGeofencingEnabled) {
      const result = await AttendanceLocationService.findNearestValid(latitude as number, longitude as number);
      if (!result) throw new Error("Lokasi checkout di luar jangkauan area lab");
      checkoutLocationId = result.location.id;
      if (qrPayload && qrPayload.locationId !== checkoutLocationId) {
        throw new Error("QR absensi tidak sesuai dengan lokasi GPS saat ini");
      }
    }
    const checkoutAt = new Date();
    const shiftSchedule = attendance.shiftSchedule;
    const shift = shiftSchedule?.shift;
    if (!shift || !shiftSchedule) throw new Error("Jadwal shift untuk absensi ini tidak ditemukan. Hubungi koordinator");
    const checkoutGrace = shift.checkoutGraceMinutes ?? settings.checkoutGraceMinutes;
    const window = evaluateShiftWindow(checkoutAt, shift.startTime, shift.endTime, checkoutGrace, shiftSchedule.scheduleDate);
    if (!window.canCheckout) {
      throw new Error("Batas waktu check-out untuk shift ini sudah berakhir. Ajukan koreksi kepada koordinator");
    }
    if (settings.isTaskRequired && shift.isTaskRequired) {
      const taskCount = await prisma.dailyTaskLog.count({ where: { attendanceId: attendance.id } });
      if (taskCount === 0) throw new Error("Minimal satu task harian wajib diisi sebelum check-out");
    }
    if (qrPayload) await AttendanceQrService.markUsed(qrPayload, userId);

    const workDurationMinutes = attendance.checkinAt
      ? Math.max(0, Math.round((checkoutAt.getTime() - attendance.checkinAt.getTime()) / 60000))
      : 0;
    const finalStatus = settings.isVerificationRequired ? "WAITING_VERIFICATION" : "CHECKED_OUT";

    return prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.updateMany({
        where: { id: attendance.id, checkoutAt: null },
        data: {
          checkoutAt,
          checkoutLatitude: latitude,
          checkoutLongitude: longitude,
          checkoutLocationId,
          workDurationMinutes,
          status: finalStatus as any,
        },
      });
      if (updated.count !== 1) throw new Error("Absensi sudah di-check-out dari perangkat lain");
      await tx.auditLog.create({
        data: {
          userId,
          action: "ATTENDANCE_CHECKOUT",
          targetType: "Attendance",
          targetId: attendance.id,
          description: `Check-out shift ${shift.name}`,
        },
      });
      // The guarded update above means this transaction is the sole successful
      // checkout transition. Award only after completion, never at check-in.
      if (finalStatus === "CHECKED_OUT") {
        const awards = attendancePointAwards({
          attendanceId: attendance.id,
          status: finalStatus,
          checkedInStatus: attendance.status,
        });
        for (const award of awards) {
          await tx.point.create({
            data: { userId, amount: award.amount, reason: award.reason, referenceId: award.referenceId },
          });
        }
      }
      return tx.attendance.findUniqueOrThrow({ where: { id: attendance.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async getMyAttendance(userId: string, month?: string, page = 1, limit = 20) {
    page = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    limit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
    const where: any = { userId };
    if (month) {
      const { start, end } = getMonthRange(month);
      where.createdAt = { gte: start, lte: end };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        include: {
          shiftSchedule: {
            include: {
              shift: { select: { name: true, startTime: true, endTime: true } },
            },
          },
          dailyTasks: { select: { id: true, task: true, status: true, category: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return { items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getAllAttendance(filters?: { date?: string; status?: string; userId?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (filters?.date) {
      const d = new Date(filters.date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: d, lte: end };
    }
    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.userId = filters.userId;

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? Math.min(Math.floor(filters.limit), 100) : 20;
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.attendance.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, nim: true } },
          shiftSchedule: {
            include: {
              shift: { select: { name: true, startTime: true, endTime: true } },
            },
          },
          dailyTasks: { select: { id: true, task: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return { items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async getTodayMonitoring() {
    const { start, end } = getTodayRange();

    const [attendances, totalAslab, todaySchedules] = await Promise.all([
      prisma.attendance.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          user: { select: { id: true, name: true, nim: true } },
          shiftSchedule: {
            include: {
              shift: { select: { name: true, startTime: true, endTime: true } },
            },
          },
          dailyTasks: { select: { id: true, task: true, status: true } },
        },
        orderBy: { checkinAt: "asc" },
      }),
      prisma.user.count({ where: { role: { in: ["ASISTEN_LAB", "MAGANG"] }, isActive: true } }),
      prisma.asLabShiftSchedule.findMany({
        where: { scheduleDate: start, status: "SCHEDULED" },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const checkedIn = attendances.filter((a) => a.status === "CHECKED_IN" || a.status === "LATE");
    const late = attendances.filter((a) => a.status === "LATE");
    const checkedOut = attendances.filter((a) => a.checkoutAt !== null);
    const forgotCheckout = attendances.filter((a) => a.status === "FORGOT_CHECKOUT");
    const waitingVerification = attendances.filter((a) => a.status === "WAITING_VERIFICATION");

    const checkedInUserIds = attendances.map((a) => a.userId);
    const notCheckedIn = todaySchedules.filter((s) => !checkedInUserIds.includes(s.userId));

    return {
      summary: {
        totalAslab,
        checkedIn: checkedIn.length,
        notCheckedIn: notCheckedIn.length,
        late: late.length,
        checkedOut: checkedOut.length,
        forgotCheckout: forgotCheckout.length,
        waitingVerification: waitingVerification.length,
      },
      attendances,
      notCheckedInAslab: notCheckedIn.map((s) => s.user),
    };
  }

  static async verifyAttendance(attendanceId: string, verifierId: string, action: "APPROVED" | "REJECTED", notes?: string) {
    const cleanNotes = notes?.trim();
    if (action === "REJECTED" && !cleanNotes) throw new Error("Catatan wajib diisi saat menolak absensi");
    return prisma.$transaction(async (tx) => {
      const verifiedAt = new Date();
      const updated = await tx.attendance.updateMany({
        where: { id: attendanceId, status: "WAITING_VERIFICATION" },
        data: {
          status: action,
          verifiedBy: verifierId,
          verifiedAt,
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        },
      });
      if (updated.count !== 1) {
        const exists = await tx.attendance.count({ where: { id: attendanceId } });
        throw new Error(exists ? "Attendance tidak dalam status menunggu verifikasi" : "Attendance tidak ditemukan");
      }
      await tx.auditLog.create({
        data: {
          userId: verifierId,
          action: action === "APPROVED" ? "ATTENDANCE_APPROVED" : "ATTENDANCE_REJECTED",
          targetType: "Attendance",
          targetId: attendanceId,
          description: cleanNotes || `Absensi ${action === "APPROVED" ? "disetujui" : "ditolak"}`,
        },
      });
      return tx.attendance.findUniqueOrThrow({ where: { id: attendanceId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async getAttendanceStats(userId?: string, month?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (month) {
      const { start, end } = getMonthRange(month);
      where.createdAt = { gte: start, lte: end };
    }

    const rows = await prisma.attendance.findMany({ where });
    const totalDays = rows.length;
    const late = rows.filter((r) => r.status === "LATE").length;
    const presentOnly = rows.filter((r) =>
      r.status === "CHECKED_IN" ||
      r.status === "CHECKED_OUT" ||
      r.status === "APPROVED" ||
      r.status === "WAITING_VERIFICATION"
    ).length;
    const present = presentOnly + late;
    const absent = rows.filter((r) => r.status === "ABSENT").length;
    const forgotCheckout = rows.filter((r) => r.status === "FORGOT_CHECKOUT").length;
    const totalMinutes = rows.reduce((sum, r) => sum + (r.workDurationMinutes || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(2));
    const averageHoursPerDay = totalDays > 0 ? Number((totalHours / totalDays).toFixed(2)) : 0;

    return {
      totalDays,
      present,
      late,
      absent,
      forgotCheckout,
      totalHours,
      averageHoursPerDay,
      presentDays: present,
      lateDays: late,
      absentDays: absent,
      totalWorkMinutes: totalMinutes,
      averageWorkMinutes: Math.round(averageHoursPerDay * 60),
    };
  }

  static async getTodayCount() {
    const { start } = getTodayRange();
    const count = await prisma.attendance.count({
      where: { createdAt: { gte: start }, status: { in: ["CHECKED_IN", "LATE"] } },
    });
    return { todayCount: count };
  }

  static async getMonthlyRecap(month: string) {
    const { start, end } = getMonthRange(month);
    const assistants = await prisma.user.findMany({
      where: { role: { in: ["ASISTEN_LAB", "MAGANG"] }, isActive: true },
      select: {
        id: true,
        name: true,
        nim: true,
        attendances: {
          where: { createdAt: { gte: start, lte: end } },
          select: { checkinAt: true, checkoutAt: true, status: true, workDurationMinutes: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return assistants.map((a) => {
      const totalDays = a.attendances.length;
      const present = a.attendances.filter((att) => ["CHECKED_IN", "CHECKED_OUT", "APPROVED", "WAITING_VERIFICATION"].includes(att.status)).length;
      const late = a.attendances.filter((att) => att.status === "LATE").length;
      const totalMinutes = a.attendances.reduce((sum, att) => sum + (att.workDurationMinutes || 0), 0);
      return {
        id: a.id,
        name: a.name,
        nim: a.nim,
        totalDays,
        present,
        late,
        absent: totalDays - present - late,
        totalHours: Number((totalMinutes / 60).toFixed(2)),
        attendances: a.attendances,
      };
    });
  }

  static async markForgotCheckout() {
    const settings = await AttendanceSettingsService.get();
    const now = new Date();
    const candidates = await prisma.attendance.findMany({
      where: {
        checkoutAt: null,
        status: { in: ["CHECKED_IN", "LATE"] },
        shiftScheduleId: { not: null },
      },
      include: { shiftSchedule: { include: { shift: true } } },
    });
    const staleIds = candidates.flatMap((attendance) => {
      const schedule = attendance.shiftSchedule;
      if (!schedule) return [];
      const window = evaluateShiftWindow(now, schedule.shift.startTime, schedule.shift.endTime, 0, schedule.scheduleDate);
      const forgotAt = window.endsAt.getTime() + settings.forgotCheckoutAfterMinutes * 60_000;
      return now.getTime() >= forgotAt ? [attendance.id] : [];
    });
    if (staleIds.length === 0) return [];

    await prisma.attendance.updateMany({
      where: { id: { in: staleIds }, checkoutAt: null, status: { in: ["CHECKED_IN", "LATE"] } },
      data: { status: "FORGOT_CHECKOUT" },
    });
    return candidates.filter((attendance) => staleIds.includes(attendance.id));
  }

  static async markAbsent(userId: string, reason: string, date?: string) {
    const cleanUserId = typeof userId === "string" ? userId.trim() : "";
    const cleanReason = typeof reason === "string" ? reason.trim() : "";
    if (!cleanUserId || cleanUserId.length > 100) throw new Error("Target aslab tidak valid");
    if (cleanReason.length < 5 || cleanReason.length > 1000) throw new Error("Alasan absen harus 5-1000 karakter");
    const target = date ?? getJakartaDateParts(new Date()).date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) throw new Error("Tanggal harus berformat YYYY-MM-DD");
    const targetDate = dateOnly(target);
    if (Number.isNaN(targetDate.getTime()) || targetDate.toISOString().slice(0, 10) !== target) throw new Error("Tanggal tidak valid");
    if (target > getJakartaDateParts(new Date()).date) throw new Error("Tidak dapat menandai absen untuk tanggal mendatang");

    try {
      return await prisma.$transaction(async (tx) => {
        const schedule = await tx.asLabShiftSchedule.findFirst({
          where: { userId: cleanUserId, scheduleDate: targetDate, status: "SCHEDULED" },
          select: { id: true },
          orderBy: { id: "asc" },
        });
        if (!schedule) throw new Error("Aslab tidak memiliki jadwal piket aktif pada tanggal tersebut");
        const existing = await tx.attendance.findFirst({ where: { shiftScheduleId: schedule.id } });
        if (existing) throw new Error("Absensi untuk jadwal tersebut sudah tercatat");
        return tx.attendance.create({
          data: {
            userId: cleanUserId,
            shiftScheduleId: schedule.id,
            status: "ABSENT",
            notes: cleanReason,
            createdAt: targetDate,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Absensi untuk jadwal tersebut sudah tercatat");
      }
      throw error;
    }
  }

  static async getAslebDetail(userId: string, month?: string) {
    const where: any = { userId };
    if (month) {
      const { start, end } = getMonthRange(month);
      where.createdAt = { gte: start, lte: end };
    }

    const [attendances, tasks, stats] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          shiftSchedule: { include: { shift: true, lab: { select: { id: true, name: true } } } },
          dailyTasks: true,
          checkinLocation: { select: { id: true, name: true } },
          checkoutLocation: { select: { id: true, name: true } },
          verifier: { select: { id: true, name: true, role: true } },
          corrections: {
            select: {
              id: true,
              requestType: true,
              status: true,
              reason: true,
              reviewNote: true,
              reviewedAt: true,
              reviewer: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.dailyTaskLog.findMany({
        where: { userId, ...(month ? { createdAt: { gte: getMonthRange(month).start, lte: getMonthRange(month).end } } : {}) },
        include: { lab: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.getAttendanceStats(userId, month),
    ]);

    return { attendances, tasks, stats };
  }
}

// ============================================
// DAILY TASK
// ============================================

export class DailyTaskService {
  static async create(userId: string, data: {
    task: string;
    description?: string;
    category?: string;
    categoryConfigId?: string;
    photoUrl?: string;
    duration?: number;
    labId?: string;
    relatedTicketId?: string;
    relatedMissionId?: string;
    relatedScheduleId?: string;
  }) {
    // Link the task to the latest still-open attendance, including overnight shifts.
    const attendance = await prisma.attendance.findFirst({
      where: { userId, checkoutAt: null, checkinAt: { not: null }, status: { in: ["CHECKED_IN", "LATE"] } },
      orderBy: { checkinAt: "desc" },
    });

    // Check if evidence is required for this category config
    if (data.categoryConfigId) {
      const config = await prisma.taskCategoryConfig.findUnique({ where: { id: data.categoryConfigId } });
      if (config?.isEvidenceRequired && !data.photoUrl) {
        throw new Error(`Kategori "${config.name}" memerlukan bukti foto`);
      }
    }

    return prisma.dailyTaskLog.create({
      data: {
        userId,
        attendanceId: attendance?.id,
        task: data.task,
        description: data.description,
        category: (data.category as any) || "LAINNYA",
        categoryConfigId: data.categoryConfigId,
        photoUrl: data.photoUrl,
        duration: data.duration,
        labId: data.labId,
        relatedTicketId: data.relatedTicketId,
        relatedMissionId: data.relatedMissionId,
        relatedScheduleId: data.relatedScheduleId,
        status: "SUBMITTED",
      },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  static async getMyTasks(userId: string, date?: string, category?: string) {
    const where: any = { userId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: d, lte: end };
    }
    if (category && category !== "ALL") where.category = category;

    return prisma.dailyTaskLog.findMany({
      where,
      include: { lab: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getAllPending(date?: string) {
    const where: any = { status: { in: ["SUBMITTED", "NEED_REVISION"] } };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: d, lte: end };
    }

    return prisma.dailyTaskLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, nim: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  static async getAllTasks(filters?: { date?: string; category?: string; status?: string; userId?: string }) {
    const where: any = {};
    if (filters?.date) {
      const d = new Date(filters.date);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: d, lte: end };
    }
    if (filters?.category && filters.category !== "ALL") where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.userId = filters.userId;

    return prisma.dailyTaskLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, nim: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  static async review(taskId: string, reviewerId: string, action: "APPROVED" | "REJECTED" | "NEED_REVISION", reviewNote?: string) {
    const task = await prisma.dailyTaskLog.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task tidak ditemukan");
    if (!["SUBMITTED", "NEED_REVISION"].includes(task.status)) {
      throw new Error("Task tidak dalam status yang bisa di-review");
    }
    if (action === "REJECTED" && !reviewNote) {
      throw new Error("Catatan wajib diisi saat menolak task");
    }
    if (action === "NEED_REVISION" && !reviewNote) {
      throw new Error("Catatan wajib diisi saat meminta revisi");
    }

    return prisma.dailyTaskLog.update({
      where: { id: taskId },
      data: {
        status: action,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
      include: {
        user: { select: { id: true, name: true } },
        lab: { select: { id: true, name: true } },
      },
    });
  }

  static async updateTask(taskId: string, userId: string, data: {
    task?: string;
    description?: string;
    category?: string;
    photoUrl?: string;
    duration?: number;
    labId?: string;
  }) {
    const task = await prisma.dailyTaskLog.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task tidak ditemukan");
    if (task.userId !== userId) throw new Error("Tidak bisa mengedit task orang lain");
    if (!["DRAFT", "SUBMITTED", "NEED_REVISION"].includes(task.status)) {
      throw new Error("Task yang sudah di-approve/reject tidak bisa diedit");
    }

    const safeData = pickDailyTaskUpdate(data as Record<string, unknown>) as typeof data;

    return prisma.dailyTaskLog.update({
      where: { id: taskId },
      data: {
        ...safeData,
        category: safeData.category as any,
        status: "SUBMITTED", // Re-submit after edit
      },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  static async getStats(userId: string, month?: string) {
    const where: any = { userId };
    if (month) {
      const { start, end } = getMonthRange(month);
      where.createdAt = { gte: start, lte: end };
    }

    const tasks = await prisma.dailyTaskLog.findMany({ where });
    const totalTasks = tasks.length;
    const approved = tasks.filter((t) => t.status === "APPROVED").length;
    const rejected = tasks.filter((t) => t.status === "REJECTED").length;
    const pending = tasks.filter((t) => t.status === "SUBMITTED" || t.status === "NEED_REVISION").length;
    const totalDuration = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const byCategory = tasks.reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {});

    return { totalTasks, approved, rejected, pending, totalDuration, byCategory };
  }
}

// ============================================
// CORRECTION REQUESTS
// ============================================

export class CorrectionRequestService {
  static async create(userId: string, data: {
    attendanceId: string;
    requestType: string;
    oldValue?: string;
    newValue?: string;
    reason: string;
    evidenceUrl?: string;
  }) {
    // Verify attendance belongs to user
    const attendance = await prisma.attendance.findUnique({ where: { id: data.attendanceId } });
    if (!attendance) throw new Error("Attendance tidak ditemukan");
    if (attendance.userId !== userId) throw new Error("Tidak bisa mengajukan koreksi untuk absensi orang lain");

    const requestTypes = new Set(["CHECKIN_TIME", "CHECKOUT_TIME", "FORGOT_CHECKOUT", "LOCATION_ERROR", "STATUS_CORRECTION"]);
    if (!requestTypes.has(data.requestType)) throw new Error("Tipe koreksi tidak valid");
    const reason = data.reason?.trim();
    if (!reason || reason.length < 10 || reason.length > 1000) throw new Error("Alasan koreksi harus 10-1000 karakter");
    if (data.evidenceUrl && !data.evidenceUrl.startsWith("/uploads/") && !/^https:\/\//i.test(data.evidenceUrl)) {
      throw new Error("URL bukti koreksi tidak valid");
    }
    buildAttendanceCorrection({
      requestType: data.requestType,
      newValue: data.newValue,
      checkinAt: attendance.checkinAt,
      checkoutAt: attendance.checkoutAt,
      createdAt: attendance.createdAt,
    });
    const duplicate = await prisma.attendanceCorrectionRequest.findFirst({
      where: { attendanceId: data.attendanceId, requestType: data.requestType as any, status: "PENDING" },
      select: { id: true },
    });
    if (duplicate) throw new Error("Koreksi sejenis untuk absensi ini masih menunggu review");

    return prisma.attendanceCorrectionRequest.create({
      data: {
        attendanceId: data.attendanceId,
        userId,
        requestType: data.requestType as any,
        oldValue: data.oldValue?.slice(0, 500),
        newValue: data.newValue?.slice(0, 500),
        reason,
        evidenceUrl: data.evidenceUrl,
      },
    });
  }

  static async getMyRequests(userId: string) {
    return prisma.attendanceCorrectionRequest.findMany({
      where: { userId },
      include: { attendance: { select: { checkinAt: true, checkoutAt: true, status: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getAllPending() {
    return prisma.attendanceCorrectionRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, nim: true } },
        attendance: { select: { checkinAt: true, checkoutAt: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async review(requestId: string, reviewerId: string, action: "APPROVED" | "REJECTED", reviewNote?: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.attendanceCorrectionRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new Error("Request tidak ditemukan");
      if (request.status !== "PENDING") throw new Error("Request sudah di-review");
      if (action === "REJECTED" && !reviewNote?.trim()) throw new Error("Catatan wajib diisi saat menolak koreksi");

      const attendance = await tx.attendance.findUnique({ where: { id: request.attendanceId } });
      if (!attendance) throw new Error("Attendance tidak ditemukan");

      if (action === "APPROVED") {
        const updateData = buildAttendanceCorrection({
          requestType: request.requestType,
          newValue: request.newValue,
          checkinAt: attendance.checkinAt,
          checkoutAt: attendance.checkoutAt,
          createdAt: attendance.createdAt,
        });
        if (Object.keys(updateData).length > 0) {
          await tx.attendance.update({ where: { id: request.attendanceId }, data: updateData });
        }
      }

      const updated = await tx.attendanceCorrectionRequest.update({
        where: { id: requestId },
        data: {
          status: action,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: reviewNote?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: action === "APPROVED" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED",
          targetType: "Attendance",
          targetId: request.attendanceId,
          description: `Koreksi ${request.requestType} ${action === "APPROVED" ? "disetujui" : "ditolak"}. Alasan: ${request.reason}`,
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

// ============================================
// LEAVE REQUEST SERVICE
// ============================================

export class LeaveRequestService {
  static async submit(userId: string, data: { type: string; date: string; reason: string; evidenceUrl?: string }) {
    if (data.type !== "SICK" && data.type !== "PERMISSION") throw new Error("Tipe izin tidak valid");
    return LeaveService.createRequest(userId, data.type, data.date, data.reason, data.evidenceUrl);
  }

  static async getMyRequests(userId: string, month?: string) {
    const where: any = { userId };

    if (month) {
      const start = new Date(`${month}-01`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      where.date = { gte: start, lt: end };
    }

    return prisma.leaveRequest.findMany({
      where,
      include: {
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getPending() {
    return prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async getAll(filters?: { status?: string; month?: string; userId?: string }) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.month) {
      const start = new Date(`${filters.month}-01`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      where.date = { gte: start, lt: end };
    }

    return prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async review(requestId: string, reviewerId: string, action: "APPROVED" | "REJECTED", note?: string) {
    return action === "APPROVED"
      ? LeaveService.approveRequest(requestId, reviewerId, note)
      : LeaveService.rejectRequest(requestId, reviewerId, note);
  }
}
