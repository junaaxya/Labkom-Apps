import prisma from "../config/database";
import type { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.validator";

export class ScheduleService {
  static async getAllSchedules(filters?: { labId?: string; day?: string; semester?: string }) {
    const where: any = { isActive: true };
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.day) where.day = filters.day;
    if (filters?.semester) where.semester = filters.semester;

    return prisma.schedule.findMany({
      where,
      include: {
        lab: { select: { id: true, name: true, location: true } },
        assistant: { select: { id: true, name: true } },
      },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    });
  }

  static async getScheduleById(id: string) {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        lab: true,
        assistant: { select: { id: true, name: true, email: true } },
      },
    });
    if (!schedule) throw new Error("Jadwal tidak ditemukan");
    return schedule;
  }

  static async createSchedule(data: CreateScheduleInput) {
    const lab = await prisma.lab.findUnique({ where: { id: data.labId } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    const conflict = await this.checkConflict(data.labId, data.day, data.startTime, data.endTime);
    if (conflict) {
      throw new Error(`Jadwal bentrok dengan "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`);
    }

    return prisma.schedule.create({
      data,
      include: {
        lab: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
      },
    });
  }

  static async updateSchedule(id: string, data: UpdateScheduleInput) {
    const schedule = await prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new Error("Jadwal tidak ditemukan");

    if (data.day || data.startTime || data.endTime || data.labId) {
      const labId = data.labId || schedule.labId;
      const day = data.day || schedule.day;
      const startTime = data.startTime || schedule.startTime;
      const endTime = data.endTime || schedule.endTime;

      const conflict = await this.checkConflict(labId, day, startTime, endTime, id);
      if (conflict) {
        throw new Error(`Jadwal bentrok dengan "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`);
      }
    }

    return prisma.schedule.update({
      where: { id },
      data,
      include: {
        lab: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
      },
    });
  }

  static async updateStatus(id: string, status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED") {
    const schedule = await prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new Error("Jadwal tidak ditemukan");

    return prisma.schedule.update({
      where: { id },
      data: { status },
      include: {
        lab: { select: { id: true, name: true } },
        assistant: { select: { id: true, name: true } },
      },
    });
  }

  static async deleteSchedule(id: string) {
    const schedule = await prisma.schedule.findUnique({ where: { id } });
    if (!schedule) throw new Error("Jadwal tidak ditemukan");
    return prisma.schedule.update({ where: { id }, data: { isActive: false } });
  }

  static async bulkDeleteSchedules(ids: string[]) {
    return prisma.schedule.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
  }

  static async deleteAllSchedules(filters?: { labId?: string; day?: string }) {
    const where: any = { isActive: true };
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.day) where.day = filters.day;

    return prisma.schedule.updateMany({
      where,
      data: { isActive: false },
    });
  }

  static async getSchedulesByDay(labId: string, day: string) {
    return prisma.schedule.findMany({
      where: { labId, day: day as any, isActive: true },
      include: {
        assistant: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    });
  }

  static async getTodaySchedules(labId?: string) {
    const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const today = dayNames[new Date().getDay()];

    return prisma.schedule.findMany({
      where: {
        isActive: true,
        day: today as any,
        ...(labId ? { labId } : {}),
      },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        assistant: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    });
  }

  static async getStats() {
    const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const today = dayNames[new Date().getDay()];

    const [totalSchedules, activeSchedules, todaySchedules, statusGroups] = await Promise.all([
      prisma.schedule.count(),
      prisma.schedule.count({ where: { isActive: true } }),
      prisma.schedule.count({ where: { isActive: true, day: today as any } }),
      prisma.schedule.groupBy({ by: ["status"], _count: { _all: true }, where: { isActive: true } }),
    ]);

    const byStatus = statusGroups.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    return {
      totalSchedules,
      activeSchedules,
      todaySchedules,
      byStatus,
    };
  }

  private static async checkConflict(
    labId: string,
    day: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ) {
    const schedules = await prisma.schedule.findMany({
      where: {
        labId,
        day: day as any,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    return schedules.find((s) => {
      return startTime < s.endTime && endTime > s.startTime;
    });
  }
}
