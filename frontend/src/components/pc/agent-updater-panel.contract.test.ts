import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./agent-updater-panel.tsx", import.meta.url), "utf8");

test("agent updater panel keeps assistant read-only and exposes coordinator rollout controls", () => {
  assert.match(source, /const canManage = role === "KOORDINATOR_LAB"/);
  assert.match(source, /Upload signed release/);
  assert.match(source, /PC terpilih/);
  assert.match(source, /Satu lab/);
  assert.match(source, /Semua PC/);
  assert.match(source, /Pause/);
  assert.match(source, /Resume/);
  assert.match(source, /Rollback N-1/);
});

test("dashboard shows required updater progress states", () => {
  for (const status of ["PENDING", "DOWNLOADING", "VERIFYING", "INSTALLING", "SUCCEEDED", "FAILED", "ROLLED_BACK"]) {
    assert.match(source, new RegExp(status));
  }
});
