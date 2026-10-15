import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../config/database";
import { ApprovalConflictError } from "./approval-conflict.error";
import { AccessRequestService } from "./access-request.service";
import { MagangVerificationEmailService } from "./magang-verification-email.service";
import { MagangApprovalEmailDeliveryService } from "./magang-approval-email-delivery.service";
import {
  createAccessRequestSchema,
  type CreateAccessRequestInput,
  updateAccessRequestStatusSchema,
} from "../validators/access-request.validator";

type LabAccessRequest = {
  id: string;
  status: string;
  type: "PEMINJAMAN_LAB";
  labId: string;
  date: Date;
  startTime: string;
  endTime: string;
  participants: number;
  userId: string | null;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  institution: string | null;
  title: string;
  description: string | null;
  purpose: string | null;
  reviewerNotes: string | null;
};

type ExternalApprovalTransaction = {
  accessRequest: {
    findUnique: (args: { where: { id: string } }) => Promise<LabAccessRequest | null>;
    update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  labBooking: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  schedule: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ title: string; startTime: string; endTime: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
};

type SqlStatement = {
  values: readonly unknown[];
};

type VerificationRow = {
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

type LockedMagangRequest = {
  id: string;
  type: string;
  status: string;
  userId: string | null;
  applicantEmail: string;
  emailVerifiedAt: Date | null;
};

type MagangCreationTransaction = {
  user: {
    findFirst: () => Promise<{ id: string } | null>;
    create: (args: { data: Record<string, unknown>; select: { id: true } }) => Promise<{ id: string }>;
  };
  accessRequest: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    update: (args: { where: { id: string }; data: Record<string, unknown>; include: unknown }) => Promise<Record<string, unknown>>;
  };
  $executeRaw: (statement: SqlStatement) => Promise<number>;
};

type MagangReviewTransaction = {
  $queryRaw: (statement: SqlStatement) => Promise<unknown[]>;
  notification: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  user: {
    findUnique: () => Promise<Record<string, unknown> | null>;
    updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  accessRequest: {
    update: (args: { where: { id: string }; data: Record<string, unknown>; include: unknown }) => Promise<Record<string, unknown>>;
  };
  magangApprovalEmailDelivery: {
    create: (args: { data: { accessRequestId: string; recipientEmail: string } }) => Promise<{ id: string }>;
  };
};

type MagangRequestInput = Extract<CreateAccessRequestInput, { type: "MAGANG" }>;

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, property, descriptor);
    } else {
      Reflect.deleteProperty(target, property);
    }
  };
}

