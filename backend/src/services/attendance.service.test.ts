import assert from "node:assert/strict";
import test from "node:test";
import { isLateCheckin, pickTodaySchedule } from "./attendance.service";

test("08:00 shift marks 09:00 WIB as late", () => {
  assert.equal(isLateCheckin(new Date("2026-07-14T02:00:00.000Z"), "08:00", 15), true);
});

test("zero tolerance is honored for picket check-in", () => {
  assert.equal(isLateCheckin(new Date("2026-07-14T01:00:00.000Z"), "08:00", 0), false);
  assert.equal(isLateCheckin(new Date("2026-07-14T01:01:00.000Z"), "08:00", 0), true);
});

test("check-in exactly at the tolerance boundary is still on time", () => {
  assert.equal(isLateCheckin(new Date("2026-07-14T01:15:00.000Z"), "08:00", 15), false);
  assert.equal(isLateCheckin(new Date("2026-07-14T01:16:00.000Z"), "08:00", 15), true);
});

test("today schedule picks the latest shift already started in WIB", () => {
  const selected = pickTodaySchedule(
    [
      { id: "shift-2", shift: { startTime: "10:00" } },
      { id: "shift-1", shift: { startTime: "08:00" } },
      { id: "shift-3", shift: { startTime: "13:00" } },
    ],
    new Date("2026-07-14T05:30:00.000Z"),
  );

  assert.equal(selected?.id, "shift-2");
});

test("today schedule falls back to earliest shift when none has started yet", () => {
  const selected = pickTodaySchedule(
    [
      { id: "shift-2", shift: { startTime: "10:00" } },
      { id: "shift-1", shift: { startTime: "08:00" } },
    ],
    new Date("2026-07-14T00:30:00.000Z"),
  );

  assert.equal(selected?.id, "shift-1");
});
