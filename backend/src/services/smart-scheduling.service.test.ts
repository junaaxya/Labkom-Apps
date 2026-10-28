import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { smartSchedulingService } from "./smart-scheduling.service";

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });

  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

test("dated suggestions exclude approved bookings but keep adjacent slots", async () => {
  let bookingWhere: unknown;
  const restoreLab = replaceProperty(prisma, "lab", {
    findMany: async () => [{ id: "lab-a", name: "Lab A" }],
  });
  const restoreSchedule = replaceProperty(prisma, "schedule", {
    findMany: async () => [],
  });
  const restoreBooking = replaceProperty(prisma, "labBooking", {
    findMany: async ({ where }: { where: unknown }) => {
      bookingWhere = where;
      return [{ labId: "lab-a", startTime: "09:00", endTime: "10:00" }];
    },
  });

  try {
    const slots = await smartSchedulingService.suggestOptimalSlots(60, undefined, undefined, new Date("2026-10-13T00:00:00.000Z"));
    assert.deepEqual(bookingWhere, { date: new Date("2026-10-13T00:00:00.000Z"), status: "APPROVED" });
    assert.equal(slots.some((slot) => slot.startTime === "09:00"), false);
    assert.equal(slots.some((slot) => slot.startTime === "10:00"), true);
  } finally {
    restoreBooking();
    restoreSchedule();
    restoreLab();
  }
});

test("weekly suggestions do not treat dated bookings as recurring occupancy", async () => {
  let bookingQueries = 0;
  const restoreLab = replaceProperty(prisma, "lab", {
    findMany: async () => [{ id: "lab-a", name: "Lab A" }],
  });
  const restoreSchedule = replaceProperty(prisma, "schedule", {
    findMany: async () => [],
  });
  const restoreBooking = replaceProperty(prisma, "labBooking", {
    findMany: async () => {
      bookingQueries += 1;
      return [];
    },
  });

  try {
    const slots = await smartSchedulingService.suggestOptimalSlots(60, "SELASA");
    assert.equal(bookingQueries, 0);
    assert.equal(slots.some((slot) => slot.startTime === "09:00"), true);
  } finally {
    restoreBooking();
    restoreSchedule();
    restoreLab();
  }
});
