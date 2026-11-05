import { createHash, randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { ExternalStudentEmailService } from "./external-student-email.service";
import { VerificationDeliveryError } from "./magang-verification-email.service";
import { withSerializableRetry } from "./schedule-availability";

const TTL_MS = 24 * 60 * 60 * 1000;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function verificationUrl(token: string): string {
  const url = new URL("/register/external-student/verify", process.env.APP_URL || "http://localhost:3000");
  url.searchParams.set("token", token);
  return url.toString();
}

export class ExternalStudentRegistrationService {
  static async register(input: { name: string; nim: string; email: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const nim = input.nim.trim().toUpperCase();
    const rawToken = randomBytes(32).toString("base64url");
    const hash = tokenHash(rawToken);
    const expiresAt = new Date(Date.now() + TTL_MS);

    try {
      await withSerializableRetry(async (tx) => {
        const existing = await tx.user.findFirst({
          where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { nim }] },
          select: { id: true },
        });
        if (existing) throw new Error("EMAIL_OR_NIM_EXISTS");
        const request = await tx.accessRequest.create({
          data: {
            requestCode: `EXT-${randomUUID().slice(0, 8).toUpperCase()}`,
            type: "MAHASISWA_EKSTERNAL",
            applicantName: input.name.trim(),
            applicantEmail: email,
            applicantNim: nim,
            title: "Pendaftaran Mahasiswa Prodi Lain",
            requestedRole: "MAHASISWA",
          },
        });
        const temporaryPassword = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
        const user = await tx.user.create({
          data: { email, nim, name: input.name.trim(), password: temporaryPassword, role: "MAHASISWA", isActive: false, registrationSource: "EXTERNAL_SELF_REGISTRATION" },
        });
        await tx.accessRequest.update({ where: { id: request.id }, data: { userId: user.id } });
        await tx.externalStudentVerification.create({
          data: { tokenHash: hash, expiresAt, userId: user.id, accessRequestId: request.id },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("EMAIL_OR_NIM_EXISTS");
      throw error;
    }

    try {
      await ExternalStudentEmailService.sendVerification(email, verificationUrl(rawToken), input.name.trim());
    } catch {
      throw new VerificationDeliveryError();
    }
  }

  static async resend(emailInput: string): Promise<void> {
    const email = emailInput.trim().toLowerCase();
    const rawToken = randomBytes(32).toString("base64url");
    const hash = tokenHash(rawToken);
    const expiresAt = new Date(Date.now() + TTL_MS);
    const user = await prisma.$transaction(async (tx) => {
      const candidate = await tx.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, role: "MAHASISWA", isActive: false, externalStudentVerification: { isNot: null } },
        include: { externalStudentVerification: true },
      });
      if (!candidate?.externalStudentVerification) return null;
      await tx.externalStudentVerification.update({
        where: { id: candidate.externalStudentVerification.id },
        data: { tokenHash: hash, expiresAt, consumedAt: null },
      });
      return { name: candidate.name };
    });
    if (!user) return;
    await ExternalStudentEmailService.sendVerification(email, verificationUrl(rawToken), user.name);
  }

  static async verify(input: { token: string; password: string }): Promise<void> {
    const hash = tokenHash(input.token);
    const password = await bcrypt.hash(input.password, 12);
    await prisma.$transaction(async (tx) => {
      const verification = await tx.externalStudentVerification.findUnique({
        where: { tokenHash: hash },
        include: { user: true, accessRequest: true },
      });
      const now = new Date();
      if (!verification || verification.consumedAt || verification.expiresAt <= now || verification.user.isActive || verification.accessRequest.type !== "MAHASISWA_EKSTERNAL") {
        throw new Error("INVALID_TOKEN");
      }
      const consumed = await tx.externalStudentVerification.updateMany({
        where: { id: verification.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new Error("INVALID_TOKEN");
      const activated = await tx.user.updateMany({
        where: { id: verification.userId, role: "MAHASISWA", isActive: false },
        data: { password, isActive: true },
      });
      if (activated.count !== 1) throw new Error("INVALID_TOKEN");
      await tx.accessRequest.update({
        where: { id: verification.accessRequestId },
        data: { emailVerifiedAt: now, status: "APPROVED", reviewedAt: now },
      });
    });
  }
}
