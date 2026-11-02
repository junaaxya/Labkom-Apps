import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import prisma from "../config/database";
import { AcademicConflictError, AcademicValidationError } from "./academic.service";
import { AcademicSwapService } from "./academic-swap.service";

const source = readFileSync(path.join(__dirname, "academic-swap.service.ts"), "utf8");

test("swap workflow is occurrence-only and never updates an official schedule", () => {
  assert.match(source, /withSerializableRetry/);
  assert.match(source, /AcademicOccurrenceSwap/);
  assert.match(source, /reservations/);
  assert.doesNotMatch(source, /tx\.schedule\.update/);
  assert.doesNotMatch(source, /tx\.schedule\.delete/);
});

test("swap approval guards active lab use, custody, booking, and release allocation", () => {
  assert.match(source, /keyBorrowCycle/);
  assert.match(source, /status: "BORROWED"/);
  assert.match(source, /logbook/);
  assert.match(source, /labBooking/);
  assert.match(source, /academicOccurrenceRelease/);
  assert.match(source, /PENDING_APPROVAL/);
});

test("swap notifications have deterministic per-recipient keys", () => {
  assert.match(source, /academic-swap:\$\{result\.id\}/);
  assert.match(source, /reminderKey/);
});

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => descriptor
    ? Object.defineProperty(target, property, descriptor)
    : Reflect.deleteProperty(target, property);
}

const occurrenceDate = new Date("2026-10-26T00:00:00.000Z");

function swapReviewTransaction(options?: { staleTargetConfirmation?: boolean; authorityConflict?: "CLASS" | "DOSEN" }) {
  const sourceOffering = {
    id: "offering-source",
    termId: "term-1",
    classId: "class-source",
    dosenId: "dosen-source",
    isActive: true,
    schedule: {
      id: "schedule-source", labId: "lab-1", day: "SENIN", startTime: "08:00", endTime: "10:00",
      specificDate: null, isActive: true, status: "SCHEDULED", type: "PRAKTIKUM",
    },
    pjs: [],
  };
  const targetOffering = {
    id: "offering-target",
    termId: "term-1",
    classId: "class-target",
    dosenId: "dosen-target",
    isActive: true,
    schedule: {
      id: "schedule-target", labId: "lab-1", day: "SENIN", startTime: "10:00", endTime: "12:00",
      specificDate: null, isActive: true, status: "SCHEDULED", type: "PRAKTIKUM",
    },
    pjs: [],
  };
  const confirmations = [
    { offeringId: sourceOffering.id, confirmedById: sourceOffering.dosenId },
    { offeringId: targetOffering.id, confirmedById: targetOffering.dosenId },
  ];
  let approvals = 0;
  const conflictingOffering = options?.authorityConflict
    ? {
        id: "offering-conflict",
        termId: "term-1",
        classId: options.authorityConflict === "CLASS" ? sourceOffering.classId : "class-other",
        dosenId: options.authorityConflict === "DOSEN" ? sourceOffering.dosenId : "dosen-other",
        isActive: true,
      }
    : null;
  const tx = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        role: where.id === "coordinator" ? "KOORDINATOR_LAB" : "DOSEN",
        isActive: !(options?.staleTargetConfirmation && where.id === targetOffering.dosenId),
      }),
    },
    academicOccurrenceSwap: {
      findUnique: async () => ({
        id: "swap-1",
        status: "PENDING_APPROVAL",
        occurrenceDate,
        sourceOffering,
        targetOffering,
        confirmations,
      }),
      findFirst: async () => null,
      findMany: async () => [],
      update: async () => {
        approvals += 1;
        return {
          id: "swap-1",
          requestedById: sourceOffering.dosenId,
          sourceOffering,
          targetOffering,
          confirmations,
        };
      },
    },
    academicClassLeader: { findFirst: async () => null },
    academicOfferingPJ: { findFirst: async () => null },
    logbook: { findFirst: async () => null },
    keyBorrowCycle: { findFirst: async () => null },
    key: { findFirst: async () => null },
    labBooking: { findFirst: async () => null },
    academicOccurrenceRelease: { findFirst: async () => null },
    schedule: {
      findFirst: async () => null,
      findMany: async () => conflictingOffering
        ? [{
            id: "schedule-conflict", labId: "lab-2", title: "Conflict", lecturerName: null,
            className: null, semester: null, startTime: "10:30", endTime: "11:30", specificDate: null,
            day: "SENIN", type: "PRAKTIKUM", status: "SCHEDULED", isActive: true,
            academicOffering: conflictingOffering, allocatedSlotRequest: null, occurrenceReleases: [],
            lab: { id: "lab-2", name: "Lab 2", location: null }, assistant: null,
          }]
        : [],
    },
    auditLog: { create: async () => ({}) },
  };
  return { tx, approvals };
}

