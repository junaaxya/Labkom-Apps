import prisma from "../config/database";
import { ApprovalConflictError } from "./approval-conflict.error";
import { findOccupancyConflict, withSerializableRetry } from "./schedule-availability";
import type { CreateScheduleChangeInput } from "../validators/schedule-change.validator";
import { ScheduleService } from "./schedule.service";

type ScheduleChangeFilters = {
  status?: string;
  requestedById?: string;
  page?: number;
  limit?: number;
};

export class ScheduleChangeService {
  static async getAllRequests(filters?: ScheduleChangeFilters) {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.requestedById) where.requestedById = filters.requestedById;

    const [items, total] = await prisma.$transaction([
      prisma.scheduleChangeRequest.findMany({
        where,
        include: {
          schedule: true,
          requestedBy: { select: { id: true, name: true, email: true, role: true, isKetuaKelas: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.scheduleChangeRequest.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getMyRequests(userId: string) {
    return prisma.scheduleChangeRequest.findMany({
      where: { requestedById: userId },
      include: {
        schedule: true,
        requestedBy: { select: { id: true, name: true, email: true, role: true, isKetuaKelas: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createRequest(data: CreateScheduleChangeInput, requestedById: string) {
    const requester = await prisma.user.findUnique({ where: { id: requestedById } });
    if (!requester) throw new Error("User tidak ditemukan");
    if (!requester.isKetuaKelas) throw new Error("Hanya ketua kelas yang dapat mengajukan perubahan jadwal");

    let schedule: { id: string; labId: string } | null = null;

    if (data.scheduleId) {
      schedule = await prisma.schedule.findUnique({
        where: { id: data.scheduleId },
        select: { id: true, labId: true },
      });
      if (!schedule) throw new Error("Jadwal tidak ditemukan");

      const duplicatePending = await prisma.scheduleChangeRequest.findFirst({
        where: {
          scheduleId: data.scheduleId,
          status: "PENDING",
        },
      });

      if (duplicatePending) {
        throw new Error("Masih ada pengajuan perubahan jadwal yang berstatus PENDING untuk jadwal ini");
      }
    }

    const resolvedLabId = data.newLabId || schedule?.labId;

    return prisma.scheduleChangeRequest.create({
      data: {
        scheduleId: data.scheduleId,
        requestType: data.requestType,
        reason: data.reason,
        newDay: data.newDay,
        newStartTime: data.newStartTime,
        newEndTime: data.newEndTime,
        newLabId: resolvedLabId,
        cancelDate: data.cancelDate ? new Date(data.cancelDate) : undefined,
        requestedById,
      },
      include: {
        schedule: true,
        requestedBy: { select: { id: true, name: true, email: true, role: true, isKetuaKelas: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  static async approveRequest(requestId: string, approvedById: string, adminNotes?: string) {
    const outcome = await withSerializableRetry(async (tx) => {
      const affectedScheduleIds: string[] = [];
      const request = await tx.scheduleChangeRequest.findUnique({
        where: { id: requestId },
        include: { schedule: true },
      });
      if (!request) throw new Error("Pengajuan perubahan jadwal tidak ditemukan");
      if (request.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat disetujui");

      if (request.requestType === "RESCHEDULE") {
        if (!request.scheduleId || !request.schedule) throw new Error("Jadwal sumber wajib tersedia untuk RESCHEDULE");
        if (!request.newDay || !request.newStartTime || !request.newEndTime) {
          throw new Error("Data perubahan jadwal tidak lengkap untuk RESCHEDULE");
        }

        const conflict = await findOccupancyConflict(tx, {
          labId: request.newLabId || request.schedule.labId,
          day: request.newDay,
          startTime: request.newStartTime,
          endTime: request.newEndTime,
          specificDate: request.schedule.specificDate,
        }, { excludeScheduleId: request.schedule.id });
        this.throwOccupancyConflict(conflict);

        ScheduleService.assertValidTimeInterval(request.newStartTime, request.newEndTime);

        await tx.schedule.update({
          where: { id: request.scheduleId },
          data: {
            day: request.newDay,
            startTime: request.newStartTime,
            endTime: request.newEndTime,
            ...(request.newLabId ? { labId: request.newLabId } : {}),
          },
        });
        affectedScheduleIds.push(request.scheduleId);
      }

      if (request.requestType === "CANCEL_SESSION") {
        if (!request.scheduleId) throw new Error("scheduleId wajib untuk CANCEL_SESSION");
        await tx.schedule.update({ where: { id: request.scheduleId }, data: { status: "CANCELLED" } });
        affectedScheduleIds.push(request.scheduleId);
      }

      if (request.requestType === "EXTRA_SLOT") {
        if (!request.newDay || !request.newStartTime || !request.newEndTime) {
          throw new Error("Data jadwal tambahan tidak lengkap untuk EXTRA_SLOT");
        }

        const sourceSchedule = request.scheduleId
          ? await tx.schedule.findUnique({ where: { id: request.scheduleId } })
          : null;
        const targetLabId = request.newLabId || sourceSchedule?.labId;
        if (!targetLabId) throw new Error("Lab tujuan tidak ditemukan untuk EXTRA_SLOT");

        ScheduleService.assertValidTimeInterval(request.newStartTime, request.newEndTime);
        const conflict = await findOccupancyConflict(tx, {
          labId: targetLabId,
          day: request.newDay,
          startTime: request.newStartTime,
          endTime: request.newEndTime,
          specificDate: null,
        });
        this.throwOccupancyConflict(conflict);

        const extraSchedule = await tx.schedule.create({
          data: {
            labId: targetLabId,
            title: sourceSchedule?.title || "Extra Slot",
            semester: sourceSchedule?.semester,
            className: sourceSchedule?.className,
            lecturerName: sourceSchedule?.lecturerName,
            assistantId: sourceSchedule?.assistantId,
            day: request.newDay,
            startTime: request.newStartTime,
            endTime: request.newEndTime,
            type: "KEGIATAN",
            status: "SCHEDULED",
            isActive: true,
          },
        });
        affectedScheduleIds.push(extraSchedule.id);
      }

      const approved = await tx.scheduleChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          approvedById,
          adminNotes,
          rejectionReason: null,
        },
        include: {
          schedule: true,
          requestedBy: { select: { id: true, name: true, email: true, role: true, isKetuaKelas: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: approvedById,
          action: "SCHEDULE_CHANGE_APPROVED",
          targetType: "ScheduleChangeRequest",
          targetId: requestId,
          description: `${request.requestType} disetujui${adminNotes ? `. Catatan: ${adminNotes}` : ""}`,
        },
      });
      return { approved, affectedScheduleIds };
    });

    const affectedSchedules = await prisma.schedule.findMany({
      where: { id: { in: outcome.affectedScheduleIds } },
      include: { lab: { select: { name: true } } },
    });
      for (const schedule of affectedSchedules) {
        await ScheduleService.reconcileScheduleCalendar(schedule);
      }
      return outcome.approved;
  }

  private static throwOccupancyConflict(
    conflict: Awaited<ReturnType<typeof findOccupancyConflict>>
  ): void {
    if (conflict?.kind === "SCHEDULE") {
      throw new ApprovalConflictError(`Jadwal bentrok dengan "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`);
    }
    if (conflict?.kind === "BOOKING") {
      throw new ApprovalConflictError("Jadwal bentrok dengan peminjaman lab lain yang sudah disetujui");
    }
  }

  static async rejectRequest(requestId: string, rejectedById: string, rejectionReason: string) {
    const request = await prisma.scheduleChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("Pengajuan perubahan jadwal tidak ditemukan");
    if (request.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat ditolak");

    return prisma.scheduleChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        approvedById: rejectedById,
        rejectionReason,
      },
      include: {
        schedule: true,
        requestedBy: { select: { id: true, name: true, email: true, role: true, isKetuaKelas: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  static async getStats() {
    const [total, pending, approved, rejected] = await prisma.$transaction([
      prisma.scheduleChangeRequest.count(),
      prisma.scheduleChangeRequest.count({ where: { status: "PENDING" } }),
      prisma.scheduleChangeRequest.count({ where: { status: "APPROVED" } }),
      prisma.scheduleChangeRequest.count({ where: { status: "REJECTED" } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
    };
  }
}
