import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

const here = dirname(new URL(import.meta.url).pathname);
const page = readFileSync(join(here, "page.tsx"), "utf8");
const views = readFileSync(join(here, "dashboard-views.tsx"), "utf8");

test("student and lecturer dashboards read scoped actual schedules for today", () => {
  assert.strictEqual((page.match(/\/academic\/actual-schedules\?date=/g) || []).length, 2);
  assert.match(page, /if \(role === "DOSEN"\)/);
  assert.match(page, /if \(role === "MAHASISWA"\)/);
  assert.match(views, /Jadwal Praktikum Aktual Hari Ini/);
  assert.match(views, /Jadwal Aktual Hari Ini/);
});

test("student dashboard falls back to legacy schedules when actual data is empty", () => {
  assert.match(views, /const displayedSchedules = actualSchedules\.length > 0 \? actualSchedules : schedules/);
  assert.match(views, /actualSchedules\.length > 0 \? actualSchedules\.map/);
  assert.match(views, /: schedules\.map/);
  assert.match(views, /href="\/schedules"/);
});
