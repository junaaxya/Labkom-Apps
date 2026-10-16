import { createHash, randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/database";
import { Prisma, type Role } from "@prisma/client";
import { ApprovalConflictError } from "./approval-conflict.error";
import { findOccupancyConflict, withSerializableRetry } from "./schedule-availability";
import { canonicalDateOnly, weekdayForDateOnly } from "./jakarta-time";
import { MagangVerificationEmailService, VerificationDeliveryError } from "./magang-verification-email.service";
import { MagangApprovalEmailDeliveryService } from "./magang-approval-email-delivery.service";
import type {
  CreateAccessRequestInput,
  GetAccessRequestsQueryInput,
  UpdateAccessRequestStatusInput,
} from "../validators/access-request.validator";

const MAGANG_EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_WINDOW_MS = 10 * 60 * 1000;
const RESEND_LIMIT = 3;
const resendAttempts = new Map<string, { count: number; resetAt: number }>();

type VerificationTokenRow = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  userId: string;
  accessRequestId: string;
  requestType: string;
  requestUserId: string | null;
  emailVerifiedAt: Date | null;
};

type LockedMagangRequestRow = {
  id: string;
  type: string;
  status: string;
  userId: string | null;
  applicantEmail: string;
  applicantName?: string;
  emailVerifiedAt: Date | null;
};

type ResendVerificationRow = {
  id: string;
  userId: string;
  accessRequestId: string;
  applicantEmail: string;
  applicantName?: string;
  status: string;
  emailVerifiedAt: Date | null;
  isActive: boolean;
};

function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;

  const target = error.meta?.target;
  return String(target).toLowerCase().includes("email");
}

function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invalidVerificationToken(): Error {
  return new Error("Token verifikasi tidak valid atau sudah kedaluwarsa");
}

function createVerificationUrl(token: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const verificationUrl = new URL("/magang/verify-email", appUrl);
  verificationUrl.searchParams.set("token", token);
  return verificationUrl.toString();
}

function consumeResendQuota(email: string): boolean {
  const now = Date.now();
  const current = resendAttempts.get(email);
  if (!current || current.resetAt <= now) {
    resendAttempts.set(email, { count: 1, resetAt: now + RESEND_WINDOW_MS });
    return true;
  }
  if (current.count >= RESEND_LIMIT) return false;
  current.count += 1;
  return true;
}

