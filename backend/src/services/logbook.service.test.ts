import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { LogbookService } from "./logbook.service";

type Restore = () => void;

function replaceMethod(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Reflect.deleteProperty(target, key);
    }
  };
}

function restoreAll(restores: Restore[]): void {
  for (const restore of restores.reverse()) restore();
}

test("logbook checkout rejects no submitted conditions before key query or update", async () => {
  let keyQueries = 0;
  let updates = 0;
  const restores = [
    replaceMethod(prisma.logbook, "findUnique", async () => ({
      id: "logbook-1",
      status: "CHECKED_IN",
      conditions: [],
    })),
    replaceMethod(prisma.key, "findMany", async () => {
      keyQueries += 1;
      return [];
    }),
    replaceMethod(prisma.logbook, "update", async () => {
      updates += 1;
      return { id: "logbook-1" };
    }),
  ];

  try {
    await assert.rejects(LogbookService.checkout("logbook-1", "assistant-1"), /Belum ada kondisi lab yang disubmit/);
    assert.equal(keyQueries, 0);
    assert.equal(updates, 0);
  } finally {
    restoreAll(restores);
  }
});

test("logbook checkout blocks borrowed keys only in submitted condition labs", async () => {
  const keyQueries: any[] = [];
  let updates = 0;
  const restores = [
    replaceMethod(prisma.logbook, "findUnique", async () => ({
      id: "logbook-1",
      status: "CHECKED_IN",
      conditions: [{ labId: "lab-1", verified: true }],
    })),
    replaceMethod(prisma.key, "findMany", async (args: any) => {
      keyQueries.push(args);
      return [{ lab: { name: "Lab 1" } }];
    }),
    replaceMethod(prisma.logbook, "update", async () => {
      updates += 1;
      return { id: "logbook-1" };
    }),
  ];

  try {
    await assert.rejects(LogbookService.checkout("logbook-1", "assistant-1"), /Masih ada kunci yang belum dikembalikan: Lab 1/);
    assert.deepEqual(keyQueries, [{
      where: { status: "BORROWED", labId: { in: ["lab-1"] } },
      include: { lab: { select: { name: true } } },
    }]);
    assert.equal(updates, 0);
  } finally {
    restoreAll(restores);
  }
});

test("logbook checkout does not block borrowed keys outside submitted condition labs", async () => {
  const keyQueries: any[] = [];
  const borrowedKeys = [{ labId: "lab-2", lab: { name: "Lab 2" } }];
  let updates = 0;
  const restores = [
    replaceMethod(prisma.logbook, "findUnique", async () => ({
      id: "logbook-1",
      status: "CHECKED_IN",
      conditions: [{ labId: "lab-1", verified: true }],
    })),
    replaceMethod(prisma.key, "findMany", async (args: any) => {
      keyQueries.push(args);
      return borrowedKeys.filter((key) => args.where.labId.in.includes(key.labId));
    }),
    replaceMethod(prisma.logbook, "update", async () => {
      updates += 1;
      return { id: "logbook-1" };
    }),
  ];

  try {
    await LogbookService.checkout("logbook-1", "assistant-1");
    assert.deepEqual(keyQueries, [{
      where: { status: "BORROWED", labId: { in: ["lab-1"] } },
      include: { lab: { select: { name: true } } },
    }]);
    assert.equal(updates, 1);
  } finally {
    restoreAll(restores);
  }
});

test("logbook checkout scopes borrowed key query to condition labs and still blocks unverified conditions", async () => {
  const keyQueries: any[] = [];
  let updates = 0;
  const restores = [
    replaceMethod(prisma.logbook, "findUnique", async () => ({
      id: "logbook-1",
      status: "CHECKED_IN",
      conditions: [
        { labId: "lab-1", verified: false },
        { labId: "lab-2", verified: true },
      ],
    })),
    replaceMethod(prisma.key, "findMany", async (args: any) => {
      keyQueries.push(args);
      return [];
    }),
    replaceMethod(prisma.lab, "findMany", async () => ([{ name: "Lab 1" }])),
    replaceMethod(prisma.logbook, "update", async () => {
      updates += 1;
      return { id: "logbook-1" };
    }),
  ];

  try {
    await assert.rejects(LogbookService.checkout("logbook-1", "assistant-1"), /Masih ada kondisi lab yang belum diverifikasi: Lab 1/);

    assert.deepEqual(keyQueries, [{
      where: { status: "BORROWED", labId: { in: ["lab-1", "lab-2"] } },
      include: { lab: { select: { name: true } } },
    }]);
    assert.equal(updates, 0);
  } finally {
    restoreAll(restores);
  }
});

