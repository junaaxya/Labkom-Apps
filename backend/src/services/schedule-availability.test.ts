import assert from "node:assert/strict";
import test from "node:test";
import { DayOfWeek, Prisma } from "@prisma/client";
import prisma from "../config/database";
import { findOccupancyConflict, withSerializableRetry } from "./schedule-availability";

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

test("Serializable retry makes initial attempt plus two P2034 retries", async () => {
  let attempts = 0;
  const options: unknown[] = [];
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (tx: never) => Promise<unknown>, transactionOptions: unknown) => {
      attempts += 1;
      options.push(transactionOptions);
      if (attempts < 3) {
        throw new Prisma.PrismaClientKnownRequestError("serialization failure", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      return operation(undefined as never);
    },
  );

  try {
    assert.equal(await withSerializableRetry(async () => "committed"), "committed");
    assert.equal(attempts, 3);
    assert.deepEqual(options, [
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ]);
  } finally {
    restore();
  }
});

test("Serializable retry does not retry non-P2034 errors", async () => {
  let attempts = 0;
  const failure = new Prisma.PrismaClientKnownRequestError("unique conflict", {
    code: "P2002",
    clientVersion: "test",
  });
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async () => {
      attempts += 1;
      throw failure;
    },
  );

  try {
    await assert.rejects(withSerializableRetry(async () => "never"), (error: unknown) => error === failure);
    assert.equal(attempts, 1);
  } finally {
    restore();
  }
});

test("dated occupancy candidate checks matching-date schedules, same-day recurring schedules, and approved bookings", async () => {
  let scheduleWhere: unknown;
  let bookingWhere: unknown;
  const date = new Date("2026-10-13T00:00:00.000Z");
  const tx = {
    schedule: {
      findFirst: async ({ where }: { where: unknown }) => {
        scheduleWhere = where;
        return null;
      },
    },
    labBooking: {
      findFirst: async ({ where }: { where: unknown }) => {
        bookingWhere = where;
        return null;
      },
    },
  } as unknown as Parameters<typeof findOccupancyConflict>[0];

  const conflict = await findOccupancyConflict(tx, {
    labId: "lab-a",
    day: DayOfWeek.SELASA,
    startTime: "09:00",
    endTime: "10:00",
    specificDate: date,
  }, { excludeScheduleId: "schedule-1", excludeBookingId: "booking-1" });

  assert.equal(conflict, undefined);
  assert.deepEqual(scheduleWhere, {
    labId: "lab-a",
    isActive: true,
    status: { in: ["SCHEDULED", "ONGOING"] },
    startTime: { lt: "10:00" },
    endTime: { gt: "09:00" },
    OR: [
      { specificDate: date },
      { specificDate: null, day: DayOfWeek.SELASA },
    ],
    id: { not: "schedule-1" },
  });
  assert.deepEqual(bookingWhere, {
    labId: "lab-a",
    status: "APPROVED",
    startTime: { lt: "10:00" },
    endTime: { gt: "09:00" },
    id: { not: "booking-1" },
    date,
  });
});

test("recurring occupancy candidate checks every same-day schedule and approved booking weekday", async () => {
  let scheduleWhere: unknown;
  let bookingWhere: unknown;
  const tx = {
    schedule: {
      findFirst: async ({ where }: { where: unknown }) => {
        scheduleWhere = where;
        return null;
      },
    },
    labBooking: {
      findMany: async ({ where }: { where: unknown }) => {
        bookingWhere = where;
        return [{ date: new Date("2026-10-13T00:00:00.000Z"), startTime: "09:15", endTime: "09:45" }];
      },
    },
  } as unknown as Parameters<typeof findOccupancyConflict>[0];

  const conflict = await findOccupancyConflict(tx, {
    labId: "lab-a",
    day: DayOfWeek.SELASA,
    startTime: "09:00",
    endTime: "10:00",
    specificDate: null,
  });

  assert.deepEqual(conflict, { kind: "BOOKING", startTime: "09:15", endTime: "09:45" });
  assert.deepEqual(scheduleWhere, {
    labId: "lab-a",
    isActive: true,
    status: { in: ["SCHEDULED", "ONGOING"] },
    startTime: { lt: "10:00" },
    endTime: { gt: "09:00" },
    day: DayOfWeek.SELASA,
  });
  assert.deepEqual(bookingWhere, {
    labId: "lab-a",
    status: "APPROVED",
    startTime: { lt: "10:00" },
    endTime: { gt: "09:00" },
  });
});
