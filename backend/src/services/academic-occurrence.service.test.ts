import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import prisma from "../config/database";
import { AcademicConflictError, AcademicService, AcademicValidationError } from "./academic.service";
import { AcademicOccurrenceService } from "./academic-occurrence.service";
import { notificationService } from "./notification.service";

const date = new Date("2026-10-13T00:00:00.000Z");
const actor = { userId: "coordinator", role: "KOORDINATOR_LAB" };


test("released report cannot be revised into a conflicting status", async () => {
  const tx = {
    academicReport: {
      findUnique: async () => ({
        id: "report-1", revision: 1, notes: null,
        offering: { id: "offering-1", isActive: true, termId: "term-1", classId: "class-1", dosenId: "dosen-1" },
        release: { status: "RELEASED" },
      }),
    },
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
  };
  const restore = replaceTransaction(tx);
  try {
    await assert.rejects(
      AcademicService.updateReport("report-1", { expectedRevision: 1, status: "TATAP_MUKA" }, actor),
      AcademicConflictError,
    );
  } finally { restore(); }
});

function replaceTransaction(tx: object) {
  const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (operation: (client: object) => Promise<unknown>) => operation(tx),
  });
  return () => descriptor ? Object.defineProperty(prisma, "$transaction", descriptor) : Reflect.deleteProperty(prisma, "$transaction");
}

function releaseTransaction(overrides: Record<string, unknown> = {}) {
  const creates: unknown[] = [];
  const schedule = {
    id: "schedule-1", labId: "lab-1", day: "SELASA", startTime: "08:00", endTime: "10:00",
    specificDate: null, isActive: true, status: "SCHEDULED", type: "PRAKTIKUM",
  };
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicReport: { findUnique: async () => ({ id: "report-1", status: "ONLINE", reportDate: date, offering: { id: "offering-1", termId: "term-1", classId: "class-1", dosenId: "dosen-1", schedule } }) },
    logbook: { findFirst: async () => null },
    keyBorrowCycle: { findFirst: async () => null },
    key: { findFirst: async () => null },
    labBooking: { findFirst: async () => null },
    academicOccurrenceRelease: {
      findUnique: async () => null,
      create: async (input: unknown) => { creates.push(input); return { id: "release-1", ...(input as { data: object }).data }; },
    },
    auditLog: { create: async () => ({}) },
    ...overrides,
  };
  return { tx, creates };
}

test("ONLINE report releases only the matching dated official occurrence", async () => {
  const fixture = releaseTransaction();
  const restore = replaceTransaction(fixture.tx);
  try {
    const release = await AcademicOccurrenceService.release("report-1", actor);
    assert.equal(release.id, "release-1");
    assert.deepEqual(fixture.creates, [{
      data: {
        offeringId: "offering-1", scheduleId: "schedule-1", reportId: "report-1", labId: "lab-1",
        occurrenceDate: date, startTime: "08:00", endTime: "10:00", releasedById: actor.userId,
      },
    }]);
  } finally {
    restore();
  }
});

test("active key custody blocks release before any release write", async () => {
  const fixture = releaseTransaction({ key: { findFirst: async () => ({ id: "key-1" }) } });
  const restore = replaceTransaction(fixture.tx);
  try {
    await assert.rejects(AcademicOccurrenceService.release("report-1", actor), AcademicConflictError);
    assert.equal(fixture.creates.length, 0);
  } finally {
    restore();
  }
});

test("release cannot be reused by a different report for the same dated schedule", async () => {
  const fixture = releaseTransaction({ academicOccurrenceRelease: { findUnique: async () => ({ id: "release-1", reportId: "other-report" }), create: async () => { throw new Error("unexpected write"); } } });
  const restore = replaceTransaction(fixture.tx);
  try {
    await assert.rejects(AcademicOccurrenceService.release("report-1", actor), AcademicConflictError);
  } finally {
    restore();
  }
});

