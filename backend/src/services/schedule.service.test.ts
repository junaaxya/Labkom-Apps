import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { ApprovalConflictError } from "./approval-conflict.error";
import { ScheduleService } from "./schedule.service";

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

function finishedSchedule() {
  return {
    id: "schedule-1",
    labId: "lab-a",
    day: "SELASA",
    startTime: "09:00",
    endTime: "10:00",
    specificDate: new Date("2026-10-13T00:00:00.000Z"),
    status: "FINISHED",
    isActive: true,
  };
}

test("status reactivation re-reads target and stops before update on occupancy conflict", async () => {
  let scheduleUpdates = 0;
  let scheduleWhere: unknown;
  let bookingWhere: unknown;
  const transactionOptions: unknown[] = [];
  const tx = {
    schedule: {
      findUnique: async () => finishedSchedule(),
      findFirst: async ({ where }: { where: unknown }) => {
        scheduleWhere = where;
        return { title: "Occupied", startTime: "09:30", endTime: "10:30" };
      },
      update: async () => {
        scheduleUpdates += 1;
        return {};
      },
    },
    labBooking: {
      findFirst: async ({ where }: { where: unknown }) => {
        bookingWhere = where;
        return null;
      },
    },
  };
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>, options: unknown) => {
      transactionOptions.push(options);
      return operation(tx);
    },
  );

  try {
    await assert.rejects(ScheduleService.updateStatus("schedule-1", "SCHEDULED"), ApprovalConflictError);
    assert.deepEqual(transactionOptions, [{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }]);
    assert.deepEqual(scheduleWhere, {
      labId: "lab-a",
      isActive: true,
      status: { in: ["SCHEDULED", "ONGOING"] },
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      OR: [
        { specificDate: finishedSchedule().specificDate },
        { specificDate: null, day: "SELASA" },
      ],
      id: { not: "schedule-1" },
    });
    assert.deepEqual(bookingWhere, {
      labId: "lab-a",
      status: "APPROVED",
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      date: finishedSchedule().specificDate,
    });
    assert.equal(scheduleUpdates, 0);
  } finally {
    restoreTransaction();
  }
});

test("status cancellation stays outside shared occupancy transaction", async () => {
  let updates = 0;
  const restoreFind = replaceProperty(prisma.schedule, "findUnique", async () => finishedSchedule());
  const restoreUpdate = replaceProperty(prisma.schedule, "update", async () => {
    updates += 1;
    return { id: "schedule-1" };
  });
  const restoreTransaction = replaceProperty(prisma, "$transaction", async () => {
    throw new Error("Cancellation must not start occupancy transaction");
  });

  try {
    await ScheduleService.updateStatus("schedule-1", "CANCELLED");
    assert.equal(updates, 1);
  } finally {
    restoreTransaction();
    restoreUpdate();
    restoreFind();
  }
});

test("today schedules and stats use Jakarta boundaries, operational statuses, exact dates, and recurring weekdays", async () => {
  const date = new Date("2026-10-13T00:00:00.000Z");
  const todayWhere = {
    isActive: true,
    status: { in: ["SCHEDULED", "ONGOING"] },
    OR: [
      { specificDate: date },
      { specificDate: null, day: "SELASA" },
    ],
  };
  const rows = [
    { id: "exact", isActive: true, status: "SCHEDULED", specificDate: date, day: "SENIN", labId: "lab-1", title: "Exact", lecturerName: null, className: null, semester: null, startTime: "08:00", endTime: "10:00", type: "PRAKTIKUM", academicOffering: null, occurrenceReleases: [], lab: null, assistant: null },
    { id: "recurring", isActive: true, status: "ONGOING", specificDate: null, day: "SELASA", labId: "lab-1", title: "Recurring", lecturerName: null, className: null, semester: null, startTime: "10:00", endTime: "12:00", type: "PRAKTIKUM", academicOffering: null, occurrenceReleases: [], lab: null, assistant: null },
    { id: "historic", isActive: true, status: "SCHEDULED", specificDate: new Date("2026-10-06T00:00:00.000Z"), day: "SELASA", labId: "lab-1", title: "Historic", lecturerName: null, className: null, semester: null, startTime: "13:00", endTime: "15:00", type: "PRAKTIKUM", academicOffering: null, occurrenceReleases: [], lab: null, assistant: null },
    { id: "finished", isActive: true, status: "FINISHED", specificDate: null, day: "SELASA", labId: "lab-1", title: "Finished", lecturerName: null, className: null, semester: null, startTime: "15:00", endTime: "17:00", type: "PRAKTIKUM", academicOffering: null, occurrenceReleases: [], lab: null, assistant: null },
  ];
  const scheduleQueries: unknown[] = [];
  const countQueries: unknown[] = [];
  const restores = [
    replaceProperty(prisma.schedule, "findMany", async ({ where }: { where: typeof todayWhere }) => {
      scheduleQueries.push(where);
      return rows.filter((row) =>
        row.isActive === where.isActive &&
        where.status.in.includes(row.status) &&
        where.OR.some((candidate) =>
          candidate.specificDate === null
            ? row.specificDate === null && row.day === candidate.day
            : row.specificDate?.getTime() === candidate.specificDate.getTime(),
        ),
      );
    }),
    replaceProperty(prisma.schedule, "count", async (args?: unknown) => {
      countQueries.push(args);
      return 1;
    }),
    replaceProperty(prisma.schedule, "groupBy", async () => []),
  ];

  try {
    const firstMinute = new Date("2026-10-12T17:01:00.000Z");
    const lastMinute = new Date("2026-10-13T16:59:00.000Z");
    const atFirstMinute = await ScheduleService.getTodaySchedules(undefined, firstMinute);
    const atLastMinute = await ScheduleService.getTodaySchedules(undefined, lastMinute);
    await ScheduleService.getStats(lastMinute);

    assert.deepEqual(atFirstMinute.map((row: { id: string }) => row.id), ["exact", "recurring"]);
    assert.deepEqual(atLastMinute.map((row: { id: string }) => row.id), ["exact", "recurring"]);
    assert.deepEqual(scheduleQueries, [todayWhere, todayWhere]);
    assert.deepEqual(countQueries[2], { where: todayWhere });
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});
