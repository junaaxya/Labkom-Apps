import prisma from "../config/database";

function assertValidTimeRange(startTime: string, endTime: string) {
  if (!startTime || !endTime) {
    throw new Error("Jam mulai dan jam selesai wajib diisi");
  }
  if (endTime <= startTime) {
    throw new Error("Jam selesai harus lebih besar dari jam mulai");
  }
}

export class ShiftService {
  static async getAllShifts(filters?: { labId?: string; aslebId?: string; day?: string }) {
    const where: any = { isActive: true };
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.aslebId) where.aslebId = filters.aslebId;
    if (filters?.day) where.day = filters.day;

    return prisma.shift.findMany({
      where,
      include: {
        lab: { select: { id: true, name: true, location: true } },
        asleb: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: [{ startTime: "asc" }, { name: "asc" }],
    });
  }

  static async getShiftById(id: string) {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        lab: true,
        asleb: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!shift) throw new Error("Shift tidak ditemukan");
    return shift;
  }

  static async createShift(data: {
    name?: string;
    labId?: string | null;
    aslebId?: string | null;
    day?: string | null;
    startTime: string;
    endTime: string;
    lateToleranceMinutes?: number;
    checkoutGraceMinutes?: number;
    isTaskRequired?: boolean;
    notes?: string;
  }) {
    assertValidTimeRange(data.startTime, data.endTime);

    // Template mode: conflict only when the same named active time window already exists.
    if (data.name?.trim()) {
      const sameName = await prisma.shift.findFirst({
        where: {
          isActive: true,
          name: data.name.trim(),
          startTime: data.startTime,
          endTime: data.endTime,
        },
      });
      if (sameName) {
        throw new Error("Shift dengan nama dan jam yang sama sudah ada");
      }
    }

    return prisma.shift.create({
      data: {
        name: data.name?.trim() || null,
        labId: data.labId || null,
        aslebId: data.aslebId || null,
        day: (data.day as any) || null,
        startTime: data.startTime,
        endTime: data.endTime,
        lateToleranceMinutes: data.lateToleranceMinutes ?? 15,
        checkoutGraceMinutes: data.checkoutGraceMinutes ?? 30,
        isTaskRequired: data.isTaskRequired ?? true,
        notes: data.notes,
      },
      include: {
        lab: { select: { id: true, name: true } },
        asleb: { select: { id: true, name: true } },
      },
    });
  }

  static async updateShift(id: string, data: {
    name?: string | null;
    labId?: string | null;
    aslebId?: string | null;
    day?: string | null;
    startTime?: string;
    endTime?: string;
    lateToleranceMinutes?: number;
    checkoutGraceMinutes?: number;
    isTaskRequired?: boolean;
    notes?: string;
  }) {
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new Error("Shift tidak ditemukan");

    const nextStart = data.startTime ?? existing.startTime;
    const nextEnd = data.endTime ?? existing.endTime;
    assertValidTimeRange(nextStart, nextEnd);

    return prisma.shift.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name?.trim() || null }),
        ...(data.labId !== undefined && { labId: data.labId || null }),
        ...(data.aslebId !== undefined && { aslebId: data.aslebId || null }),
        ...(data.day !== undefined && { day: (data.day as any) || null }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.endTime && { endTime: data.endTime }),
        ...(data.lateToleranceMinutes !== undefined && { lateToleranceMinutes: data.lateToleranceMinutes }),
        ...(data.checkoutGraceMinutes !== undefined && { checkoutGraceMinutes: data.checkoutGraceMinutes }),
        ...(data.isTaskRequired !== undefined && { isTaskRequired: data.isTaskRequired }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        lab: { select: { id: true, name: true } },
        asleb: { select: { id: true, name: true } },
      },
    });
  }

  static async deleteShift(id: string) {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new Error("Shift tidak ditemukan");

    return prisma.shift.update({
      where: { id },
      data: { isActive: false },
    });
  }

  static async getAslebWeeklySchedule(aslebId: string) {
    // Legacy helper: prefer materialized picket schedules; keep shift rows that still bind aslebId.
    return prisma.shift.findMany({
      where: { aslebId, isActive: true },
      include: {
        lab: { select: { id: true, name: true } },
      },
      orderBy: [{ startTime: "asc" }],
    });
  }

  static async getTodayShifts() {
    const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const today = days[new Date().getDay()] as any;

    return prisma.shift.findMany({
      where: {
        isActive: true,
        OR: [{ day: today }, { day: null }],
      },
      include: {
        lab: { select: { id: true, name: true } },
        asleb: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { startTime: "asc" },
    });
  }
}