function allocationTransaction(overrides: Record<string, unknown> = {}) {
  const scheduleCreates: unknown[] = [];
  const requestUpdates: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicSlotRequest: {
      findUnique: async () => ({
        id: "request-1",
        status: "PENDING",
        releaseId: "release-1",
        requestedById: "student-1",
        targetOfferingId: "offering-target",
        reason: "Kelas pengganti",
        release: {
          report: { status: "ONLINE" },
          schedule: {
            id: "schedule-source", labId: "lab-1", day: "SELASA", startTime: "08:00", endTime: "10:00",
            specificDate: null, isActive: true, status: "SCHEDULED", type: "PRAKTIKUM",
          },
        },
        targetOffering: { id: "offering-target", course: { code: "IF101" }, academicClass: { code: "TI-1B" } },
      }),
      update: async (input: unknown) => {
        requestUpdates.push(input);
        return { id: "request-1", requestedById: "student-1", ...(input as { data: object }).data };
      },
    },
    academicOccurrenceRelease: {
      findUnique: async () => ({
        id: "release-1", status: "RELEASED", scheduleId: "schedule-source", labId: "lab-1",
        occurrenceDate: date, startTime: "08:00", endTime: "10:00",
      }),
      update: async () => ({}),
    },
    logbook: { findFirst: async () => null },
    keyBorrowCycle: { findFirst: async () => null },
    key: { findFirst: async () => null },
    schedule: {
      findFirst: async () => null,
      create: async (input: unknown) => {
        scheduleCreates.push(input);
        return { id: "schedule-allocation", ...(input as { data: object }).data };
      },
    },
    labBooking: {
      findFirst: async () => null,
      create: async () => ({ id: "booking-1", title: "Akademik: IF101 TI-1B" }),
    },
    auditLog: { create: async () => ({}) },
    ...overrides,
  };
  return { tx, scheduleCreates, requestUpdates };
}

test("allocation approval stores the allocated schedule identity atomically", async () => {
  const fixture = allocationTransaction();
  const restore = replaceTransaction(fixture.tx);
  const notificationDescriptor = Object.getOwnPropertyDescriptor(notificationService, "create");
  Object.defineProperty(notificationService, "create", { configurable: true, value: async () => ({ id: "notification-1" }) });
  try {
    await AcademicOccurrenceService.reviewRequest("request-1", { approved: true }, actor);
    assert.equal(fixture.scheduleCreates.length, 1);
    assert.deepEqual(fixture.requestUpdates, [{
      where: { id: "request-1" },
      data: {
        status: "APPROVED",
        reviewedById: actor.userId,
        reviewedAt: fixture.requestUpdates.length === 0 ? undefined : (fixture.requestUpdates[0] as any).data.reviewedAt,
        rejectionReason: null,
        bookingId: "booking-1",
        allocatedScheduleId: "schedule-allocation",
      },
    }]);
  } finally {
    restore();
    if (notificationDescriptor) Object.defineProperty(notificationService, "create", notificationDescriptor);
    else Reflect.deleteProperty(notificationService, "create");
  }
});

test("allocation conflict or duplicate review creates no second schedule", async () => {
  for (const fixture of [
    allocationTransaction({ schedule: { findFirst: async () => ({ title: "Bentrok", startTime: "08:00", endTime: "10:00" }), create: async () => { throw new Error("unexpected write"); } } }),
    allocationTransaction({ academicSlotRequest: { findUnique: async () => ({ id: "request-1", status: "APPROVED" }), update: async () => { throw new Error("unexpected write"); } } }),
  ]) {
    const restore = replaceTransaction(fixture.tx);
    try {
      await assert.rejects(AcademicOccurrenceService.reviewRequest("request-1", { approved: true }, actor), AcademicConflictError);
      assert.equal(fixture.scheduleCreates.length, 0);
    } finally {
      restore();
    }
  }
});

test("allocation occurrence migration is additive and uniquely links one schedule", () => {
  const sql = readFileSync(path.join(__dirname, "../../prisma/migrations/20261029000000_link_allocated_academic_occurrence/migration.sql"), "utf8");
  assert.match(sql, /ADD COLUMN "allocatedScheduleId" TEXT/);
  assert.match(sql, /CREATE UNIQUE INDEX "academic_slot_requests_allocatedScheduleId_key"/);
  assert.match(sql, /REFERENCES "schedules"\("id"\)/);
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE|DROP)\b/im);
});

test("active slot request migration enforces one pending or approved request per release", () => {
  const sql = readFileSync(path.join(__dirname, "../../prisma/migrations/20261102000000_unique_active_academic_slot_request/migration.sql"), "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX "academic_slot_requests_one_active_per_release_key"/);
  assert.match(sql, /ON "academic_slot_requests"\("releaseId"\)/);
  assert.match(sql, /WHERE "status" IN \('PENDING', 'APPROVED'\)/);
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE|DROP)\b/im);
});

