import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inspector = readFileSync(new URL("./live-inspector.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/(dashboard)/pc-monitoring/page.tsx", import.meta.url), "utf8");
const updater = readFileSync(new URL("./agent-updater-panel.tsx", import.meta.url), "utf8");

test("PC inspector requests process, webcam, and screen data with bounded polling", () => {
  assert.match(inspector, /LIST_PROCESSES/);
  assert.match(inspector, /KILL_PROCESS/);
  assert.match(inspector, /CAPTURE_WEBCAM/);
  assert.match(inspector, /CAPTURE_SCREEN/);
  assert.match(inspector, /i < 7/);
  assert.match(inspector, /1500/);
  assert.match(inspector, /5000/);
  assert.match(inspector, /download=\{`bukti-/);
  assert.match(inspector, /15 menit/);
});

test("PC detail shows full command and agent-log failures with execution timestamp", () => {
  assert.match(page, /cmd\.result &&/);
  assert.match(page, /whitespace-pre-wrap break-words/);
  assert.match(page, /cmd\.executedAt \? `Selesai/);
  assert.match(page, /setInterval\([\s\S]*\/pcs\/\$\{pcId\}[\s\S]*5000/);
  assert.doesNotMatch(page, /log\.message && <p className="mt-0\.5 truncate/);
  assert.match(page, /const AGENT_STALE_AFTER_MS = 180 \* 1000/);
  assert.match(updater, /const AGENT_STALE_AFTER_MS = 180 \* 1000/);
});

test("PC monitoring exposes individual and bulk HTTPS URL and temp clean actions", () => {
  assert.match(page, /validHttpsUrl\(bulkUrl\.trim\(\)\)/);
  assert.match(page, /commandType === "OPEN_URL"/);
  assert.match(page, /bulkAction\("CLEAN_TEMP"\)/);
  assert.match(page, /bulkAction\("OPEN_URL"\)/);
  assert.match(page, /<LiveInspector/);
  assert.doesNotMatch(page + inspector, /CANCEL_SHUTDOWN/);
});
