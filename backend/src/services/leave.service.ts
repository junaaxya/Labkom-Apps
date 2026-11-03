import { Prisma } from "@prisma/client";
import prisma from "../config/database";

const leaveInclude = {
  user: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true } },
};

function getDayRange(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Tanggal harus berformat YYYY-MM-DD");
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) throw new Error("Tanggal tidak valid");
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function pagination(page: number, limit: number) {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
  return { normalizedPage, normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit };
}

function validateLeaveStatus(status?: string): "PENDING" | "APPROVED" | "REJECTED" | undefined {
  if (status === undefined || status === "") return undefined;
  if (!(["PENDING", "APPROVED", "REJECTED"] as const).includes(status as any)) throw new Error("Status pengajuan izin tidak valid");
  return status as "PENDING" | "APPROVED" | "REJECTED";
}

export class LeaveService {
  static async createRequest(
    userId: string,
    type: "SICK" | "PERMISSION",
    date: string,
    reason: string,
    evidenceUrl?: string,
  ) {
    const cleanReason = reason?.trim();
    if (!cleanReason || cleanReason.length < 5 || cleanReason.length > 1000) throw new Error("Alasan izin harus 5-1000 karakter");
    if (evidenceUrl && !evidenceUrl.startsWith("/uploads/") && !/^https:\/\//i.test(evidenceUrl)) {
      throw new Error("URL bukti izin tidak valid");
    }
    if (type === "SICK" && !evidenceUrl) throw new Error("Bukti sakit wajib dilampirkan");
    const { start, end } = getDayRange(date);
    if (date < jakartaToday()) throw new Error("Pengajuan izin untuk tanggal lampau harus melalui koreksi absensi");

    const schedule = await prisma.asLabShiftSchedule.findFirst({
      where: { userId, scheduleDate: start, status: "SCHEDULED" },
      select: { id: true },
    });
    if (!schedule) throw new Error("Pengajuan izin hanya dapat dibuat untuk tanggal yang memiliki jadwal piket");

    const duplicate = await prisma.leaveRequest.findFirst({ where: { userId, date: { gte: start, lte: end } } });
    if (duplicate) throw new Error("Pengajuan izin/sakit untuk tanggal tersebut sudah ada");

    try {
      return await prisma.leaveRequest.create({
        data: {
          userId,
          type,
          date: start,
          reason: cleanReason,
          evidenceUrl: evidenceUrl || null,
          status: "PENDING",
        },
        include: leaveInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Pengajuan izin/sakit untuk tanggal tersebut sudah ada");
      }
      throw error;
    }
  }

  static async getMyRequests(userId: string, status?: string, page = 1, limit = 20) {
    const where: Prisma.LeaveRequestWhereInput = { userId };
    const validatedStatus = validateLeaveStatus(status);
    if (validatedStatus) where.status = validatedStatus;
    const { normalizedPage, normalizedLimit, skip } = pagination(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.leaveRequest.findMany({ where, include: leaveInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip, take: normalizedLimit }),
      prisma.leaveRequest.count({ where }),
    ]);
    return { items, pagination: { total, page: normalizedPage, limit: normalizedLimit, totalPages: Math.ceil(total / normalizedLimit) } };
  }

  static async getAllRequests(status?: string, page = 1, limit = 20) {
    const where: Prisma.LeaveRequestWhereInput = {};
    const validatedStatus = validateLeaveStatus(status);
    if (validatedStatus) where.status = validatedStatus;
    const { normalizedPage, normalizedLimit, skip } = pagination(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.leaveRequest.findMany({ where, include: leaveInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip, take: normalizedLimit }),
      prisma.leaveRequest.count({ where }),
    ]);
    return { items, pagination: { total, page: normalizedPage, limit: normalizedLimit, totalPages: Math.ceil(total / normalizedLimit) } };
  }

  static async getPendingCount() {
    return prisma.leaveRequest.count({ where: { status: "PENDING" } });
  }

  static async approveRequest(requestId: string, reviewerId: string, reviewNote?: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new Error("Pengajuan izin/sakit tidak ditemukan");
      if (request.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat disetujui");

      const schedule = await tx.asLabShiftSchedule.findFirst({
        where: { userId: request.userId, scheduleDate: request.date, status: "SCHEDULED" },
        select: { id: true },
      });
      if (!schedule) throw new Error("Jadwal piket untuk pengajuan ini tidak ditemukan atau sudah dibatalkan");

      const attendance = await tx.attendance.findFirst({ where: { shiftScheduleId: schedule.id } });
      if (attendance) throw new Error("Pengajuan tidak dapat disetujui karena kehadiran untuk shift ini sudah tercatat");

      const approved = await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedBy: reviewerId, reviewNote, reviewedAt: new Date() },
        include: leaveInclude,
      });

      await tx.attendance.create({
        data: {
          userId: request.userId,
          shiftScheduleId: schedule.id,
          status: request.type,
          notes: request.reason,
          checkinAt: null,
          checkoutAt: null,
          createdAt: request.date,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: reviewerId,
          action: "LEAVE_APPROVED",
          targetType: "LeaveRequest",
          targetId: requestId,
          description: `Pengajuan ${request.type === "SICK" ? "sakit" : "izin"} disetujui`,
        },
      });
      return approved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async rejectRequest(requestId: string, reviewerId: string, reviewNote?: string) {
    const cleanNote = reviewNote?.trim();
    if (!cleanNote) throw new Error("Catatan wajib diisi saat menolak pengajuan izin");
    return prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new Error("Pengajuan izin/sakit tidak ditemukan");
      if (request.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat ditolak");
      const rejected = await tx.leaveRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", reviewedBy: reviewerId, reviewNote: cleanNote, reviewedAt: new Date() },
        include: leaveInclude,
      });
      await tx.auditLog.create({
        data: { userId: reviewerId, action: "LEAVE_REJECTED", targetType: "LeaveRequest", targetId: requestId, description: "Pengajuan izin/sakit ditolak" },
      });
      return rejected;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async getRequestsByUser(userId: string) {
    return prisma.leaveRequest.findMany({ where: { userId }, include: leaveInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  }
}
