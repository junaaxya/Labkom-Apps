import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import prisma from "../config/database";
import { AcademicBindingService } from "./academic-binding.service";
import { AcademicAuthorizationError, AcademicConflictError } from "./academic.service";

const coordinator = { userId: "coordinator", role: "KOORDINATOR_LAB", ipAddress: "127.0.0.1" };
const schedule = { id: "schedule-1", type: "PRAKTIKUM", status: "SCHEDULED", isActive: true };

test("binding migration preserves unbound offerings and enforces one schedule per offering", () => {
  const sql = readFileSync(path.join(__dirname, "../../prisma/migrations/20261023000000_bind_academic_offering_schedule/migration.sql"), "utf8");
  assert.match(sql, /ADD COLUMN "scheduleId" TEXT;/);
  assert.match(sql, /CREATE UNIQUE INDEX .* ON "academic_offerings"\("scheduleId"\)/);
  assert.match(sql, /FOREIGN KEY \("scheduleId"\) REFERENCES "schedules"\("id"\) ON DELETE RESTRICT/);
  assert.doesNotMatch(sql, /\bUPDATE\b.*\bSET\b/i);
});

function mockTransaction(options: { readonly existingScheduleId?: string; readonly claimed?: boolean; readonly schedule?: typeof schedule } = {}) {
  let offering = { id: "offering-1", isActive: true, scheduleId: options.existingScheduleId ?? null };
  const audits: unknown[] = [];
  const tx = {
    academicOffering: {
      findUnique: async ({ where }: { where: { id?: string; scheduleId?: string } }) =>
        where.id ? offering : options.claimed ? { id: "another-offering" } : null,
      update: async ({ data }: { data: { scheduleId: string } }) => {
        offering = { ...offering, scheduleId: data.scheduleId };
        return offering;
      },
    },
    schedule: { findUnique: async () => options.schedule ?? schedule },
    auditLog: { create: async ({ data }: { data: unknown }) => { audits.push(data); } },
  };
  const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  const transactions: unknown[] = [];
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (operation: (client: typeof tx) => Promise<unknown>, transactionOptions: unknown) => {
      transactions.push(transactionOptions);
      return operation(tx);
    },
  });
  return {
    audits,
    transactions,
    restore: () => descriptor ? Object.defineProperty(prisma, "$transaction", descriptor) : Reflect.deleteProperty(prisma, "$transaction"),
  };
}

test("coordinator binds official schedule and writes one audit in Serializable transaction", async () => {
  const fake = mockTransaction();
  try {
    const result = await AcademicBindingService.bindSchedule("offering-1", "schedule-1", coordinator);
    assert.equal(result.scheduleId, "schedule-1");
    assert.deepEqual(fake.transactions, [{ isolationLevel: "Serializable" }]);
    assert.deepEqual(fake.audits, [{ userId: "coordinator", action: "ACADEMIC_SCHEDULE_BOUND", targetType: "AcademicOffering", targetId: "offering-1", description: "Jadwal schedule-1", ipAddress: "127.0.0.1" }]);
    await AcademicBindingService.bindSchedule("offering-1", "schedule-1", coordinator);
    assert.equal(fake.audits.length, 1);
  } finally {
    fake.restore();
  }
});

test("binding rejects unapproved roles before starting transaction", async () => {
  const fake = mockTransaction();
  try {
    for (const role of ["DOSEN", "MAHASISWA", "ASISTEN_LAB", "MAGANG"]) {
      await assert.rejects(AcademicBindingService.bindSchedule("offering-1", "schedule-1", { userId: "user", role }), AcademicAuthorizationError);
    }
    assert.equal(fake.transactions.length, 0);
  } finally {
    fake.restore();
  }
});

test("binding rejects already allocated schedules and existing different bindings", async () => {
  for (const options of [{ claimed: true }, { existingScheduleId: "another-schedule" }]) {
    const fake = mockTransaction(options);
    try {
      await assert.rejects(AcademicBindingService.bindSchedule("offering-1", "schedule-1", coordinator), AcademicConflictError);
      assert.equal(fake.audits.length, 0);
    } finally {
      fake.restore();
    }
  }
});

test("binding rejects booking schedules and inactive official schedules", async () => {
  for (const invalid of [{ ...schedule, type: "PEMINJAMAN" }, { ...schedule, isActive: false }]) {
    const fake = mockTransaction({ schedule: invalid });
    try {
      await assert.rejects(AcademicBindingService.bindSchedule("offering-1", "schedule-1", coordinator), AcademicConflictError);
      assert.equal(fake.audits.length, 0);
    } finally {
      fake.restore();
    }
  }
});