function pendingLabRequest(status = "PENDING"): LabAccessRequest {
  return {
    id: "request-1",
    status,
    type: "PEMINJAMAN_LAB",
    labId: "lab-a",
    date: new Date("2026-10-13T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "10:00",
    participants: 20,
    userId: null,
    applicantName: "External Applicant",
    applicantEmail: "external@example.test",
    applicantPhone: "628123",
    institution: "External Campus",
    title: "External event",
    description: "External booking",
    purpose: "Pelatihan",
    reviewerNotes: null,
  };
}

function magangRequestInput(overrides: Partial<MagangRequestInput> = {}): MagangRequestInput {
  return {
    type: "MAGANG",
    applicantName: "Magang Test",
    applicantEmail: "magang@example.test",
    applicantPhone: "628123456789",
    institution: "Universitas Test",
    title: "Program Magang",
    description: "Pengajuan magang laboratorium.",
    purpose: "Magang",
    requestedRole: "MAGANG",
    password: "Magang#Secure2026",
    confirmPassword: "Magang#Secure2026",
    ...overrides,
  };
}

function verificationRow(overrides: Partial<VerificationRow> = {}): VerificationRow {
  return {
    id: "verification-1",
    tokenHash: "token-hash",
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    userId: "magang-user-1",
    accessRequestId: "request-1",
    requestType: "MAGANG",
    requestUserId: "magang-user-1",
    emailVerifiedAt: null,
    ...overrides,
  };
}

function lockedMagangRequest(overrides: Partial<LockedMagangRequest> = {}): LockedMagangRequest {
  return {
    id: "request-1",
    type: "MAGANG",
    status: "PENDING",
    userId: "magang-user-1",
    applicantEmail: "magang@example.test",
    emailVerifiedAt: null,
    ...overrides,
  };
}

test("public access-request status omits reviewer notes and credentials plus verification internals", async () => {
  const restore = replaceProperty(prisma.accessRequest, "findUnique", async () => ({
    id: "request-1",
    requestCode: "MAG-TESTCODE",
    type: "MAGANG",
    status: "APPROVED",
    title: "Magang",
    date: null,
    startTime: null,
    endTime: null,
    requestedRole: "MAGANG",
    userId: "magang-user-1",
    emailVerifiedAt: new Date("2026-10-10T00:00:00.000Z"),
    reviewerNotes: "Internal note. Password awal = rahasia.",
    reviewedAt: new Date("2026-10-10T00:00:00.000Z"),
    lab: null,
    createdAt: new Date("2026-10-10T00:00:00.000Z"),
    updatedAt: new Date("2026-10-10T00:00:00.000Z"),
  }));

  try {
    const status = await AccessRequestService.getByCode("MAG-TESTCODE");
    if (!status) throw new Error("Public access-request status must exist");

    assert.equal(status.status, "APPROVED");
    for (const field of ["reviewerNotes", "userId", "emailVerifiedAt", "magangEmailVerification"]) {
      assert.equal(field in status, false);
    }
    assert.equal(JSON.stringify(status).includes("rahasia"), false);
  } finally {
    restore();
  }
});

test("MAGANG validator enforces role, password policy, and confirmation", () => {
  const invalidRole = createAccessRequestSchema.safeParse({
    ...magangRequestInput(),
    requestedRole: "MAHASISWA",
  });
  assert.equal(invalidRole.success, false);
  if (!invalidRole.success) {
    assert.ok(invalidRole.error.issues.some((issue) => issue.path.includes("requestedRole")));
  }

  const missingRole = createAccessRequestSchema.safeParse(magangRequestInput({ requestedRole: undefined }));
  assert.equal(missingRole.success, false);
  if (!missingRole.success) {
    assert.ok(missingRole.error.issues.some((issue) => issue.path.includes("requestedRole")));
  }

  const weakPassword = createAccessRequestSchema.safeParse(magangRequestInput({
    password: "passwordonly",
    confirmPassword: "passwordonly",
  }));
  assert.equal(weakPassword.success, false);
  if (!weakPassword.success) {
    assert.ok(weakPassword.error.issues.some((issue) => issue.path.includes("password")));
  }

  const mismatch = createAccessRequestSchema.safeParse(magangRequestInput({ confirmPassword: "Different#Secure2026" }));
  assert.equal(mismatch.success, false);
  if (!mismatch.success) {
    assert.ok(mismatch.error.issues.some((issue) => issue.path.includes("confirmPassword")));
  }

  assert.equal(createAccessRequestSchema.safeParse(magangRequestInput()).success, true);
});

test("MAGANG creation hashes password and persists only verification token hash", async () => {
  const input = magangRequestInput();
  let accessRequestCreate: { data: Record<string, unknown> } | undefined;
  let magangUserCreate: { data: Record<string, unknown>; select: { id: true } } | undefined;
  let linkedRequestUpdate: { where: { id: string }; data: Record<string, unknown>; include: unknown } | undefined;
  const verificationValues: unknown[] = [];
  const deliveryUrls: string[] = [];
  const tx: MagangCreationTransaction = {
    user: {
      findFirst: async () => null,
      create: async (args) => {
        magangUserCreate = args;
        return { id: "magang-user-1" };
      },
    },
    accessRequest: {
      create: async (args) => {
        accessRequestCreate = args;
        return { id: "request-1" };
      },
      update: async (args) => {
        linkedRequestUpdate = args;
        return {
          id: "request-1",
          requestCode: "MAG-TESTCODE",
          type: "MAGANG",
          status: "PENDING",
          title: input.title,
          date: null,
          startTime: null,
          endTime: null,
          requestedRole: "MAGANG",
          reviewerNotes: null,
          reviewedAt: null,
          lab: null,
          createdAt: new Date("2026-10-10T00:00:00.000Z"),
          updatedAt: new Date("2026-10-10T00:00:00.000Z"),
        };
      },
    },
    $executeRaw: async (statement) => {
      verificationValues.push(...statement.values);
      return 1;
    },
  };
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: MagangCreationTransaction) => Promise<unknown>) => operation(tx),
  );
  const restoreDelivery = replaceProperty(
    MagangVerificationEmailService,
    "sendVerification",
    async (_email: string, verificationUrl: string) => { deliveryUrls.push(verificationUrl); },
  );

  try {
    const creationStartedAt = Date.now();
    const result = await AccessRequestService.createRequest(input);
    const creationFinishedAt = Date.now();

    assert.ok(accessRequestCreate);
    assert.equal(accessRequestCreate.data.requestedRole, "MAGANG");
    assert.ok(magangUserCreate);
    assert.equal(magangUserCreate.data.role, "MAGANG");
    assert.equal(magangUserCreate.data.className, "MAGANG");
    assert.equal(magangUserCreate.data.isActive, false);
    assert.equal(magangUserCreate.data.mustChangePassword, false);
    assert.equal(typeof magangUserCreate.data.password, "string");
    const storedPassword = magangUserCreate.data.password;
    if (typeof storedPassword !== "string") throw new Error("MAGANG password must be stored as a bcrypt hash");
    assert.equal(await bcrypt.compare(input.password, storedPassword), true);
    assert.ok(storedPassword !== input.password, "MAGANG password must not be stored raw");
    assert.ok(linkedRequestUpdate);
    assert.deepEqual(linkedRequestUpdate.data, { userId: "magang-user-1" });

    assert.equal(deliveryUrls.length, 1);
    const rawToken = new URL(deliveryUrls[0]).searchParams.get("token");
    if (!rawToken) throw new Error("Verification email must include a token");
    assert.ok(/^[A-Za-z0-9_-]{43}$/.test(rawToken), "Verification token must use URL-safe 32-byte encoding");
    const expectedTokenHash = createHash("sha256").update(rawToken).digest("hex");
    assert.ok(verificationValues.includes(expectedTokenHash), "Verification token hash must be persisted");
    assert.ok(!verificationValues.includes(rawToken), "Raw verification token must not be persisted");
    assert.ok(
      verificationValues.some(
        (value) => value instanceof Date
          && value.getTime() >= creationStartedAt + 24 * 60 * 60 * 1000
          && value.getTime() <= creationFinishedAt + 24 * 60 * 60 * 1000,
      ),
      "Verification token expiry must be 24 hours after creation",
    );
    assert.ok(!JSON.stringify([accessRequestCreate.data, magangUserCreate.data, linkedRequestUpdate.data]).includes(rawToken), "Raw verification token must not enter request or user writes");
    assert.ok(result);
    assert.ok(!JSON.stringify(result).includes(rawToken), "Raw verification token must not be returned");
    assert.ok(!JSON.stringify(result).includes(input.password), "Raw password must not be returned");
  } finally {
    restoreDelivery();
    restoreTransaction();
  }
});

