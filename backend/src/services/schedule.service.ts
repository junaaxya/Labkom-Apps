import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { ApprovalConflictError } from "./approval-conflict.error";
import type { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.validator";
import { googleCalendarService } from "./google-calendar.service";
import {
  findOccupancyConflict,
  isOperationalSchedule,
  OPERATIONAL_SCHEDULE_STATUSES,
  operationalScheduleWhere,
  withSerializableRetry,
  type OccupancyCandidate,
} from "./schedule-availability";
import { getJakartaClock } from "./jakarta-time";

type ScheduleConflictType = "LAB" | "DOSEN" | "ASISTEN";

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
    const schedule = await withSerializableRetry(async (tx) => {
      const lab = await tx.lab.findUnique({ where: { id: data.labId } });
      if (!lab) throw new Error("Lab tidak ditemukan");

      const conflict = await this.checkConflict(tx, { ...data, specificDate: null }, undefined);
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
    await this.reconcileScheduleCalendar(schedule);
    return schedule;
  }

  static async updateSchedule(id: string, data: UpdateScheduleInput) {
    const result = await withSerializableRetry(async (tx) => {
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
          specificDate: schedule.specificDate,
        }, id);
        if (conflict) {
          throw new Error(this.conflictMessage(conflict.type, conflict.schedule.title, conflict.schedule.startTime, conflict.schedule.endTime));
        }
      }

      const updated = await tx.schedule.update({
        where: { id },
        data,
        include: {
          lab: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } },
        },
      });
      return { updated, previousAssistantId: schedule.assistantId };
    });

    if (result.previousAssistantId && result.previousAssistantId !== result.updated.assistantId) {
      await googleCalendarService.removeScheduleFromCalendar(result.previousAssistantId, id);
    }
    await this.reconcileScheduleCalendar(result.updated);
    return result.updated;
  }

  static async updateStatus(id: string, status: "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED") {
    if (status === "FINISHED" || status === "CANCELLED") {
      const schedule = await prisma.schedule.findUnique({ where: { id } });
      if (!schedule) throw new Error("Jadwal tidak ditemukan");

      const updated = await prisma.schedule.update({
        where: { id },
        data: { status },
        include: {
          lab: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } },
        },
      });
      await this.reconcileScheduleCalendar(updated);
      return updated;
    }

    const updated = await withSerializableRetry(async (tx) => {
      const currentSchedule = await tx.schedule.findUnique({ where: { id } });
      if (!currentSchedule) throw new Error("Jadwal tidak ditemukan");

      if (
        isOperationalSchedule(status, currentSchedule.isActive) &&
        !isOperationalSchedule(currentSchedule.status, currentSchedule.isActive)
      ) {
        const conflict = await findOccupancyConflict(tx, {
          labId: currentSchedule.labId,
          day: currentSchedule.day,
          startTime: currentSchedule.startTime,
          endTime: currentSchedule.endTime,
          specificDate: currentSchedule.specificDate,
        }, { excludeScheduleId: id });
        this.throwOccupancyConflict(conflict);
      }

      return tx.schedule.update({
        where: { id },
        data: { status },
        include: {
          lab: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } },
        },
      });
    });
    await this.reconcileScheduleCalendar(updated);
    return updated;
  }

  static async deleteSchedule(id: string) {
    const schedule = await prisma.schedule.findUnique({ where: { id }, include: { lab: true } });
    if (!schedule) throw new Error("Jadwal tidak ditemukan");
    const deleted = await prisma.schedule.update({ where: { id }, data: { isActive: false } });
    await this.reconcileScheduleCalendar({ ...schedule, isActive: false });
    return deleted;
  }

  static async bulkDeleteSchedules(ids: string[]) {
    const schedules = await prisma.schedule.findMany({ where: { id: { in: ids }, isActive: true }, include: { lab: true } });
    const result = await prisma.schedule.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
    for (const schedule of schedules) await this.reconcileScheduleCalendar({ ...schedule, isActive: false });
    return result;
  }

  static async deleteAllSchedules(filters?: { labId?: string; day?: string }) {
    const where: any = { isActive: true };
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.day) where.day = filters.day;

    const schedules = await prisma.schedule.findMany({ where, include: { lab: true } });
    const result = await prisma.schedule.updateMany({
      where,
      data: { isActive: false },
    });
    for (const schedule of schedules) await this.reconcileScheduleCalendar({ ...schedule, isActive: false });
    return result;
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

  static async getTodaySchedules(labId?: string, now = new Date()) {
    const { date, day } = getJakartaClock(now);

    return prisma.schedule.findMany({
      where: {
        isActive: true,
        status: { in: [...OPERATIONAL_SCHEDULE_STATUSES] },
        OR: [
          { specificDate: date },
          { specificDate: null, day: day as any },
        ],
        ...(labId ? { labId } : {}),
      },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        assistant: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    });
  }

  static async getStats(now = new Date()) {
    const { date, day } = getJakartaClock(now);

    const [totalSchedules, activeSchedules, todaySchedules, statusGroups] = await Promise.all([
      prisma.schedule.count(),
      prisma.schedule.count({ where: { isActive: true } }),
      prisma.schedule.count({
        where: {
          isActive: true,
          status: { in: [...OPERATIONAL_SCHEDULE_STATUSES] },
          OR: [
            { specificDate: date },
            { specificDate: null, day: day as any },
          ],
        },
      }),
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

  static async reconcileScheduleCalendar(schedule: {
    id: string;
    title: string;
    semester: string | null;
    assistantId: string | null;
    day: string;
    startTime: string;
    endTime: string;
    status: string;
    isActive: boolean;
    lab: { name: string };
  }): Promise<void> {
    if (!schedule.assistantId) return;
    try {
      await googleCalendarService.reconcileScheduleCalendar(schedule.assistantId, {
        id: schedule.id,
        title: schedule.title,
        labName: schedule.lab.name,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        semester: schedule.semester || undefined,
        status: schedule.status,
        isActive: schedule.isActive,
      });
    } catch (error) {
      console.error(`[Schedule] Calendar reconciliation failed for ${schedule.id}:`, error);
    }
  }

  private static async checkConflict(
    client: Prisma.TransactionClient,
    candidate: Pick<CreateScheduleInput, "labId" | "day" | "startTime" | "endTime" | "lecturerName" | "assistantId"> & {
      specificDate?: Date | null;
    },
    excludeId?: string
  ): Promise<{ schedule: { title: string; startTime: string; endTime: string }; type: ScheduleConflictType } | undefined> {
    const tx = client;
    const occupancyCandidate = {
      ...candidate,
      specificDate: candidate.specificDate ?? null,
    } as OccupancyCandidate;
    const occupancyConflict = await findOccupancyConflict(tx, occupancyCandidate, { excludeScheduleId: excludeId });
    this.throwOccupancyConflict(occupancyConflict);
    const schedules = await tx.schedule.findMany({
      where: {
        ...operationalScheduleWhere,
        day: candidate.day,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    const normalizedLecturer = this.normalizeLecturerName(candidate.lecturerName);
    for (const schedule of schedules) {
      if (!(candidate.startTime < schedule.endTime && candidate.endTime > schedule.startTime)) continue;
      if (normalizedLecturer && normalizedLecturer === this.normalizeLecturerName(schedule.lecturerName)) return { schedule, type: "DOSEN" };
      if (candidate.assistantId && candidate.assistantId === schedule.assistantId) return { schedule, type: "ASISTEN" };
    }
    return undefined;
  }

  private static throwOccupancyConflict(
    conflict: Awaited<ReturnType<typeof findOccupancyConflict>>
  ): void {
    if (conflict?.kind === "SCHEDULE") {
      throw new ApprovalConflictError(`Jadwal bentrok pada lab dengan "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`);
    }
    if (conflict?.kind === "BOOKING") {
      throw new ApprovalConflictError("Jadwal bentrok dengan peminjaman lab lain yang sudah disetujui");
    }
  }

  private static normalizeLecturerName(name?: string | null): string | undefined {
    const normalized = name?.trim().toLocaleLowerCase("id-ID");
    return normalized || undefined;
  }

  static assertValidTimeInterval(startTime: string, endTime: string): void {
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
      throw new Error("Format waktu harus HH:mm");
    }
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
}
