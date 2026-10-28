import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { LogbookService } from "./logbook.service";

function replace(target: object, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("new logbook condition cannot be submitted for a different lab", async () => {
  let writes = 0;
  const restores = [
    replace(prisma.logbook, "findUnique", async () => ({ id: "logbook-1", status: "CHECKED_IN", labId: "lab-1" })),
    replace(prisma.logbookCondition, "upsert", async () => { writes += 1; }),
  ];
  try {
    await assert.rejects(LogbookService.submitCondition("logbook-1", "lab-2", "staff", "ASISTEN_LAB", { fotoBukti: ["photo"] }), /lab pada logbook/);
    assert.equal(writes, 0);
  } finally { restores.reverse().forEach((restore) => restore()); }
});

test("new logbook cannot checkout using verified condition from another lab", async () => {
  let updates = 0;
  const tx = {
    logbook: {
      findUnique: async () => ({ id: "logbook-1", labId: "lab-1", status: "CHECKED_IN", conditions: [{ labId: "lab-2", verified: true }] }),
      update: async () => { updates += 1; },
    },
  };
  const restore = replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
  try {
    await assert.rejects(LogbookService.checkout("logbook-1", "staff"), /lab pada logbook/);
    assert.equal(updates, 0);
  } finally { restore(); }
});

test("checkout accepts verified bound condition and ignores borrowed keys in other labs", async () => {
  const updates: unknown[] = [];
  const options: unknown[] = [];
  const tx = {
    logbook: {
      findUnique: async () => ({ id: "logbook-1", labId: "lab-1", status: "CHECKED_IN", conditions: [{ labId: "lab-1", verified: true }] }),
      update: async (args: unknown) => { updates.push(args); return { id: "logbook-1", status: "COMPLETED" }; },
    },
    key: {
      findMany: async ({ where }: { where: { labId: { in: string[] } } }) =>
        [{ labId: "lab-2", lab: { name: "Lab 2" } }].filter((key) => where.labId.in.includes(key.labId)),
    },
  };
  const restore = replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>, transactionOptions: unknown) => {
    options.push(transactionOptions); return operation(tx);
  });
  try {
    const result = await LogbookService.checkout("logbook-1", "staff");
    assert.equal(result.status, "COMPLETED");
    assert.deepEqual(options, [{ isolationLevel: "Serializable" }]);
    assert.equal(updates.length, 1);
  } finally { restore(); }
});

test("historical logbook with multiple condition labs still checks out without inferred identity", async () => {
  const updates: { data: { status: string; officialCheckoutById: string } }[] = [];
  const keyQueries: { where: { labId: { in: string[] } } }[] = [];
  const tx = {
    logbook: {
      findUnique: async () => ({ id: "old-logbook", labId: null, scheduleId: null, status: "CHECKED_IN", conditions: [
        { labId: "lab-1", verified: true }, { labId: "lab-2", verified: true },
      ] }),
      update: async (query: { data: { status: string; officialCheckoutById: string } }) => {
        updates.push(query); return { id: "old-logbook", ...query.data };
      },
    },
    key: { findMany: async (query: { where: { labId: { in: string[] } } }) => { keyQueries.push(query); return []; } },
  };
  const restore = replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
  try {
    const result = await LogbookService.checkout("old-logbook", "staff");
    assert.equal(result.status, "COMPLETED");
    assert.equal(updates[0]?.data.officialCheckoutById, "staff");
    assert.deepEqual(keyQueries[0]?.where.labId.in, ["lab-1", "lab-2"]);
  } finally { restore(); }
});

