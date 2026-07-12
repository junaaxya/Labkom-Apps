import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import type { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.validator";
import { operationalScheduleWhere } from "./schedule-availability";

type ScheduleConflictType = "LAB" | "DOSEN" | "ASISTEN";

export class ScheduleService {
  private static readonly SERIALIZABLE_RETRY_LIMIT = 2;

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
    return this.withSerializableRetry(async (tx) => {
      const lab = await tx.lab.findUnique({ where: { id: data.labId } });
      if (!lab) throw new Error("Lab tidak ditemukan");

      const conflict = await this.checkConflict(tx, data, undefined);
      if (conflict) {
        throw new Error(this.conflictMessage(conflict.type, conflict.schedule.title, conflict.schedule.startTime, conflict.schedule.endTime));
      }

      return tx.schedule.create({
        data,
        include: {
          lab: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } },
        },
      });
    });
  }

  static async updateSchedule(id: string, data: UpdateScheduleInput) {
    return this.withSerializableRetry(async (tx) => {
      const schedule = await tx.schedule.findUnique({ where: { id } });
      if (!schedule) throw new Error("Jadwal tidak ditemukan");

      if (data.day || data.startTime || data.endTime || data.labId || data.lecturerName !== undefined || data.assistantId !== undefined) {
        const startTime = data.startTime || schedule.startTime;
        const endTime = data.endTime || schedule.endTime;
        this.assertValidTimeInterval(startTime, endTime);

        const conflict = await this.checkConflict(tx, {
          labId: data.labId || schedule.labId,
          day: data.day || schedule.day,
          startTime,
          endTime,
          lecturerName: data.lecturerName !== undefined ? data.lecturerName : schedule.lecturerName || undefined,
          assistantId: data.assistantId !== undefined ? data.assistantId : schedule.assistantId || undefined,
        }, id);
        if (conflict) {
          throw new Error(this.conflictMessage(conflict.type, conflict.schedule.title, conflict.schedule.startTime, conflict.schedule.endTime));
        }
      }

      return tx.schedule.update({
        where: { id },
        data,
        include: {
          lab: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } },
        },
      });
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
    client: Prisma.TransactionClient,
    candidate: Pick<CreateScheduleInput, "labId" | "day" | "startTime" | "endTime" | "lecturerName" | "assistantId">,
    excludeId?: string
  ): Promise<{ schedule: { title: string; startTime: string; endTime: string }; type: ScheduleConflictType } | undefined> {
    const schedules = await client.schedule.findMany({
      where: {
        ...operationalScheduleWhere,
        day: candidate.day,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    const normalizedLecturer = this.normalizeLecturerName(candidate.lecturerName);
    for (const schedule of schedules) {
      if (!(candidate.startTime < schedule.endTime && candidate.endTime > schedule.startTime)) continue;

      if (schedule.labId === candidate.labId) return { schedule, type: "LAB" };
      if (normalizedLecturer && normalizedLecturer === this.normalizeLecturerName(schedule.lecturerName)) {
        return { schedule, type: "DOSEN" };
      }
      if (candidate.assistantId && candidate.assistantId === schedule.assistantId) {
        return { schedule, type: "ASISTEN" };
      }
    }

    return undefined;
  }

  private static normalizeLecturerName(name?: string | null): string | undefined {
    const normalized = name?.trim().toLocaleLowerCase("id-ID");
    return normalized || undefined;
  }

  private static assertValidTimeInterval(startTime: string, endTime: string): void {
    if (this.timeToMinutes(endTime) <= this.timeToMinutes(startTime)) {
      throw new Error("Jam selesai harus lebih besar dari jam mulai");
    }
  }

  private static timeToMinutes(time: string): number {
    const [hours = "0", minutes = "0"] = time.split(":");
    return Number(hours) * 60 + Number(minutes);
  }

  private static conflictMessage(type: ScheduleConflictType, title: string, startTime: string, endTime: string): string {
    const resource = type === "LAB" ? "lab" : type === "DOSEN" ? "dosen" : "asisten";
    return `Jadwal bentrok pada ${resource} dengan "${title}" (${startTime}-${endTime})`;
  }

  private static async withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= this.SERIALIZABLE_RETRY_LIMIT; attempt++) {
      try {
        return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < this.SERIALIZABLE_RETRY_LIMIT && this.isSerializationFailure(error)) continue;
        throw error;
      }
    }
    throw new Error("Transaksi jadwal gagal setelah retry");
  }

  private static isSerializationFailure(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
  }
}