test("released occurrence can be revoked only when no request or active use exists", async () => {
  const updates: unknown[] = [];
  const audits: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicOccurrenceRelease: {
      findUnique: async () => ({
        id: "release-1", status: "RELEASED", scheduleId: "schedule-1", labId: "lab-1",
        occurrenceDate: date, offeringId: "offering-1", requests: [],
        offering: { id: "offering-1", termId: "term-1", classId: "class-1", dosenId: "dosen-1" },
      }),
      update: async (input: unknown) => { updates.push(input); return { id: "release-1", offeringId: "offering-1", status: "REVOKED", occurrenceDate: date }; },
    },
    logbook: { findFirst: async () => null },
    keyBorrowCycle: { findFirst: async () => null },
    key: { findFirst: async () => null },
    auditLog: { create: async (input: unknown) => { audits.push(input); return {}; } },
  };
  const restore = replaceTransaction(tx);
  try {
    const result = await AcademicOccurrenceService.revokeRelease("release-1", { reason: "Kelas kembali tatap muka" }, actor);
    assert.equal(result.status, "REVOKED");
    assert.equal(updates.length, 1);
    assert.equal(audits.length, 1);
    assert.equal((audits[0] as { data: { action: string } }).data.action, "ACADEMIC_OCCURRENCE_RELEASE_REVOKED");
  } finally { restore(); }
});

test("completed occurrence history blocks release revocation", async () => {
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicOccurrenceRelease: {
      findUnique: async () => ({
        id: "release-1", status: "RELEASED", scheduleId: "schedule-1", labId: "lab-1",
        occurrenceDate: date, offeringId: "offering-1", requests: [],
        offering: { id: "offering-1", termId: "term-1", classId: "class-1", dosenId: "dosen-1" },
      }),
      update: async () => { writes += 1; return {}; },
    },
    logbook: { findFirst: async ({ where }: { where: { status?: unknown } }) => where.status ? null : { id: "completed-logbook" } },
    keyBorrowCycle: { findFirst: async () => null },
    key: { findFirst: async () => null },
    auditLog: { create: async () => { writes += 1; return {}; } },
  };
  const restore = replaceTransaction(tx);
  try {
    await assert.rejects(
      AcademicOccurrenceService.revokeRelease("release-1", { reason: "Kembali tatap muka" }, actor),
      /riwayat logbook atau peminjaman kunci/i,
    );
    assert.equal(writes, 0);
  } finally { restore(); }
});

test("revoked release is terminal and cannot be silently reactivated", async () => {
  const fixture = releaseTransaction({
    academicOccurrenceRelease: {
      findUnique: async () => ({ id: "release-1", reportId: "report-1", status: "REVOKED" }),
      create: async () => { throw new Error("unexpected write"); },
    },
  });
  const restore = replaceTransaction(fixture.tx);
  try {
    await assert.rejects(
      AcademicOccurrenceService.release("report-1", actor),
      /bersifat final/i,
    );
  } finally { restore(); }
});

test("pending slot request cancellation is atomic and requester-scoped", async () => {
  const updates: unknown[] = [];
  const audits: unknown[] = [];
  const requester = { userId: "student-1", role: "MAHASISWA" };
  const tx = {
    user: { findUnique: async () => ({ id: requester.userId, role: requester.role, isActive: true }) },
    academicSlotRequest: {
      findUnique: async () => ({
        id: "request-1", status: "PENDING", requestedById: requester.userId, reviewedById: null,
        targetOfferingId: "offering-target", release: { labId: "lab-1", occurrenceDate: date },
        targetOffering: {}, booking: null, allocatedSchedule: null,
      }),
      update: async (input: unknown) => { updates.push(input); return { id: "request-1", status: "CANCELLED" }; },
    },
    auditLog: { create: async (input: unknown) => { audits.push(input); return {}; } },
  };
  const restore = replaceTransaction(tx);
  try {
    const result = await AcademicOccurrenceService.cancelRequest("request-1", { reason: "Kebutuhan dibatalkan" }, requester);
    assert.equal(result.status, "CANCELLED");
    assert.equal(updates.length, 1);
    assert.equal((audits[0] as { data: { action: string } }).data.action, "ACADEMIC_SLOT_REQUEST_CANCELLED");
  } finally { restore(); }
});