test("checkout retries a serialization conflict and rechecks whether the logbook is completed", async () => {
  let attempts = 0;
  let writes = 0;
  const tx = {
    logbook: {
      findUnique: async () => ({ id: "logbook-1", labId: "lab-1", status: attempts === 1 ? "CHECKED_IN" : "COMPLETED", conditions: [{ labId: "lab-1", verified: true }] }),
      update: async () => { writes += 1; return { id: "logbook-1" }; },
    },
    key: { findMany: async () => [] },
  };
  const restore = replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable");
    attempts += 1;
    const result = await operation(tx);
    if (attempts === 1) throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
    return result;
  });
  try {
    await assert.rejects(LogbookService.checkout("logbook-1", "staff"), /Sesi sudah selesai/);
    assert.equal(attempts, 2);
    assert.equal(writes, 1);
  } finally { restore(); }
});

test("bound today lookup uses only recorded schedule and lab before condition submission", async () => {
  const scheduleQueries: { where: Record<string, unknown> }[] = [];
  const keyQueries: { where: { key: unknown } }[] = [];
  let labQueries = 0;
  const restores = [
    replace(prisma.logbook, "findFirst", async () => ({ id: "logbook-1", labId: "lab-1", scheduleId: "schedule-1", conditions: [] })),
    replace(prisma.lab, "findMany", async () => { labQueries += 1; return []; }),
    replace(prisma.schedule, "findMany", async (query: { where: Record<string, unknown> }) => { scheduleQueries.push(query); return []; }),
    replace(prisma.keyLog, "findMany", async (query: { where: { key: unknown } }) => { keyQueries.push(query); return []; }),
  ];
  try {
    const result = await LogbookService.getTodayLogbook("assistant-1", new Date("2026-10-12T17:01:00.000Z"));
    assert.equal(result?.scheduleId, "schedule-1");
    assert.equal(labQueries, 0);
    assert.equal(scheduleQueries[0]?.where.id, "schedule-1");
    assert.equal(scheduleQueries[0]?.where.labId, undefined);
    assert.deepEqual(keyQueries[0]?.where.key, { labId: { in: ["lab-1"] } });
  } finally { restores.reverse().forEach((restore) => restore()); }
});

test("historical today lookup with no conditions retains all-lab discovery", async () => {
  const scheduleQueries: { where: { labId: unknown } }[] = [];
  const restores = [
    replace(prisma.logbook, "findFirst", async () => ({ id: "old-logbook", labId: null, scheduleId: null, conditions: [] })),
    replace(prisma.lab, "findMany", async () => [{ id: "lab-1" }, { id: "lab-2" }]),
    replace(prisma.schedule, "findMany", async (query: { where: { labId: unknown } }) => { scheduleQueries.push(query); return []; }),
    replace(prisma.keyLog, "findMany", async () => []),
  ];
  try {
    const result = await LogbookService.getTodayLogbook("assistant-1", new Date("2026-10-12T17:01:00.000Z"));
    assert.equal(result?.scheduleId, null);
    assert.deepEqual(scheduleQueries[0]?.where.labId, { in: ["lab-1", "lab-2"] });
  } finally { restores.reverse().forEach((restore) => restore()); }
});

test("historical ambiguous detail returns all matching schedules without assigning an identity", async () => {
  const historicalDate = new Date("2026-10-13T00:00:00.000Z");
  const matches = [{ id: "schedule-1", labId: "lab-1" }, { id: "schedule-2", labId: "lab-1" }];
  const restores = [
    replace(prisma.logbook, "findUnique", async () => ({ id: "old-logbook", date: historicalDate, labId: null, scheduleId: null, academicOfferingId: null, occurrenceDate: null, conditions: [{ labId: "lab-1" }] })),
    replace(prisma.schedule, "findMany", async () => matches),
    replace(prisma.keyLog, "findMany", async () => []),
  ];
  try {
    const result = await LogbookService.getLogbookById("old-logbook");
    assert.equal(result.scheduleId, null);
    assert.equal(result.academicOfferingId, null);
    const condition = result.conditions[0];
    assert.ok(condition && "schedules" in condition);
    assert.deepEqual(condition.schedules, matches);
  } finally { restores.reverse().forEach((restore) => restore()); }
});
