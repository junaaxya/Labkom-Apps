import prisma from "../config/database";

const leaveInclude = {
  user: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true } },
};

function getDayRange(date: string): { start: Date; end: Date } {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new Error("Tanggal tidak valid");

  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export class LeaveService {
  static async createRequest(userId: string, type: "SICK" | "PERMISSION", date: string, reason: string) {
    if (!reason?.trim()) throw new Error("Alasan wajib diisi");

    const { start, end } = getDayRange(date);

    const duplicate = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
    });

    if (duplicate) throw new Error("Pengajuan izin/sakit untuk tanggal tersebut sudah ada");

    return prisma.leaveRequest.create({
      data: {
        userId,
        type: type as any,
        date: start,
        reason,
        status: "PENDING" as any,
      },
      include: leaveInclude,
    });
  }

  static async getMyRequests(userId: string, status?: string, page = 1, limit = 20) {
    const where: any = { userId };
    if (status) where.status = status;

    const normalizedPage = page > 0 ? page : 1;
    const normalizedLimit = limit > 0 ? limit : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [items, total] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where,
        include: leaveInclude,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: normalizedLimit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  static async getAllRequests(status?: string, page = 1, limit = 20) {
    const where: any = {};
    if (status) where.status = status;

    const normalizedPage = page > 0 ? page : 1;
    const normalizedLimit = limit > 0 ? limit : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [items, total] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where,
        include: leaveInclude,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: normalizedLimit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  static async getPendingCount() {
    return prisma.leaveRequest.count({ where: { status: "PENDING" as any } });
  }

  static async approveRequest(requestId: string, reviewerId: string, reviewNote?: string) {
    const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("Pengajuan izin/sakit tidak ditemukan");
    if (request.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat disetujui");

    const targetDate = new Date(request.date);
    targetDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.$transaction(async (tx) => {
      const approved = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED" as any,
          reviewedBy: reviewerId,
          reviewNote,
          reviewedAt: new Date(),
        },
        include: leaveInclude,
      });

      const attendance = await tx.attendance.findFirst({
        where: {
          userId: request.userId,
          createdAt: { gte: targetDate, lte: endOfDay },
        },
      });

      if (attendance) {
        await tx.attendance.update({
          where: { id: attendance.id },
          data: {
            status: request.type as any,
            notes: request.reason,
          },
        });
      } else {
        await tx.attendance.create({
          data: {
            userId: request.userId,
            status: request.type as any,
            notes: request.reason,
            checkinAt: null,
            checkoutAt: null,
            createdAt: targetDate,
          },
        });
      }

      return approved;
    });
  }

  static async rejectRequest(requestId: string, reviewerId: string, reviewNote?: string) {
    const request = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("Pengajuan izin/sakit tidak ditemukan");
    if (request.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat ditolak");

    return prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED" as any,
        reviewedBy: reviewerId,
        reviewNote,
        reviewedAt: new Date(),
      },
      include: leaveInclude,
    });
  }

  static async getRequestsByUser(userId: string) {
    return prisma.leaveRequest.findMany({
      where: { userId },
      include: leaveInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  }
}
