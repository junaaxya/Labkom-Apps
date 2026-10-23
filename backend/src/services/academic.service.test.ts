import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import prisma from "../config/database";
import { AcademicConflictError, AcademicService } from "./academic.service";

type Restore = () => void;

const ids = {
  offering: "cmoseuhxj0001ofz5r10a18l1",
  report: "cmoseuhxj0002ofz5r10a18l2",
  dosen: "cmoseuhxj0003ofz5r10a18l3",
  otherDosen: "cmoseuhxj0004ofz5r10a18l4",
  student: "cmoseuhxj0005ofz5r10a18l5",
  term: "cmoseuhxj0006ofz5r10a18l6",
  academicClass: "cmoseuhxj0007ofz5r10a18l7",
};

function replaceProperty(target: object, property: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

test("academic service never reads legacy isKetuaKelas authority", () => {
  const source = readFileSync(path.join(__dirname, "academic.service.ts"), "utf8");
  assert.doesNotMatch(source, /isKetuaKelas/);
});

test("DOSEN offering reads always scope to authenticated dosen", async () => {
  let capturedWhere: unknown;
  const restore = replaceProperty(prisma.academicOffering, "findMany", async ({ where }: { where: unknown }) => {
    capturedWhere = where;
    return [];
  });

  try {
    await AcademicService.listOfferings(
      { dosenId: ids.otherDosen },
      { userId: ids.dosen, role: "DOSEN" },
    );
    assert.deepEqual(capturedWhere, { dosenId: ids.dosen });
  } finally {
    restore();
  }
});

test("legacy chair flag cannot create academic report without active leader or PJ assignment", async () => {
  let reportWrites = 0;
  const tx = {
    academicOffering: {
      findUnique: async () => ({
        id: ids.offering,
        isActive: true,
        termId: ids.term,
        classId: ids.academicClass,
      }),
    },
    academicClassLeader: { findFirst: async () => null },
    academicOfferingPJ: { findFirst: async () => null },
    academicReport: {
      create: async () => {
        reportWrites += 1;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AcademicService.createReport(
        { offeringId: ids.offering, reportDate: new Date("2026-10-22T00:00:00.000Z"), status: "TATAP_MUKA" },
        { userId: ids.student, role: "MAHASISWA" },
      ),
      /Ketua kelas atau PJ aktif/,
    );
    assert.equal(reportWrites, 0);
  } finally {
    restore();
  }
});

test("report update uses expected revision then appends revision and audit log", async () => {
  const reportUpdates: unknown[] = [];
  const revisions: unknown[] = [];
  const audits: unknown[] = [];
  const current = {
    id: ids.report,
    revision: 2,
    notes: "Tatap muka",
    offering: { id: ids.offering, isActive: true, termId: ids.term, classId: ids.academicClass },
  };
  const tx = {
    academicReport: {
      findUnique: async () => current,
      updateMany: async (input: unknown) => {
        reportUpdates.push(input);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ id: ids.report, revision: 3 }),
    },
    academicReportRevision: {
      create: async (input: unknown) => {
        revisions.push(input);
      },
    },
    auditLog: {
      create: async (input: unknown) => {
        audits.push(input);
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    const result = await AcademicService.updateReport(
      ids.report,
      { expectedRevision: 2, status: "ONLINE", notes: "Kuliah daring" },
      { userId: "coordinator-1", role: "KOORDINATOR_LAB", ipAddress: "127.0.0.1" },
    );
    assert.deepEqual(result, { id: ids.report, revision: 3 });
    assert.deepEqual(reportUpdates, [{
      where: { id: ids.report, revision: 2 },
      data: {
        status: "ONLINE",
        notes: "Kuliah daring",
        revision: { increment: 1 },
        updatedById: "coordinator-1",
      },
    }]);
    assert.deepEqual(revisions, [{
      data: {
        reportId: ids.report,
        revision: 3,
        status: "ONLINE",
        notes: "Kuliah daring",
        changedById: "coordinator-1",
      },
    }]);
    assert.deepEqual(audits, [{
      data: {
        userId: "coordinator-1",
        action: "ACADEMIC_REPORT_UPDATED",
        targetType: "AcademicReport",
        targetId: ids.report,
        description: "Revisi 3",
        ipAddress: "127.0.0.1",
      },
    }]);
  } finally {
    restore();
  }
});

test("stale expected revision cannot append revision or audit log", async () => {
  let revisionWrites = 0;
  let auditWrites = 0;
  const tx = {
    academicReport: {
      findUnique: async () => ({
        id: ids.report,
        revision: 3,
        notes: "Sudah diubah",
        offering: { id: ids.offering, isActive: true, termId: ids.term, classId: ids.academicClass },
      }),
      updateMany: async () => ({ count: 0 }),
    },
    academicReportRevision: {
      create: async () => {
        revisionWrites += 1;
      },
    },
    auditLog: {
      create: async () => {
        auditWrites += 1;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AcademicService.updateReport(
        ids.report,
        { expectedRevision: 2, status: "ONLINE" },
        { userId: "coordinator-1", role: "KOORDINATOR_LAB" },
      ),
      AcademicConflictError,
    );
    assert.equal(revisionWrites, 0);
    assert.equal(auditWrites, 0);
  } finally {
    restore();
  }
});