test("approved allocation cancellation fails closed for non-coordinator", async () => {
  const requester = { userId: "student-1", role: "MAHASISWA" };
  const tx = {
    user: { findUnique: async () => ({ id: requester.userId, role: requester.role, isActive: true }) },
    academicSlotRequest: {
      findUnique: async () => ({
        id: "request-1", status: "APPROVED", requestedById: requester.userId,
        bookingId: "booking-1", allocatedScheduleId: "schedule-allocation", release: {},
        targetOffering: {}, booking: {}, allocatedSchedule: {},
      }),
    },
  };
  const restore = replaceTransaction(tx);
  try {
    await assert.rejects(
      AcademicOccurrenceService.cancelRequest("request-1", { reason: "Batalkan alokasi" }, requester),
      /hanya dapat dibatalkan Koordinator Lab/i,
    );
  } finally { restore(); }
});

test("completed allocation evidence blocks coordinator cancellation without partial writes", async () => {
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicSlotRequest: {
      findUnique: async () => ({
        id: "request-1", status: "APPROVED", requestedById: "student-1", reviewedById: actor.userId,
        bookingId: "booking-1", allocatedScheduleId: "schedule-allocation", releaseId: "release-1",
        release: { labId: "lab-1", occurrenceDate: date }, targetOfferingId: "offering-target",
        targetOffering: {}, booking: {}, allocatedSchedule: {},
      }),
      update: async () => { writes += 1; return {}; },
    },
    logbook: { findFirst: async ({ where }: { where: { status?: unknown } }) => where.status ? null : { id: "completed-logbook" } },
    keyBorrowCycle: { findFirst: async () => null },
    key: { findFirst: async () => null },
    labBooking: { update: async () => { writes += 1; return {}; } },
    schedule: { update: async () => { writes += 1; return {}; } },
    academicOccurrenceRelease: { update: async () => { writes += 1; return {}; } },
    auditLog: { create: async () => { writes += 1; return {}; } },
  };
  const restore = replaceTransaction(tx);
  try {
    await assert.rejects(
      AcademicOccurrenceService.cancelRequest("request-1", { reason: "Batalkan alokasi" }, actor),
      /riwayat logbook atau peminjaman kunci/i,
    );
    assert.equal(writes, 0);
  } finally { restore(); }
});

test("slot request rejection requires rejectionReason of at least 3 characters", async () => {
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicSlotRequest: {
      findUnique: async () => ({
        id: "request-1", status: "PENDING", requestedById: "student-1",
        release: { labId: "lab-1", occurrenceDate: date },
      }),
    },
  };
  const restore = replaceTransaction(tx);
  try {
    await assert.rejects(
      AcademicOccurrenceService.reviewRequest("request-1", { approved: false, rejectionReason: "  " }, actor),
      AcademicValidationError,
    );
    await assert.rejects(
      AcademicOccurrenceService.reviewRequest("request-1", { approved: false, rejectionReason: "no" }, actor),
      AcademicValidationError,
    );
  } finally {
    restore();
  }
});

test("coordinator slot rejection persists rejectionReason and logs audit", async () => {
  let updatedRequest: unknown = null;
  let auditCreated: unknown = null;
  const tx = {
    user: { findUnique: async () => ({ id: actor.userId, role: actor.role, isActive: true }) },
    academicSlotRequest: {
      findUnique: async () => ({
        id: "request-1", status: "PENDING", requestedById: "student-1",
        release: { labId: "lab-1", occurrenceDate: date },
      }),
      update: async (input: unknown) => {
        updatedRequest = input;
        return { id: "request-1", status: "REJECTED", rejectionReason: "Jadwal lab bentrok dengan pemeliharaan", requestedById: "student-1" };
      },
    },
    auditLog: {
      create: async (input: unknown) => {
        auditCreated = input;
        return {};
      },
    },
  };
  const restore = replaceTransaction(tx);
  try {
    const result = await AcademicOccurrenceService.reviewRequest(
      "request-1",
      { approved: false, rejectionReason: "Jadwal lab bentrok dengan pemeliharaan" },
      actor,
    );
    assert.equal(result.status, "REJECTED");
    assert.equal((result as { rejectionReason?: string }).rejectionReason, "Jadwal lab bentrok dengan pemeliharaan");
    assert.equal((auditCreated as { data: { action: string; description: string } }).data.action, "ACADEMIC_SLOT_REJECTED");
    assert.equal((auditCreated as { data: { action: string; description: string } }).data.description, "Jadwal lab bentrok dengan pemeliharaan");
  } finally {
    restore();
  }
});
