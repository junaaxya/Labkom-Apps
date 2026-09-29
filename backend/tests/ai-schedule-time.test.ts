import { detectSchedulePeriod, getScheduleQuery } from "../src/services/ai-schedule-time";

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function expectArray(actual: unknown[], expected: unknown[], label: string): void {
  expectEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function expectMatch(actual: string, expected: RegExp, label: string): void {
  if (!expected.test(actual)) throw new Error(`${label}: ${actual} does not match ${expected}`);
}

// 2026-08-20 17:20 UTC is already Friday, 21 August 2026 00:20 in Jakarta.
const afterMidnightWib = new Date("2026-08-20T17:20:00.000Z");
const today = getScheduleQuery("jadwal hari ini", afterMidnightWib);
expectEqual(today.period, "today", "today period");
expectArray(today.days, ["JUMAT"], "today WIB day");
expectEqual(today.primaryDay, "JUMAT", "today primary day");
expectMatch(today.label, /Jumat, 21 Agustus 2026/, "today date label");
expectEqual(today.currentTime, "00:20", "today WIB time");

const tomorrow = getScheduleQuery("jadwal besok", afterMidnightWib);
expectEqual(tomorrow.period, "tomorrow", "tomorrow period");
expectArray(tomorrow.days, ["SABTU"], "tomorrow WIB day");
expectMatch(tomorrow.label, /Sabtu, 22 Agustus 2026/, "tomorrow date label");

const week = getScheduleQuery("tampilkan jadwal minggu ini", afterMidnightWib);
expectEqual(week.period, "week", "week period");
expectEqual(week.days.length, 7, "week day count");
expectEqual(week.primaryDay, "JUMAT", "week primary day");

expectEqual(detectSchedulePeriod("JADWAL BESOK"), "tomorrow", "detect tomorrow");
expectEqual(detectSchedulePeriod("jadwal minggu ini"), "week", "detect week");
expectEqual(detectSchedulePeriod("jadwal hari ini"), "today", "detect today");

console.log("AI schedule WIB tests passed");
