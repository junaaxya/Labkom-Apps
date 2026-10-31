import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { resolveActualOccurrences } from "./actual-occurrence.service";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

const date = new Date("2026-10-26T00:00:00.000Z");
const rawSchedule = {
  id: "schedule-1", labId: "lab-1", title: "Praktikum", className: "TI-1A", semester: "1",
  startTime: "08:00", endTime: "10:00", specificDate: null, day: "SENIN", type: "PRAKTIKUM",
  status: "SCHEDULED", isActive: true, academicOffering: { id: "offering-1", termId: "term-1", classId: "class-1", isActive: true }, occurrenceReleases: [],
};

test("structured occurrence projects approved swap without mutating official schedule", async () => {
  const restores = [
    replace(prisma.schedule, "findMany", async () => [rawSchedule]),
    replace(prisma.academicOccurrenceSwap, "findMany", async () => [{
      id: "swap-1", sourceScheduleId: "schedule-1", targetScheduleId: "schedule-2",
      sourceLabId: "lab-1", targetLabId: "lab-1", sourceStartTime: "08:00", sourceEndTime: "10:00",
      targetStartTime: "10:00", targetEndTime: "12:00",
    }]),
  ];
  try {
    const [actual] = await resolveActualOccurrences(prisma as never, date, { scheduleId: "schedule-1" });
    assert.equal(actual.schedule.id, "schedule-1");
    assert.equal(actual.startTime, "10:00");
    assert.equal(actual.endTime, "12:00");
    assert.equal(rawSchedule.startTime, "08:00");
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("release suppresses only structured source occurrence", async () => {
  const restores = [
    replace(prisma.schedule, "findMany", async () => [{ ...rawSchedule, occurrenceReleases: [{ id: "release-1", status: "ALLOCATED" }] }]),
    replace(prisma.academicOccurrenceSwap, "findMany", async () => []),
  ];
  try {
    assert.deepEqual(await resolveActualOccurrences(prisma as never, date), []);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("legacy occurrence remains raw when no academic binding exists", async () => {
  const legacy = { ...rawSchedule, academicOffering: null, occurrenceReleases: [], startTime: "13:00", endTime: "15:00" };
  const restore = replace(prisma.schedule, "findMany", async () => [legacy]);
  try {
    const [actual] = await resolveActualOccurrences(prisma as never, date);
    assert.equal(actual.startTime, "13:00");
    assert.equal(actual.swapId, null);
  } finally {
    restore();
  }
});

test("approved allocation projects the dated schedule as the target offering occurrence", async () => {
  const allocated = {
    ...rawSchedule,
    id: "schedule-allocation",
    type: "PEMINJAMAN",
    specificDate: date,
    academicOffering: null,
    allocatedSlotRequest: {
      id: "request-1",
      status: "APPROVED",
      bookingId: "booking-1",
      booking: { status: "APPROVED" },
      targetOffering: { id: "offering-target", termId: "term-1", classId: "class-2", isActive: true },
    },
  };
  const restores = [
    replace(prisma.schedule, "findMany", async () => [allocated]),
    replace(prisma.academicOccurrenceSwap, "findMany", async () => []),
  ];
  try {
    const [actual] = await resolveActualOccurrences(prisma as never, date);
    assert.equal(actual.schedule.id, "schedule-allocation");
    assert.equal(actual.academicOffering?.id, "offering-target");
    assert.equal(actual.allocationRequestId, "request-1");
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});