test("MAGANG email verification accepts a valid token once and rejects reuse", async () => {
  const rawToken = "A".repeat(43);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  let consumedAt: Date | null = null;
  let emailVerifiedAt: Date | null = null;
  let writeCount = 0;
  const lookupValues: unknown[] = [];
  const tx = {
    $queryRaw: async (statement: SqlStatement) => {
      lookupValues.push(...statement.values);
      return [verificationRow({ tokenHash, consumedAt, emailVerifiedAt })];
    },
    $executeRaw: async () => {
      writeCount += 1;
      if (writeCount === 1) {
        consumedAt = new Date();
        return 1;
      }
      emailVerifiedAt = new Date();
      return 1;
    },
  };
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    const result = await AccessRequestService.verifyMagangEmail(rawToken);

    assert.ok(result.verifiedAt instanceof Date);
    assert.equal(writeCount, 2);
    assert.ok(lookupValues.includes(tokenHash), "Verification lookup must hash supplied token");
    assert.ok(!lookupValues.includes(rawToken), "Verification lookup must not use raw token");
    await assert.rejects(
      AccessRequestService.verifyMagangEmail(rawToken),
      /Token verifikasi tidak valid atau sudah kedaluwarsa/,
    );
    assert.equal(writeCount, 2);
  } finally {
    restoreTransaction();
  }
});

