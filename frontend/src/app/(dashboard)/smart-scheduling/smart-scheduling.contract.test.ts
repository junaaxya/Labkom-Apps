import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(import.meta.dirname, "page.tsx"), "utf8");

test("smart scheduling date input keeps suggestions advisory and date-aware", () => {
  assert.match(source, /type="date"/);
  assert.match(source, /query\.set\("targetDate", targetDate\)/);
  assert.match(source, /Saran ini tidak membuat reservasi/);
  assert.match(source, /validasi akhir tetap dilakukan saat jadwal atau booking disimpan/);
});
