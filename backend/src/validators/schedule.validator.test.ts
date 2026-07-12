import assert from "node:assert/strict";
import test from "node:test";
import { createScheduleSchema, updateScheduleSchema } from "./schedule.validator";

const validSchedule = {
  labId: "lab-1",
  title: "Praktikum Basis Data",
  day: "SENIN",
  startTime: "08:00",
  endTime: "10:00",
  type: "PRAKTIKUM",
} as const;

test("create schedule accepts valid clock interval", () => {
  assert.equal(createScheduleSchema.safeParse(validSchedule).success, true);
});

test("create schedule rejects invalid clock ranges", () => {
  assert.equal(createScheduleSchema.safeParse({ ...validSchedule, startTime: "99:99" }).success, false);
  assert.equal(createScheduleSchema.safeParse({ ...validSchedule, endTime: "24:00" }).success, false);
  assert.equal(createScheduleSchema.safeParse({ ...validSchedule, endTime: "10:60" }).success, false);
});

test("create schedule rejects zero or reversed interval", () => {
  assert.equal(createScheduleSchema.safeParse({ ...validSchedule, startTime: "10:00", endTime: "10:00" }).success, false);
  assert.equal(createScheduleSchema.safeParse({ ...validSchedule, startTime: "11:00", endTime: "10:00" }).success, false);
});

test("update schedule rejects provided zero or reversed interval", () => {
  assert.equal(updateScheduleSchema.safeParse({ startTime: "10:00", endTime: "10:00" }).success, false);
  assert.equal(updateScheduleSchema.safeParse({ startTime: "11:00", endTime: "10:00" }).success, false);
});