test("MAGANG email verification rejects expired tokens before writes", async () => {
  let writeCount = 0;
  const tx = {
    $queryRaw: async () => [verificationRow({ expiresAt: new Date(0) })],
    $executeRaw: async () => {
      writeCount += 1;
      return 1;
    },
  };
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AccessRequestService.verifyMagangEmail("B".repeat(43)),
      /Token verifikasi tidak valid atau sudah kedaluwarsa/,
    );
    assert.equal(writeCount, 0);
  } finally {
    restoreTransaction();
  }
});

test("MAGANG approval rejects unverified requests before account activation", async () => {
  let lockedRequestQueries = 0;
  let userLookups = 0;
  let activationWrites = 0;
  let requestUpdates = 0;
  const tx: MagangReviewTransaction = {
    $queryRaw: async () => {
      lockedRequestQueries += 1;
      return [lockedMagangRequest()];
    },
    notification: {
      create: async ({ data }) => data,
    },
    user: {
      findUnique: async () => {
        userLookups += 1;
        return null;
      },
      updateMany: async () => {
        activationWrites += 1;
        return { count: 0 };
      },
    },
    accessRequest: {
      update: async () => {
        requestUpdates += 1;
        return {};
      },
    },
    magangApprovalEmailDelivery: {
      create: async () => {
        throw new Error("unverified MAGANG approval must not queue email");
      },
    },
  };
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => ({ type: "MAGANG" }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: MagangReviewTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AccessRequestService.reviewRequest("request-1", "coordinator-1", { status: "APPROVED" }),
      /Pengajuan MAGANG belum menyelesaikan verifikasi email/,
    );
    assert.equal(lockedRequestQueries, 1);
    assert.equal(userLookups, 0);
    assert.equal(activationWrites, 0);
    assert.equal(requestUpdates, 0);
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});

test("MAGANG approval activates only verified linked inactive MAGANG account", async () => {
  let lockedRequestQueries = 0;
  let activationWrite: { where: Record<string, unknown>; data: Record<string, unknown> } | undefined;
  let requestUpdate: { where: { id: string }; data: Record<string, unknown>; include: unknown } | undefined;
  const verifiedAt = new Date("2026-10-10T00:00:00.000Z");
  const tx: MagangReviewTransaction = {
    $queryRaw: async () => {
      lockedRequestQueries += 1;
      if (lockedRequestQueries === 1) {
        return [lockedMagangRequest({ emailVerifiedAt: verifiedAt })];
      }
      return [verificationRow({ consumedAt: verifiedAt, emailVerifiedAt: verifiedAt })];
    },
    notification: {
      create: async ({ data }) => data,
    },
    user: {
      findUnique: async () => ({
        id: "magang-user-1",
        email: "magang@example.test",
        role: "MAGANG",
        isActive: false,
      }),
      updateMany: async (args) => {
        activationWrite = args;
        return { count: 1 };
      },
    },
    accessRequest: {
      update: async (args) => {
        requestUpdate = args;
        return args.data;
      },
    },
    magangApprovalEmailDelivery: {
      create: async () => ({ id: "delivery-1" }),
    },
  };
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => ({ type: "MAGANG" }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: MagangReviewTransaction) => Promise<unknown>) => operation(tx),
  );
  const restoreDispatch = replaceProperty(
    MagangApprovalEmailDeliveryService,
    "dispatch",
    async () => undefined,
  );

  try {
    await AccessRequestService.reviewRequest("request-1", "coordinator-1", {
      status: "APPROVED",
      reviewerNotes: "Verified and approved.",
    });

    assert.equal(lockedRequestQueries, 2);
    assert.ok(activationWrite);
    assert.deepEqual(activationWrite, {
      where: { id: "magang-user-1", role: "MAGANG", isActive: false },
      data: { isActive: true },
    });
    assert.ok(requestUpdate);
    assert.equal(requestUpdate.data.status, "APPROVED");
    assert.equal(requestUpdate.data.reviewedById, "coordinator-1");
  } finally {
    restoreDispatch();
    restoreTransaction();
    restoreRequest();
  }
});

