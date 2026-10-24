import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { AcademicConflictError, AcademicService } from "./academic.service";
import { AcademicOccurrenceService } from "./academic-occurrence.service";

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
