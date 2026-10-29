import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import prisma from "../config/database";
import { AcademicConflictError, AcademicService } from "./academic.service";
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