test("MAGANG rejection keeps linked account inactive", async () => {
  let userLookups = 0;
  let activationWrites = 0;
  let requestUpdate: { where: { id: string }; data: Record<string, unknown>; include: unknown } | undefined;
  const tx: MagangReviewTransaction = {
    $queryRaw: async () => [lockedMagangRequest()],
    notification: {
      create: async ({ data }) => data,
    },
    user: {
      findUnique: async () => {
        userLookups += 1;
        return null;
      },
      updateMany: async () => {
        activationWrites += 1;
        return { count: 0 };
      },
    },
    accessRequest: {
      update: async (args) => {
        requestUpdate = args;
        return args.data;
      },
    },
    magangApprovalEmailDelivery: {
      create: async () => {
        throw new Error("MAGANG rejection must not queue email");
      },
    },
  };
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => ({ type: "MAGANG" }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: MagangReviewTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await AccessRequestService.reviewRequest("request-1", "coordinator-1", {
      status: "REJECTED",
      reviewerNotes: "Tidak memenuhi persyaratan.",
    });

    assert.equal(userLookups, 0);
    assert.equal(activationWrites, 0);
    assert.ok(requestUpdate);
    assert.equal(requestUpdate.data.status, "REJECTED");
    assert.equal(requestUpdate.data.reviewedById, "coordinator-1");
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});

test("AKSES_SEMENTARA approval keeps legacy temporary-account behavior", async () => {
  const accessRequestFindUnique = Object.getOwnPropertyDescriptor(prisma.accessRequest, "findUnique");
  const userFindUnique = Object.getOwnPropertyDescriptor(prisma.user, "findUnique");
  const transaction = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  let createdUser: Record<string, unknown> | undefined;
  let updatedRequest: Record<string, unknown> | undefined;

  Object.defineProperty(prisma.accessRequest, "findUnique", { configurable: true, value: async () => ({
    id: "request-1",
    requestCode: "ACC-PUBLICCODE",
    status: "PENDING",
    type: "AKSES_SEMENTARA",
    applicantEmail: "temporary@example.test",
    applicantName: "Temporary Test",
    applicantPhone: null,
  }) });
  Object.defineProperty(prisma.user, "findUnique", { configurable: true, value: async () => null });
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (callback: (tx: {
      user: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }> };
      accessRequest: { update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>> };
    }) => Promise<unknown>) => callback({
      user: { create: async ({ data }) => {
        createdUser = data;
        return { id: "user-1" };
      } },
      accessRequest: { update: async ({ data }) => {
        updatedRequest = data;
        return data;
      } },
    }),
  });

  try {
    await AccessRequestService.reviewRequest("request-1", "reviewer-1", {
      status: "APPROVED",
      reviewerNotes: "Approved internally.",
    });

    assert.equal(createdUser?.role, "MAGANG");
    assert.equal(createdUser?.className, "AKSES_SEMENTARA");
    assert.equal(createdUser?.isActive, true);
    assert.equal(createdUser?.mustChangePassword, true);
    assert.equal(await bcrypt.compare("ACC-PUBLICCODE", createdUser?.password as string), false);
    assert.equal(updatedRequest?.reviewerNotes, "Approved internally.");
  } finally {
    Object.defineProperty(prisma.accessRequest, "findUnique", accessRequestFindUnique!);
    Object.defineProperty(prisma.user, "findUnique", userFindUnique!);
    Object.defineProperty(prisma, "$transaction", transaction!);
  }
});

