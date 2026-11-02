import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

test("channels claiming current schedules use the actual occurrence resolver", () => {
  const ai = read("src/services/ai-assistant.service.ts");
  const whatsapp = read("src/services/whatsapp.service.ts");
  const schedules = read("src/services/schedule.service.ts");

  assert.match(ai, /scheduleQuery\.date[\s\S]*resolveActualOccurrences/);
  assert.match(whatsapp, /getJakartaClock\(\)[\s\S]*resolveActualOccurrences/);
  assert.match(schedules, /getStats[\s\S]*resolveActualOccurrences/);
});

test("weekly readers remain explicitly labelled as recurring schedules", () => {
  const ai = read("src/services/ai-assistant.service.ts");
  const calendar = read("src/services/google-calendar-event.ts");

  assert.match(ai, /Jadwal berulang resmi; perubahan per tanggal lihat Portal Akademik/);
  assert.match(calendar, /Jadwal berulang resmi/);
  assert.match(calendar, /Perubahan per tanggal, pelepasan slot, dan pertukaran lihat Portal Akademik/);
});
