import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { jakartaDateKey } from "./jakarta-date";

describe("Jakarta attendance date compatibility", () => {
  test("maps UTC instants around Jakarta midnight to Jakarta calendar dates", () => {
    assert.equal(jakartaDateKey("2026-10-10T16:59:59.999Z"), "2026-10-10");
    assert.equal(jakartaDateKey("2026-10-10T17:00:00.000Z"), "2026-10-11");
  });

  test("attendance selection uses Jakarta helper instead of local or UTC date strings", () => {
    const source = readFileSync(new URL("../app/(dashboard)/attendance/page.tsx", import.meta.url), "utf8");
    assert.match(source, /jakartaDateKey\(new Date\(\)\)/);
    assert.match(source, /jakartaDateKey\(s\.scheduleDate\)/);
    assert.match(source, /jakartaDateKey\(a\.checkinAt \|\| a\.createdAt\)/);
    assert.doesNotMatch(source, /toISOString\(\)\.split\("T"\)\[0\]/);
    assert.doesNotMatch(source, /toDateString\(\)/);
  });
});