test("external lab approval uses approved-only same-lab overlap predicates and writes booking, schedule, and request together", async () => {
  const request = pendingLabRequest();
  let bookingConflictWhere: Record<string, unknown> | undefined;
  let scheduleConflictWhere: Record<string, unknown> | undefined;
  let bookingWrite: Record<string, unknown> | undefined;
  let scheduleWrite: Record<string, unknown> | undefined;
  let requestWrite: Record<string, unknown> | undefined;
  const transactionOptions: unknown[] = [];
  const tx: ExternalApprovalTransaction = {
    accessRequest: {
      findUnique: async () => request,
      update: async ({ data }) => {
        requestWrite = data;
        return { id: "request-1", ...data };
      },
    },
    labBooking: {
      findFirst: async ({ where }) => {
        bookingConflictWhere = where;
        return null;
      },
      create: async ({ data }) => {
        bookingWrite = data;
        return { id: "booking-external-1" };
      },
    },
    schedule: {
      findFirst: async ({ where }) => {
        scheduleConflictWhere = where;
        return null;
      },
      create: async ({ data }) => {
        scheduleWrite = data;
        return { id: "schedule-external-1", ...data };
      },
    },
  };
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => request);
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ExternalApprovalTransaction) => Promise<unknown>, options: unknown) => {
      transactionOptions.push(options);
      return operation(tx);
    },
  );

  try {
    await AccessRequestService.reviewRequest("request-1", "coordinator-1", {
      status: "APPROVED",
      reviewerNotes: "Approved externally.",
    });

    assert.deepEqual(transactionOptions, [{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }]);
    assert.deepEqual(scheduleConflictWhere, {
      labId: "lab-a",
      isActive: true,
      status: { in: ["SCHEDULED", "ONGOING"] },
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      OR: [
        { specificDate: new Date("2026-10-13T00:00:00.000Z") },
        { specificDate: null, day: "SELASA" },
      ],
    });
    assert.deepEqual(bookingConflictWhere, {
      labId: "lab-a",
      date: new Date("2026-10-13T00:00:00.000Z"),
      status: "APPROVED",
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
    });
    assert.deepEqual(bookingWrite, {
      labId: "lab-a",
      requestedBy: null,
      externalRequesterName: "External Applicant",
      externalRequesterEmail: "external@example.test",
      externalRequesterPhone: "628123",
      externalInstitution: "External Campus",
      title: "External event",
      description: "External booking",
      purpose: "Pelatihan",
      date: new Date("2026-10-13T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      participants: 20,
      notes: "Approved externally.",
      status: "APPROVED",
      approvedBy: "coordinator-1",
    });
    assert.deepEqual(scheduleWrite, {
      labId: "lab-a",
      title: "External event",
      specificDate: new Date("2026-10-13T00:00:00.000Z"),
      day: "SELASA",
      startTime: "09:00",
      endTime: "10:00",
      type: "PEMINJAMAN",
      status: "SCHEDULED",
      isActive: true,
      className: "Booking:booking-external-1",
      assistantId: "coordinator-1",
    });
    assert.equal(requestWrite?.status, "APPROVED");
    assert.equal(requestWrite?.bookingId, "booking-external-1");
    assert.equal(requestWrite?.reviewedById, "coordinator-1");
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});

test("external lab approval returns conflict before any callback write for an overlapping class schedule", async () => {
  const request = pendingLabRequest();
  let bookingCreates = 0;
  let scheduleCreates = 0;
  let requestUpdates = 0;
  const tx: ExternalApprovalTransaction = {
    accessRequest: {
      findUnique: async () => request,
      update: async ({ data }) => {
        requestUpdates += 1;
        return data;
      },
    },
    labBooking: {
      findFirst: async () => null,
      create: async () => {
        bookingCreates += 1;
        return { id: "booking-external-1" };
      },
    },
    schedule: {
      findFirst: async () => ({ title: "Class", startTime: "09:30", endTime: "10:30" }),
      create: async ({ data }) => {
        scheduleCreates += 1;
        return data;
      },
    },
  };
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => request);
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ExternalApprovalTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AccessRequestService.reviewRequest("request-1", "coordinator-1", { status: "APPROVED" }),
      ApprovalConflictError,
    );
    assert.equal(bookingCreates, 0);
    assert.equal(scheduleCreates, 0);
    assert.equal(requestUpdates, 0);
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});

