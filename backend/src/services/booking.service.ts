import prisma from "../config/database";
import type { CreateBookingInput, GetAllBookingsQueryInput } from "../validators/booking.validator";

type BookingFilters = GetAllBookingsQueryInput;

function toDayOfWeek(date: Date): "SENIN" | "SELASA" | "RABU" | "KAMIS" | "JUMAT" | "SABTU" | "MINGGU" {
  const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;
  return dayNames[date.getDay()];
}

export class BookingService {
  static async getAllBookings(filters?: BookingFilters) {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.date) {
      const dateOnly = new Date(filters.date);
      dateOnly.setHours(0, 0, 0, 0);
      const nextDate = new Date(dateOnly);
      nextDate.setDate(nextDate.getDate() + 1);
      where.date = {
        gte: dateOnly,
        lt: nextDate,
      };
    }

    const [items, total] = await prisma.$transaction([
      prisma.labBooking.findMany({
        where,
        include: {
          lab: { select: { id: true, name: true, location: true } },
          requester: { select: { id: true, name: true, email: true, role: true } },
          approver: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
        skip,
        take: limit,
      }),
      prisma.labBooking.count({ where }),
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

  static async getMyBookings(userId: string) {
    return prisma.labBooking.findMany({
      where: { requestedBy: userId },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
    });
  }

  static async getBookingById(id: string) {
    const booking = await prisma.labBooking.findUnique({
      where: { id },
      include: {
        lab: true,
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!booking) throw new Error("Pengajuan peminjaman tidak ditemukan");
    return booking;
  }

  static async createBooking(data: CreateBookingInput, userId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isKetuaKelas: true },
    });

    if (!requester || (requester.role !== "MAHASISWA" && !requester.isKetuaKelas)) {
      throw new Error("Hanya mahasiswa atau ketua kelas yang dapat mengajukan peminjaman lab");
    }

    const lab = await prisma.lab.findUnique({ where: { id: data.labId } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    const date = new Date(data.date);
    date.setHours(0, 0, 0, 0);
    const day = toDayOfWeek(date);

    const [conflictWithSchedules, conflictWithBookings] = await Promise.all([
      prisma.schedule.findFirst({
        where: {
          labId: data.labId,
          day,
          isActive: true,
          startTime: { lt: data.endTime },
          endTime: { gt: data.startTime },
        },
      }),
      prisma.labBooking.findFirst({
        where: {
          labId: data.labId,
          date,
          status: { in: ["PENDING", "APPROVED"] },
          startTime: { lt: data.endTime },
          endTime: { gt: data.startTime },
        },
      }),
    ]);

    if (conflictWithSchedules) {
      throw new Error(
        `Waktu bentrok dengan jadwal "${conflictWithSchedules.title}" (${conflictWithSchedules.startTime}-${conflictWithSchedules.endTime})`
      );
    }

    if (conflictWithBookings) {
      throw new Error(
        `Waktu bentrok dengan pengajuan lain (${conflictWithBookings.startTime}-${conflictWithBookings.endTime})`
      );
    }

    return prisma.labBooking.create({
      data: {
        labId: data.labId,
        requestedBy: userId,
        title: data.title,
        description: data.description,
        purpose: data.purpose,
        date,
        startTime: data.startTime,
        endTime: data.endTime,
        participants: data.participants,
        notes: data.notes,
      },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        requester: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  static async approveBooking(id: string, approverId: string) {
    const booking = await prisma.labBooking.findUnique({ where: { id } });
    if (!booking) throw new Error("Pengajuan peminjaman tidak ditemukan");
    if (booking.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat disetujui");

    const day = toDayOfWeek(booking.date);

    const [conflictWithSchedules, conflictWithBookings] = await Promise.all([
      prisma.schedule.findFirst({
        where: {
          labId: booking.labId,
          day,
          isActive: true,
          startTime: { lt: booking.endTime },
          endTime: { gt: booking.startTime },
        },
      }),
      prisma.labBooking.findFirst({
        where: {
          id: { not: booking.id },
          labId: booking.labId,
          date: booking.date,
          status: "APPROVED",
          startTime: { lt: booking.endTime },
          endTime: { gt: booking.startTime },
        },
      }),
    ]);

    if (conflictWithSchedules) {
      throw new Error(
        `Tidak dapat menyetujui karena bentrok dengan jadwal "${conflictWithSchedules.title}" (${conflictWithSchedules.startTime}-${conflictWithSchedules.endTime})`
      );
    }

    if (conflictWithBookings) {
      throw new Error("Tidak dapat menyetujui karena bentrok dengan peminjaman lab lain yang sudah disetujui");
    }

    return prisma.$transaction(async (tx) => {
      const approved = await tx.labBooking.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedBy: approverId,
          rejectionReason: null,
        },
        include: {
          lab: { select: { id: true, name: true, location: true } },
          requester: { select: { id: true, name: true, email: true, role: true } },
          approver: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      await tx.schedule.create({
        data: {
          labId: booking.labId,
          title: booking.title,
          day,
          startTime: booking.startTime,
          endTime: booking.endTime,
          type: "PEMINJAMAN",
          status: "SCHEDULED",
          isActive: true,
          className: `Booking:${booking.id}`,
          assistantId: approverId,
        },
      });

      return approved;
    });
  }

  static async rejectBooking(id: string, approverId: string, reason: string) {
    const booking = await prisma.labBooking.findUnique({ where: { id } });
    if (!booking) throw new Error("Pengajuan peminjaman tidak ditemukan");
    if (booking.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat ditolak");

    return prisma.labBooking.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: approverId,
        rejectionReason: reason,
      },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  static async cancelBooking(id: string, userId: string) {
    const booking = await prisma.labBooking.findUnique({ where: { id } });
    if (!booking) throw new Error("Pengajuan peminjaman tidak ditemukan");
    if (booking.requestedBy !== userId) throw new Error("Anda tidak berhak membatalkan pengajuan ini");
    if (booking.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat dibatalkan");

    return prisma.labBooking.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: {
        lab: { select: { id: true, name: true, location: true } },
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}
