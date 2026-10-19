import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalDateOnly,
  getJakartaClock,
  jakartaTimestampRangeForDateOnly,
  weekdayForDateOnly,
} from "./jakarta-time";

test("Jakarta helper separates instant clock boundaries from UTC-canonical date-only values", () => {
  const firstMinute = getJakartaClock(new Date("2026-10-12T17:01:00.000Z"));
  const lastMinute = getJakartaClock(new Date("2026-10-13T16:59:00.000Z"));
  const dateOnly = canonicalDateOnly(new Date("2026-10-13T00:00:00.000Z"));

  assert.deepEqual(firstMinute, { date: dateOnly, day: "SELASA", time: "00:01" });
  assert.deepEqual(lastMinute, { date: dateOnly, day: "SELASA", time: "23:59" });
  assert.equal(weekdayForDateOnly(dateOnly), "SELASA");
  assert.deepEqual(jakartaTimestampRangeForDateOnly(dateOnly), {
    start: new Date("2026-10-12T17:00:00.000Z"),
    end: new Date("2026-10-13T17:00:00.000Z"),
  });
});