test("external lab approval re-reads a repeated non-PENDING request and stops before callback writes", async () => {
  const tx: ExternalApprovalTransaction = {
    accessRequest: {
      findUnique: async () => pendingLabRequest("APPROVED"),
      update: async ({ data }) => data,
    },
    labBooking: {
      findFirst: async () => null,
      create: async () => ({ id: "booking-external-1" }),
    },
    schedule: {
      findFirst: async () => null,
      create: async ({ data }) => data,
    },
  };
  let conflictChecks = 0;
  let writes = 0;
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => pendingLabRequest());
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ExternalApprovalTransaction) => Promise<unknown>) => {
      const guardedTransaction: ExternalApprovalTransaction = {
        ...tx,
        labBooking: {
          ...tx.labBooking,
          findFirst: async () => {
            conflictChecks += 1;
            return null;
          },
          create: async () => {
            writes += 1;
            return { id: "booking-external-1" };
          },
        },
        schedule: {
          ...tx.schedule,
          findFirst: async () => {
            conflictChecks += 1;
            return null;
          },
          create: async ({ data }) => {
            writes += 1;
            return data;
          },
        },
        accessRequest: {
          ...tx.accessRequest,
          update: async ({ data }) => {
            writes += 1;
            return data;
          },
        },
      };
      return operation(guardedTransaction);
    },
  );

  try {
    await assert.rejects(
      AccessRequestService.reviewRequest("request-1", "coordinator-1", { status: "APPROVED" }),
      /PENDING atau REVISION/,
    );
    assert.equal(conflictChecks, 0);
    assert.equal(writes, 0);
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});

test("access request creation preserves UTC date-only values", async () => {
  let requestWrite: Record<string, unknown> | undefined;
  const restore = replaceProperty(prisma.accessRequest, "create", async ({ data }: { data: Record<string, unknown> }) => {
    requestWrite = data;
    return data;
  });

  try {
    await AccessRequestService.createRequest({
      type: "PEMINJAMAN_LAB",
      applicantName: "External Applicant",
      applicantEmail: "external@example.test",
      title: "UTC booking",
      date: new Date("2026-10-13T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      participants: 20,
      labId: "lab-a",
    });

    assert.equal((requestWrite?.date as Date).getTime(), new Date("2026-10-13T00:00:00.000Z").getTime());
  } finally {
    restore();
  }
});

// --- QA-UX-02 validator regression guards ---

test("REVISION status rejected by update validator", () => {
  const result = updateAccessRequestStatusSchema.safeParse({ status: "REVISION" });
  assert.equal(result.success, false);
});

test("REJECTED without reviewerNotes rejected by update validator", () => {
  const result = updateAccessRequestStatusSchema.safeParse({ status: "REJECTED" });
  assert.equal(result.success, false);
  const issues = !result.success ? result.error.issues : [];
  assert.ok(issues.some((i) => i.path.includes("reviewerNotes")));
});

test("REJECTED with whitespace-only reviewerNotes rejected by update validator", () => {
  const result = updateAccessRequestStatusSchema.safeParse({ status: "REJECTED", reviewerNotes: "   " });
  assert.equal(result.success, false);
  const issues = !result.success ? result.error.issues : [];
  assert.ok(issues.some((i) => i.path.includes("reviewerNotes")));
});

test("REJECTED with valid trimmed reviewerNotes passes update validator", () => {
  const result = updateAccessRequestStatusSchema.safeParse({ status: "REJECTED", reviewerNotes: "Tidak memenuhi syarat." });
  assert.equal(result.success, true);
});

test("APPROVED without reviewerNotes passes update validator", () => {
  const result = updateAccessRequestStatusSchema.safeParse({ status: "APPROVED" });
  assert.equal(result.success, true);
});
