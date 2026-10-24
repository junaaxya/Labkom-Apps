import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { checkinLogbook } from "./logbook-checkin";

const now = new Date("2026-10-12T17:01:00.000Z");
const date = new Date("2026-10-13T00:00:00.000Z");
const input = { labId: "lab-1", scheduleId: "schedule-1", occurrenceDate: "2026-10-13" };
const schedule = {
  id: "schedule-1", labId: "lab-1", type: "PRAKTIKUM", status: "SCHEDULED", isActive: true,
  specificDate: null as Date | null, day: "SELASA", academicOffering: { id: "offering-1", isActive: true } as { id: string; isActive: boolean } | null,
};

function fakeTransaction(options: { schedule?: typeof schedule | null; existing?: boolean; retry?: boolean } = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  const writes: Record<string, unknown>[] = [];
  const lookups: unknown[] = [];
  const transactions: unknown[] = [];
  const tx = {
    logbook: {
      findFirst: async (query: unknown) => { lookups.push(query); return options.existing ? { id: "old-logbook" } : null; },
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return { id: "logbook-1", ...data }; },
    },
    schedule: { findUnique: async ({ where }: { where: { id: string } }) => {
      const found = options.schedule === undefined ? schedule : options.schedule;
      return found?.id === where.id ? found : null;
    } },
  };
  let attempts = 0;
  Object.defineProperty(prisma, "$transaction", {
    configurable: true,
    value: async (operation: (client: typeof tx) => Promise<unknown>, transactionOptions: unknown) => {
      attempts += 1;
      transactions.push(transactionOptions);
      if (options.retry && attempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
      }
      return operation(tx);
    },
  });
  return {
    writes, lookups, transactions,
    restore: () => descriptor ? Object.defineProperty(prisma, "$transaction", descriptor) : Reflect.deleteProperty(prisma, "$transaction"),
  };
}

test("check-in records bound identity in a serializable Jakarta-day transaction", async () => {
  const fake = fakeTransaction({ retry: true });
  try {
    const result = await checkinLogbook("assistant-1", input, now);
    assert.equal(result.scheduleId, "schedule-1");
    assert.equal(result.academicOfferingId, "offering-1");
    assert.deepEqual(fake.writes, [{
      date, labId: "lab-1", scheduleId: "schedule-1", academicOfferingId: "offering-1", occurrenceDate: date,
      officialCheckinById: "assistant-1", officialCheckinAt: now, status: "CHECKED_IN",
    }]);
    assert.deepEqual(fake.transactions, [{ isolationLevel: "Serializable" }, { isolationLevel: "Serializable" }]);
    assert.deepEqual(fake.lookups, [{ where: { officialCheckinById: "assistant-1", date } }]);
  } finally { fake.restore(); }
});

test("check-in accepts exact-date schedule even when its stored weekday differs", async () => {
  const fake = fakeTransaction({ schedule: { ...schedule, specificDate: date, day: "SENIN" } });
  try {
    assert.equal((await checkinLogbook("assistant-1", input, now)).scheduleId, "schedule-1");
  } finally { fake.restore(); }
});

test("check-in rejects wrong lab, date, schedule status, type, or missing binding before write", async () => {
  const invalidSchedules = [
    null,
    { ...schedule, labId: "lab-2" },
    { ...schedule, day: "SENIN" },
    { ...schedule, specificDate: new Date("2026-10-20T00:00:00.000Z") },
    { ...schedule, isActive: false },
    { ...schedule, status: "CANCELLED" },
    { ...schedule, type: "PEMINJAMAN" },
    { ...schedule, academicOffering: null },
    { ...schedule, academicOffering: { id: "offering-1", isActive: false } },
  ];
  for (const invalidSchedule of invalidSchedules) {
    const fake = fakeTransaction({ schedule: invalidSchedule });
    try {
      await assert.rejects(checkinLogbook("assistant-1", input, now));
      assert.equal(fake.writes.length, 0);
    } finally { fake.restore(); }
  }
});

test("check-in rejects another Jakarta date without opening transaction", async () => {
  const fake = fakeTransaction();
  try {
    await assert.rejects(checkinLogbook("assistant-1", { ...input, occurrenceDate: "2026-10-12" }, now), /tanggal hari ini di Jakarta/);
    assert.equal(fake.transactions.length, 0);
  } finally { fake.restore(); }
});

test("check-in rejects an unknown schedule ID instead of inferring one from the lab", async () => {
  const fake = fakeTransaction();
  try {
    await assert.rejects(checkinLogbook("assistant-1", { ...input, scheduleId: "other-schedule" }, now));
    assert.equal(fake.writes.length, 0);
  } finally { fake.restore(); }
});

test("check-in keeps both sides of Jakarta midnight on the correct business date", async () => {
  for (const instant of ["2026-10-12T17:00:00.000Z", "2026-10-13T16:59:59.999Z"]) {
    const fake = fakeTransaction();
    try {
      const result = await checkinLogbook("assistant-1", input, new Date(instant));
      assert.deepEqual(result.occurrenceDate, date);
    } finally { fake.restore(); }
  }
  const fake = fakeTransaction();
  try {
    await assert.rejects(checkinLogbook("assistant-1", input, new Date("2026-10-13T17:00:00.000Z")), /tanggal hari ini di Jakarta/);
  } finally { fake.restore(); }
});

test("existing historical or completed daily logbook still prevents check-in to another lab", async () => {
  const fake = fakeTransaction({ existing: true });
  try {
    await assert.rejects(checkinLogbook("assistant-1", { ...input, labId: "lab-2" }, now), /sudah check-in/);
    assert.equal(fake.writes.length, 0);
    assert.deepEqual(fake.lookups, [{ where: { officialCheckinById: "assistant-1", date } }]);
  } finally { fake.restore(); }
});

test("check-in maps only concurrent daily unique conflicts to duplicate check-in", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
  const conflict = new Prisma.PrismaClientKnownRequestError("unique conflict", {
    code: "P2002", clientVersion: "test", meta: { target: ["officialCheckinById", "date"] },
  });
  Object.defineProperty(prisma, "$transaction", { configurable: true, value: async () => { throw conflict; } });
  try {
    await assert.rejects(checkinLogbook("assistant-1", input, now), /sudah check-in/);
  } finally {
    if (descriptor) Object.defineProperty(prisma, "$transaction", descriptor);
    else Reflect.deleteProperty(prisma, "$transaction");
  }
});

test("occurrence migration adds nullable identity without historical backfill or uniqueness changes", () => {
  const sql = readFileSync(path.join(__dirname, "../../prisma/migrations/20261023010000_add_logbook_occurrence_identity/migration.sql"), "utf8");
  for (const column of ["labId", "scheduleId", "academicOfferingId", "occurrenceDate"]) {
    assert.match(sql, new RegExp(`ADD COLUMN "${column}" (?:TEXT|DATE)`));
  }
  assert.match(sql, /"occurrenceDate" = "date"/);
  assert.doesNotMatch(sql, /\bUPDATE\s+"logbooks"/i);
  assert.doesNotMatch(sql, /\bUNIQUE\b|DROP\s+(?:INDEX|CONSTRAINT)/i);
});
