import { randomUUID } from "crypto";
import prisma from "../config/database";
import type { Role } from "@prisma/client";
import type {
  CreateAccessRequestInput,
  GetAccessRequestsQueryInput,
  UpdateAccessRequestStatusInput,
} from "../validators/access-request.validator";

function createRequestCode(type: CreateAccessRequestInput["type"]): string {
  const prefix = type === "PEMINJAMAN_LAB" ? "BOOK" : type === "MAGANG" ? "MAG" : "ACC";
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toDayOfWeek(date: Date): "SENIN" | "SELASA" | "RABU" | "KAMIS" | "JUMAT" | "SABTU" | "MINGGU" {
  const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;
  return dayNames[date.getDay()];
}

const accessRequestInclude = {
  lab: { select: { id: true, name: true, location: true } },
  reviewer: { select: { id: true, name: true, email: true, role: true } },
  booking: { select: { id: true, status: true, title: true, date: true, startTime: true, endTime: true } },
} as const;

type PublicAccessRequest = {
  id: string;
  requestCode: string;
  type: CreateAccessRequestInput["type"];
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVISION";
  title: string;
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  requestedRole: Role | null;
  reviewerNotes: string | null;
  reviewedAt: Date | null;
  lab: { id: string; name: string; location: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicStatus(request: PublicAccessRequest | null) {
  if (!request) return null;

  return {
    id: request.id,
    requestCode: request.requestCode,
    type: request.type,
    status: request.status,
    title: request.title,
    date: request.date,
    startTime: request.startTime,
    endTime: request.endTime,
    requestedRole: request.requestedRole,
    reviewerNotes: request.reviewerNotes,
    reviewedAt: request.reviewedAt,
    lab: request.lab,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export class AccessRequestService {
  static async getPublicLabs() {
    return prisma.lab.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, location: true },
      orderBy: { name: "asc" },
    });
  }

  static async createRequest(data: CreateAccessRequestInput) {
    const requestCode = createRequestCode(data.type);

    return prisma.accessRequest.create({
      data: {
        requestCode,
        type: data.type,
        applicantName: data.applicantName,
        applicantEmail: data.applicantEmail.toLowerCase(),
        applicantPhone: data.applicantPhone,
        institution: data.institution,
        title: data.title,
        description: data.description,
        purpose: data.purpose,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        participants: data.participants,
        requestedRole: data.requestedRole,
        labId: data.labId,
      },
      include: accessRequestInclude,
    });
  }

  static async getByCode(requestCode: string) {
    const request = await prisma.accessRequest.findUnique({
      where: { requestCode },
      include: accessRequestInclude,
    });

    if (!request) throw new Error("Pengajuan tidak ditemukan");
    return toPublicStatus(request);
  }

  static async getById(id: string) {
    const request = await prisma.accessRequest.findUnique({
      where: { id },
      include: accessRequestInclude,
    });

    if (!request) throw new Error("Pengajuan tidak ditemukan");
    return request;
  }

  static async getAll(query: GetAccessRequestsQueryInput) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const [items, total] = await prisma.$transaction([
      prisma.accessRequest.findMany({
        where,
        include: accessRequestInclude,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.accessRequest.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async reviewRequest(id: string, reviewerId: string, input: UpdateAccessRequestStatusInput) {
    const request = await prisma.accessRequest.findUnique({ where: { id } });
    if (!request) throw new Error("Pengajuan tidak ditemukan");
    if (request.status !== "PENDING" && request.status !== "REVISION") {
      throw new Error("Hanya pengajuan PENDING atau REVISION yang dapat diproses");
    }

    if (input.status !== "APPROVED") {
      return prisma.accessRequest.update({
        where: { id },
        data: {
          status: input.status,
          reviewerNotes: input.reviewerNotes,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: accessRequestInclude,
      });
    }

    if (request.type !== "PEMINJAMAN_LAB") {
      return prisma.accessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewerNotes: input.reviewerNotes,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: accessRequestInclude,
      });
    }

    if (!request.labId || !request.date || !request.startTime || !request.endTime || !request.participants) {
      throw new Error("Pengajuan peminjaman lab belum lengkap untuk disetujui");
    }

    const day = toDayOfWeek(request.date);

    const [conflictWithSchedules, conflictWithBookings] = await Promise.all([
      prisma.schedule.findFirst({
        where: {
          labId: request.labId,
          isActive: true,
          startTime: { lt: request.endTime },
          endTime: { gt: request.startTime },
          OR: [
            { specificDate: request.date },
            { specificDate: null, day },
          ],
        },
      }),
      prisma.labBooking.findFirst({
        where: {
          labId: request.labId,
          date: request.date,
          status: { in: ["PENDING", "APPROVED"] },
          startTime: { lt: request.endTime },
          endTime: { gt: request.startTime },
        },
      }),
    ]);

    if (conflictWithSchedules) {
      throw new Error(`Waktu bentrok dengan jadwal "${conflictWithSchedules.title}" (${conflictWithSchedules.startTime}-${conflictWithSchedules.endTime})`);
    }

    if (conflictWithBookings) {
      throw new Error(`Waktu bentrok dengan pengajuan lain (${conflictWithBookings.startTime}-${conflictWithBookings.endTime})`);
    }

    return prisma.$transaction(async (tx) => {
      const booking = await tx.labBooking.create({
        data: {
          labId: request.labId!,
          requestedBy: request.userId,
          externalRequesterName: request.userId ? undefined : request.applicantName,
          externalRequesterEmail: request.userId ? undefined : request.applicantEmail,
          externalRequesterPhone: request.userId ? undefined : request.applicantPhone,
          externalInstitution: request.userId ? undefined : request.institution,
          title: request.title,
          description: request.description,
          purpose: (request.purpose as "UKM" | "Lomba" | "Kerja Kelompok" | "Riset" | "Pelatihan" | "Lainnya") ?? "Lainnya",
          date: request.date!,
          startTime: request.startTime!,
          endTime: request.endTime!,
          participants: request.participants!,
          notes: request.reviewerNotes ?? input.reviewerNotes,
          status: "APPROVED",
          approvedBy: reviewerId,
        },
      });

      await tx.schedule.create({
        data: {
          labId: request.labId!,
          title: request.title,
          specificDate: request.date!,
          day,
          startTime: request.startTime!,
          endTime: request.endTime!,
          type: "PEMINJAMAN",
          status: "SCHEDULED",
          isActive: true,
          className: `Booking:${booking.id}`,
          assistantId: reviewerId,
        },
      });

      return tx.accessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewerNotes: input.reviewerNotes,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          bookingId: booking.id,
        },
        include: accessRequestInclude,
      });
    });
  }
}
