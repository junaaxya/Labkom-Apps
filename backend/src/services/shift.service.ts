import prisma from "../config/database";

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
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
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
    labId: string;
    aslebId: string;
    day: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }) {
    const conflict = await prisma.shift.findFirst({
      where: {
        aslebId: data.aslebId,
        day: data.day as any,
        isActive: true,
        OR: [
          { startTime: { lt: data.endTime }, endTime: { gt: data.startTime } },
        ],
      },
    });

    if (conflict) {
      throw new Error("Asleb sudah punya shift di waktu yang sama");
    }

    return prisma.shift.create({
      data: {
        labId: data.labId,
        aslebId: data.aslebId,
        day: data.day as any,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
      },
      include: {
        lab: { select: { id: true, name: true } },
        asleb: { select: { id: true, name: true } },
      },
    });
  }

  static async updateShift(id: string, data: {
    labId?: string;
    aslebId?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
  }) {
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new Error("Shift tidak ditemukan");

    if (data.aslebId || data.day || data.startTime || data.endTime) {
      const checkAslebId = data.aslebId || existing.aslebId;
      const checkDay = data.day || existing.day;
      const checkStart = data.startTime || existing.startTime;
      const checkEnd = data.endTime || existing.endTime;

      const conflict = await prisma.shift.findFirst({
        where: {
          id: { not: id },
          aslebId: checkAslebId,
          day: checkDay as any,
          isActive: true,
          OR: [
            { startTime: { lt: checkEnd }, endTime: { gt: checkStart } },
          ],
        },
      });

      if (conflict) {
        throw new Error("Asleb sudah punya shift di waktu yang sama");
      }
    }

    return prisma.shift.update({
      where: { id },
      data: {
        ...(data.labId && { labId: data.labId }),
        ...(data.aslebId && { aslebId: data.aslebId }),
        ...(data.day && { day: data.day as any }),
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.endTime && { endTime: data.endTime }),
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
    return prisma.shift.findMany({
      where: { aslebId, isActive: true },
      include: {
        lab: { select: { id: true, name: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });
  }

  static async getTodayShifts() {
    const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const today = days[new Date().getDay()] as any;

    return prisma.shift.findMany({
      where: { day: today, isActive: true },
      include: {
        lab: { select: { id: true, name: true } },
        asleb: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { startTime: "asc" },
    });
  }
}