test("today logbook uses Jakarta boundaries for operational schedules and bounded key logs", async () => {
  const logbookQueries: any[] = [];
  const scheduleQueries: any[] = [];
  const keyLogQueries: any[] = [];
  const date = new Date("2026-10-13T00:00:00.000Z");
  const expectedScheduleWhere = {
    labId: { in: ["lab-1"] },
    isActive: true,
    status: { in: ["SCHEDULED", "ONGOING"] },
    OR: [
      { specificDate: date },
      { specificDate: null, day: "SELASA" },
    ],
  };
  const restores = [
    replaceMethod(prisma.logbook, "findFirst", async (args: any) => {
      logbookQueries.push(args);
      return { id: "logbook-1", conditions: [{ labId: "lab-1" }] };
    }),
    replaceMethod(prisma.lab, "findMany", async () => []),
    replaceMethod(prisma.schedule, "findMany", async (args: any) => {
      scheduleQueries.push(args);
      return [];
    }),
    replaceMethod(prisma.keyLog, "findMany", async (args: any) => {
      keyLogQueries.push(args);
      return [];
    }),
  ];

  try {
    await LogbookService.getTodayLogbook("assistant-1", new Date("2026-10-12T17:01:00.000Z"));
    await LogbookService.getTodayLogbook("assistant-1", new Date("2026-10-13T16:59:00.000Z"));

    assert.deepEqual(logbookQueries.map((query) => query.where), [
      { officialCheckinById: "assistant-1", date },
      { officialCheckinById: "assistant-1", date },
    ]);
    assert.deepEqual(scheduleQueries.map((query) => query.where), [expectedScheduleWhere, expectedScheduleWhere]);
    assert.deepEqual(keyLogQueries.map((query) => query.where.createdAt), [
      { gte: new Date("2026-10-12T17:00:00.000Z"), lt: new Date("2026-10-13T17:00:00.000Z") },
      { gte: new Date("2026-10-12T17:00:00.000Z"), lt: new Date("2026-10-13T17:00:00.000Z") },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("historical logbook enrichment uses date-only schedules and a bounded Jakarta key-log day", async () => {
  let scheduleQuery: any;
  let keyLogQuery: any;
  const date = new Date("2026-10-13T00:00:00.000Z");
  const restores = [
    replaceMethod(prisma.logbook, "findUnique", async () => ({
      id: "logbook-1",
      date,
      conditions: [{ labId: "lab-1" }],
    })),
    replaceMethod(prisma.schedule, "findMany", async (args: any) => {
      scheduleQuery = args;
      return [];
    }),
    replaceMethod(prisma.keyLog, "findMany", async (args: any) => {
      keyLogQuery = args;
      return [];
    }),
  ];

  try {
    await LogbookService.getLogbookById("logbook-1");

    assert.deepEqual(scheduleQuery.where, {
      labId: { in: ["lab-1"] },
      isActive: true,
      OR: [
        { specificDate: date },
        { specificDate: null, day: "SELASA" },
      ],
    });
    assert.deepEqual(keyLogQuery.where.createdAt, {
      gte: new Date("2026-10-12T17:00:00.000Z"),
      lt: new Date("2026-10-13T17:00:00.000Z"),
    });
  } finally {
    restoreAll(restores);
  }
});

test("logbook stats keeps Jakarta today range stable at first and last minute", async () => {
  const countQueries: any[] = [];
  const restores = [
    replaceMethod(prisma.logbook, "groupBy", async () => []),
    replaceMethod(prisma.logbook, "count", async (args?: any) => {
      countQueries.push(args);
      return 0;
    }),
  ];

  try {
    await LogbookService.getStats(new Date("2026-10-12T17:01:00.000Z"));
    await LogbookService.getStats(new Date("2026-10-13T16:59:00.000Z"));

    assert.deepEqual(countQueries.filter((query) => query?.where?.date).map((query) => query.where.date), [
      { gte: new Date("2026-10-13T00:00:00.000Z"), lt: new Date("2026-10-14T00:00:00.000Z") },
      { gte: new Date("2026-10-13T00:00:00.000Z"), lt: new Date("2026-10-14T00:00:00.000Z") },
    ]);
  } finally {
    restoreAll(restores);
  }
});
