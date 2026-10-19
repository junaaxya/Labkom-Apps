import prisma from "../config/database";
import { ApprovalConflictError } from "./approval-conflict.error";
import { findOccupancyConflict, operationalScheduleOverlapWhere, withSerializableRetry } from "./schedule-availability";
import { canonicalDateOnly, dateOnlyRange, weekdayForDateOnly } from "./jakarta-time";
import type { CreateBookingInput, GetAllBookingsQueryInput } from "../validators/booking.validator";

type BookingFilters = GetAllBookingsQueryInput;
type BookingActor = { userId: string; role: string };

export class BookingService {
  static async getAllBookings(filters?: BookingFilters) {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.date) {
      const { start, end } = dateOnlyRange(filters.date);
      where.date = {
        gte: start,
        lt: end,
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

  static async getBookingById(id: string, actor: BookingActor) {
    const booking = await prisma.labBooking.findUnique({
      where: { id },
      include: {
        lab: true,
        requester: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!booking) throw new Error("Pengajuan peminjaman tidak ditemukan");
    if (
      actor.role !== "KOORDINATOR_LAB" &&
      booking.requestedBy !== actor.userId
    ) {
      throw new Error("Anda tidak memiliki akses ke data ini");
    }

    return booking;
  }

  static async createBooking(data: CreateBookingInput, userId: string) {
    return withSerializableRetry(async (tx) => {
      const requester = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, isKetuaKelas: true },
      });
      if (!requester || (requester.role !== "MAHASISWA" && !requester.isKetuaKelas)) {
        throw new Error("Hanya mahasiswa atau ketua kelas yang dapat mengajukan peminjaman lab");
      }

      const lab = await tx.lab.findUnique({ where: { id: data.labId } });
      if (!lab) throw new Error("Lab tidak ditemukan");

      const date = canonicalDateOnly(data.date);
      const day = weekdayForDateOnly(date);
      const scheduleConflict = await tx.schedule.findFirst({
        where: {
          labId: data.labId,
          ...operationalScheduleOverlapWhere({
            labId: data.labId,
            day,
            startTime: data.startTime,
            endTime: data.endTime,
            specificDate: date,
          }),
        },
      });
      if (scheduleConflict) {
        throw new Error(`Waktu bentrok dengan jadwal "${scheduleConflict.title}" (${scheduleConflict.startTime}-${scheduleConflict.endTime})`);
      }

      const bookingConflict = await tx.labBooking.findFirst({
        where: {
          labId: data.labId,
          date,
          status: { in: ["PENDING", "APPROVED"] },
          startTime: { lt: data.endTime },
          endTime: { gt: data.startTime },
        },
      });
      if (bookingConflict) {
        throw new Error(`Waktu bentrok dengan pengajuan lain (${bookingConflict.startTime}-${bookingConflict.endTime})`);
      }

      return tx.labBooking.create({
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
    });
  }

  static async approveBooking(id: string, approverId: string) {
    return withSerializableRetry(async (tx) => {
      const booking = await tx.labBooking.findUnique({ where: { id } });
      if (!booking) throw new Error("Pengajuan peminjaman tidak ditemukan");
      if (booking.status !== "PENDING") throw new Error("Hanya pengajuan berstatus PENDING yang dapat disetujui");

      const date = canonicalDateOnly(booking.date);
      const day = weekdayForDateOnly(date);
      const conflict = await findOccupancyConflict(
        tx,
        {
          labId: booking.labId,
          day,
          startTime: booking.startTime,
          endTime: booking.endTime,
          specificDate: date,
        },
        { excludeBookingId: booking.id }
      );

      if (conflict?.kind === "SCHEDULE") {
        throw new ApprovalConflictError(
          `Tidak dapat menyetujui karena bentrok dengan jadwal "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`
        );
      }

      if (conflict?.kind === "BOOKING") {
        throw new ApprovalConflictError("Tidak dapat menyetujui karena bentrok dengan peminjaman lab lain yang sudah disetujui");
      }

      const approved = await tx.labBooking.update({
        where: { id },
        data: { status: "APPROVED", approvedBy: approverId, rejectionReason: null },
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
          specificDate: date,
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