function createRequestCode(type: CreateAccessRequestInput["type"]): string {
  const prefix = type === "PEMINJAMAN_LAB" ? "BOOK" : type === "MAGANG" ? "MAG" : "ACC";
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

const accessRequestInclude = {
  lab: { select: { id: true, name: true, location: true } },
  reviewer: { select: { id: true, name: true, email: true, role: true } },
  booking: { select: { id: true, status: true, title: true, date: true, startTime: true, endTime: true } },
} as const;

type AccessRequestStatusSource = {
  id: string;
  requestCode: string;
  type: CreateAccessRequestInput["type"];
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVISION";
  title: string;
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  requestedRole: Role | null;
  emailVerifiedAt?: Date | null;
  reviewerNotes: string | null;
  reviewedAt: Date | null;
  userId?: string | null;
  lab: { id: string; name: string; location: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicStatus(request: AccessRequestStatusSource | null) {
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
    if (data.type === "MAGANG") {
      return this.createMagangRequest(data);
    }

    const requestCode = createRequestCode(data.type);
    const date = data.date ? canonicalDateOnly(data.date) : undefined;

    const request = await prisma.accessRequest.create({
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
        date,
        startTime: data.startTime,
        endTime: data.endTime,
        participants: data.participants,
        requestedRole: data.requestedRole,
        labId: data.labId,
      },
      include: accessRequestInclude,
    });

    return toPublicStatus(request);
  }

  static async verifyMagangEmail(rawToken: string) {
    const tokenHash = hashVerificationToken(rawToken);

    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<VerificationTokenRow[]>(Prisma.sql`
        SELECT
          verification."id",
          verification."tokenHash",
          verification."expiresAt",
          verification."consumedAt",
          verification."userId",
          verification."accessRequestId",
          request."type"::text AS "requestType",
          request."userId" AS "requestUserId",
          request."emailVerifiedAt"
        FROM "magang_email_verifications" AS verification
        INNER JOIN "access_requests" AS request ON request."id" = verification."accessRequestId"
        WHERE verification."tokenHash" = ${tokenHash}
        FOR UPDATE OF verification, request
      `);
      const verification = rows[0];
      const now = new Date();

      if (
        !verification ||
        verification.requestType !== "MAGANG" ||
        verification.requestUserId !== verification.userId ||
        verification.consumedAt ||
        verification.emailVerifiedAt ||
        verification.expiresAt <= now
      ) {
        throw invalidVerificationToken();
      }

      const consumedCount = await tx.$executeRaw(Prisma.sql`
        UPDATE "magang_email_verifications"
        SET "consumedAt" = ${now}
        WHERE "id" = ${verification.id}
          AND "consumedAt" IS NULL
          AND "expiresAt" > ${now}
      `);
      if (consumedCount !== 1) throw invalidVerificationToken();

      const verifiedCount = await tx.$executeRaw(Prisma.sql`
        UPDATE "access_requests"
        SET "emailVerifiedAt" = ${now}, "updatedAt" = ${now}
        WHERE "id" = ${verification.accessRequestId}
          AND "userId" = ${verification.userId}
          AND "type" = 'MAGANG'
          AND "emailVerifiedAt" IS NULL
      `);
      if (verifiedCount !== 1) throw invalidVerificationToken();

      return { verifiedAt: now };
    });
  }

  static async resendMagangVerification(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    if (!consumeResendQuota(normalizedEmail)) return;
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGANG_EMAIL_VERIFICATION_TTL_MS);
    const row = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ResendVerificationRow[]>(Prisma.sql`
        SELECT verification."id", verification."userId", verification."accessRequestId", request."applicantEmail",
               request."applicantName", request."status"::text AS "status", request."emailVerifiedAt", user_record."isActive"
        FROM "magang_email_verifications" AS verification
        INNER JOIN "access_requests" AS request ON request."id" = verification."accessRequestId"
        INNER JOIN "users" AS user_record ON user_record."id" = verification."userId"
        WHERE request."applicantEmail" = ${normalizedEmail}
        FOR UPDATE OF verification, request, user_record
      `);
      const candidate = rows[0];
      if (!candidate || candidate.status !== "PENDING" || candidate.emailVerifiedAt || candidate.isActive) return null;
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE "magang_email_verifications"
        SET "tokenHash" = ${tokenHash}, "expiresAt" = ${expiresAt}, "consumedAt" = NULL
        WHERE "id" = ${candidate.id}
      `);
      return updated === 1 ? candidate : null;
    });
    if (!row) return;
    try {
      await MagangVerificationEmailService.sendVerification(normalizedEmail, createVerificationUrl(rawToken), row.applicantName);
    } catch {
      return;
    }
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

    if (input.status === "APPROVED" && request.type === "PEMINJAMAN_LAB") {
      return withSerializableRetry(async (tx) => {
        const currentRequest = await tx.accessRequest.findUnique({ where: { id } });
        if (!currentRequest) throw new Error("Pengajuan tidak ditemukan");
        if (currentRequest.status !== "PENDING" && currentRequest.status !== "REVISION") {
          throw new Error("Hanya pengajuan PENDING atau REVISION yang dapat diproses");
        }
        if (!currentRequest.labId || !currentRequest.date || !currentRequest.startTime || !currentRequest.endTime || !currentRequest.participants) {
          throw new Error("Pengajuan peminjaman lab belum lengkap untuk disetujui");
        }

        const date = canonicalDateOnly(currentRequest.date);
        const day = weekdayForDateOnly(date);
        const conflict = await findOccupancyConflict(tx, {
          labId: currentRequest.labId,
          day,
          startTime: currentRequest.startTime,
          endTime: currentRequest.endTime,
          specificDate: date,
        });

        if (conflict?.kind === "SCHEDULE") {
          throw new ApprovalConflictError(`Waktu bentrok dengan jadwal "${conflict.title}" (${conflict.startTime}-${conflict.endTime})`);
        }

        if (conflict?.kind === "BOOKING") {
          throw new ApprovalConflictError("Waktu bentrok dengan peminjaman lab lain yang sudah disetujui");
        }

        const booking = await tx.labBooking.create({
          data: {
            labId: currentRequest.labId,
            requestedBy: currentRequest.userId,
            externalRequesterName: currentRequest.userId ? undefined : currentRequest.applicantName,
            externalRequesterEmail: currentRequest.userId ? undefined : currentRequest.applicantEmail,
            externalRequesterPhone: currentRequest.userId ? undefined : currentRequest.applicantPhone,
            externalInstitution: currentRequest.userId ? undefined : currentRequest.institution,
            title: currentRequest.title,
            description: currentRequest.description,
            purpose: (currentRequest.purpose as "UKM" | "Lomba" | "Kerja Kelompok" | "Riset" | "Pelatihan" | "Lainnya") ?? "Lainnya",
            date,
            startTime: currentRequest.startTime,
            endTime: currentRequest.endTime,
            participants: currentRequest.participants,
            notes: currentRequest.reviewerNotes ?? input.reviewerNotes,
            status: "APPROVED",
            approvedBy: reviewerId,
          },
        });

        await tx.schedule.create({
          data: {
            labId: currentRequest.labId,
            title: currentRequest.title,
            specificDate: date,
            day,
            startTime: currentRequest.startTime,
            endTime: currentRequest.endTime,
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

    if (request.type === "MAGANG") {
      return this.reviewMagangRequest(id, reviewerId, input);
    }

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

    if (request.type === "AKSES_SEMENTARA") {
      const normalizedEmail = request.applicantEmail.toLowerCase();
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        throw new Error("Email pengajuan sudah terdaftar. Gunakan email lain atau tindak lanjuti manual.");
      }

      const temporaryPasswordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
      const temporaryRole: Role = "MAGANG";

      return prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: temporaryPasswordHash,
            name: request.applicantName,
            phone: request.applicantPhone,
            role: temporaryRole,
            className: "AKSES_SEMENTARA",
            isActive: true,
            mustChangePassword: true,
          },
          select: { id: true },
        });

        return tx.accessRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewerNotes: input.reviewerNotes,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            userId: user.id,
          },
          include: accessRequestInclude,
        });
      });
    }

  }

  private static async createMagangRequest(data: Extract<CreateAccessRequestInput, { type: "MAGANG" }>) {
    const normalizedEmail = data.applicantEmail.toLowerCase();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashVerificationToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGANG_EMAIL_VERIFICATION_TTL_MS);
    const requestCode = createRequestCode("MAGANG");

    let request;
    try {
      request = await withSerializableRetry(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: "insensitive" } },
          select: { id: true },
        });
        if (existingUser) throw new Error("Email sudah terdaftar");

        const accessRequest = await tx.accessRequest.create({
          data: {
            requestCode,
            type: "MAGANG",
            applicantName: data.applicantName,
            applicantEmail: normalizedEmail,
            applicantPhone: data.applicantPhone,
            institution: data.institution,
            title: data.title,
            description: data.description,
            purpose: data.purpose,
            requestedRole: "MAGANG",
            labId: data.labId,
          },
        });
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: passwordHash,
            name: data.applicantName,
            phone: data.applicantPhone,
            role: "MAGANG",
            className: "MAGANG",
            isActive: false,
            mustChangePassword: false,
          },
          select: { id: true },
        });
        const linkedRequest = await tx.accessRequest.update({
          where: { id: accessRequest.id },
          data: { userId: user.id },
          include: accessRequestInclude,
        });
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "magang_email_verifications" (
            "id", "tokenHash", "expiresAt", "userId", "accessRequestId", "createdAt"
          )
          VALUES (${randomUUID()}, ${tokenHash}, ${expiresAt}, ${user.id}, ${accessRequest.id}, ${new Date()})
        `);

        return linkedRequest;
      });
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new Error("Email sudah terdaftar");
      }
      throw error;
    }

    try {
      await MagangVerificationEmailService.sendVerification(normalizedEmail, createVerificationUrl(rawToken), data.applicantName);
    } catch (error) {
      if (error instanceof VerificationDeliveryError) throw error;
      throw new VerificationDeliveryError();
    }

    return toPublicStatus(request);
  }

  private static async reviewMagangRequest(id: string, reviewerId: string, input: UpdateAccessRequestStatusInput) {
    let approvalEmailDeliveryId: string | null = null;
    let rejectionEmail: string | null = null;
    let rejectionName: string | undefined = undefined;
    const reviewedRequest = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedMagangRequestRow[]>(Prisma.sql`
        SELECT
          "id",
          "type"::text AS "type",
          "status"::text AS "status",
          "userId",
          "applicantEmail",
          "applicantName",
          "emailVerifiedAt"
        FROM "access_requests"
        WHERE "id" = ${id}
        FOR UPDATE
      `);
      const request = rows[0];

      if (!request) throw new Error("Pengajuan tidak ditemukan");
      if (request.type !== "MAGANG" || (request.status !== "PENDING" && request.status !== "REVISION")) {
        throw new Error("Hanya pengajuan PENDING atau REVISION yang dapat diproses");
      }

      if (input.status === "REJECTED") {
        const rejected = await tx.accessRequest.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewerNotes: input.reviewerNotes,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
          include: accessRequestInclude,
        });
        rejectionEmail = request.applicantEmail;
        rejectionName = request.applicantName;
        return rejected;
      }

      if (!request.userId || !request.emailVerifiedAt) {
        throw new Error("Pengajuan MAGANG belum menyelesaikan verifikasi email");
      }

      const verificationRows = await tx.$queryRaw<VerificationTokenRow[]>(Prisma.sql`
        SELECT
          verification."id",
          verification."tokenHash",
          verification."expiresAt",
          verification."consumedAt",
          verification."userId",
          verification."accessRequestId",
          request."type"::text AS "requestType",
          request."userId" AS "requestUserId",
          request."emailVerifiedAt"
        FROM "magang_email_verifications" AS verification
        INNER JOIN "access_requests" AS request ON request."id" = verification."accessRequestId"
        WHERE verification."accessRequestId" = ${id}
        FOR UPDATE OF verification
      `);
      const verification = verificationRows[0];
      if (
        !verification ||
        verification.userId !== request.userId ||
        verification.accessRequestId !== request.id ||
        verification.requestUserId !== request.userId ||
        !verification.consumedAt
      ) {
        throw new Error("Pengajuan MAGANG belum menyelesaikan verifikasi email");
      }

      const user = await tx.user.findUnique({
        where: { id: request.userId },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (
        !user ||
        user.id !== request.userId ||
        user.email !== request.applicantEmail.toLowerCase() ||
        user.role !== "MAGANG" ||
        user.isActive
      ) {
        throw new Error("Akun MAGANG terkait tidak valid untuk disetujui");
      }

      const activation = await tx.user.updateMany({
        where: { id: user.id, role: "MAGANG", isActive: false },
        data: { isActive: true },
      });
      if (activation.count !== 1) {
        throw new Error("Akun MAGANG terkait tidak valid untuk disetujui");
      }

      const approvedRequest = await tx.accessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewerNotes: input.reviewerNotes,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: accessRequestInclude,
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: "SYSTEM",
          title: "Akun MAGANG Aktif",
          message: "Akun MAGANG Anda telah aktif dan dapat login.",
        },
      });

      const delivery = await (tx as unknown as {
        magangApprovalEmailDelivery: {
          create: (args: { data: { accessRequestId: string; recipientEmail: string } }) => Promise<{ id: string }>;
        };
      }).magangApprovalEmailDelivery.create({
        data: {
          accessRequestId: approvedRequest.id,
          recipientEmail: request.applicantEmail,
        },
      });
      approvalEmailDeliveryId = delivery.id;
      return approvedRequest;
    });

    if (approvalEmailDeliveryId !== null) {
      try {
        await MagangApprovalEmailDeliveryService.dispatch(approvalEmailDeliveryId);
      } catch {}
    }
    if (rejectionEmail !== null) {
      const informationUrl = `${process.env.APP_URL || "http://localhost:3000"}/register`;
      try { await MagangVerificationEmailService.sendRejectionNotification(rejectionEmail, informationUrl, rejectionName); } catch {}
    }

    return reviewedRequest;
  }

  static async requeueApprovalEmail(accessRequestId: string): Promise<boolean> {
    const request = await prisma.accessRequest.findUnique({
      where: { id: accessRequestId },
      select: { id: true, type: true, status: true },
    });
    if (!request || request.type !== "MAGANG" || request.status !== "APPROVED") {
      throw new Error("Hanya pengajuan MAGANG yang telah disetujui yang dapat di-requeue");
    }

    const delivery = await (prisma as unknown as {
      magangApprovalEmailDelivery: {
        findUnique: (args: { where: { accessRequestId: string } }) => Promise<{ id: string; status: string } | null>;
      };
    }).magangApprovalEmailDelivery.findUnique({
      where: { accessRequestId },
    });

    if (!delivery) {
      throw new Error("Data pengiriman email tidak ditemukan");
    }
    if (delivery.status !== "FAILED") {
      throw new Error("Hanya pengiriman dengan status FAILED yang dapat di-requeue");
    }

    const requeued = await MagangApprovalEmailDeliveryService.requeue(delivery.id);
    return requeued;
  }
}