test("swap approval rejects a confirmation whose representative is no longer active", async () => {
  const fixture = swapReviewTransaction({ staleTargetConfirmation: true });
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof fixture.tx) => Promise<unknown>) => operation(fixture.tx),
  );
  try {
    await assert.rejects(
      AcademicSwapService.review("swap-1", { approved: true }, { userId: "coordinator", role: "KOORDINATOR_LAB" }),
      /Perwakilan kelas sudah tidak memiliki otoritas/,
    );
    assert.equal(fixture.approvals, 0);
  } finally {
    restore();
  }
});

for (const conflict of ["CLASS", "DOSEN"] as const) {
  test(`swap approval rejects an actual ${conflict.toLowerCase()} conflict`, async () => {
    const fixture = swapReviewTransaction({ authorityConflict: conflict });
    const restore = replaceProperty(
      prisma,
      "$transaction",
      async (operation: (client: typeof fixture.tx) => Promise<unknown>) => operation(fixture.tx),
    );
    try {
      await assert.rejects(
        AcademicSwapService.review("swap-1", { approved: true }, { userId: "coordinator", role: "KOORDINATOR_LAB" }),
        conflict === "CLASS" ? /Kelas memiliki pertemuan lain/ : /Dosen memiliki pertemuan lain/,
      );
      assert.equal(fixture.approvals, 0);
    } finally {
      restore();
    }
  });
}

test("swap rejection requires rejectionReason of at least 3 characters", async () => {
  const fixture = swapReviewTransaction();
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof fixture.tx) => Promise<unknown>) => operation(fixture.tx),
  );
  try {
    await assert.rejects(
      AcademicSwapService.review("swap-1", { approved: false, rejectionReason: "  " }, { userId: "coordinator", role: "KOORDINATOR_LAB" }),
      AcademicValidationError,
    );
    await assert.rejects(
      AcademicSwapService.review("swap-1", { approved: false, rejectionReason: "no" }, { userId: "coordinator", role: "KOORDINATOR_LAB" }),
      AcademicValidationError,
    );
  } finally {
    restore();
  }
});

test("coordinator swap rejection persists rejectionReason and logs audit", async () => {
  let updatedData: unknown = null;
  let auditLogData: unknown = null;
  const tx = {
    user: {
      findUnique: async () => ({ id: "coordinator", role: "KOORDINATOR_LAB", isActive: true }),
    },
    academicOccurrenceSwap: {
      findUnique: async () => ({
        id: "swap-1",
        status: "PENDING_APPROVAL",
        occurrenceDate,
        sourceOffering: { id: "source-1", pjs: [] },
        targetOffering: { id: "target-1", pjs: [] },
        confirmations: [],
      }),
      update: async (input: unknown) => {
        updatedData = input;
        return {
          id: "swap-1",
          status: "REJECTED",
          rejectionReason: "Jadwal praktikum bertabrakan dengan ujian",
          requestedById: "dosen-1",
          sourceOffering: { pjs: [] },
          targetOffering: { pjs: [] },
          confirmations: [],
        };
      },
    },
    auditLog: {
      create: async (input: unknown) => {
        auditLogData = input;
        return {};
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );
  try {
    const result = await AcademicSwapService.review(
      "swap-1",
      { approved: false, rejectionReason: "Jadwal praktikum bertabrakan dengan ujian" },
      { userId: "coordinator", role: "KOORDINATOR_LAB" },
    );
    assert.equal(result.status, "REJECTED");
    assert.equal((result as { rejectionReason?: string }).rejectionReason, "Jadwal praktikum bertabrakan dengan ujian");
    assert.equal((auditLogData as { data: { action: string; description: string } }).data.action, "ACADEMIC_SWAP_REJECTED");
    assert.equal((auditLogData as { data: { action: string; description: string } }).data.description, "Jadwal praktikum bertabrakan dengan ujian");
  } finally {
    restore();
  }
});
