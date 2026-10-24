import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("logbook check-in contract", () => {
  test("submits explicit bound identity and Jakarta occurrence date", () => {
    assert.match(source, /api\.post\("\/logbooks\/checkin",[\s\S]*labId:\s*checkinLabId,[\s\S]*scheduleId:\s*checkinScheduleId,[\s\S]*occurrenceDate/);
    assert.match(source, /jakartaDateKey\(new Date\(\)\)/);
    assert.match(source, /schedule\.labId === labId/);
    assert.match(source, /schedule\.type === "PRAKTIKUM"/);
  });

  test("preserves existing checkout endpoint", () => {
    assert.match(source, /api\.patch\(`\/logbooks\/\$\{todayLogbook\.id\}\/checkout`, \{\}\)/);
  });
});
