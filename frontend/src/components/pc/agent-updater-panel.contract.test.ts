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

test("agent updater panel constrains intrinsic widths and clears mobile bottom navigation", () => {
  assert.match(source, /data-testid="agent-updater-panel"[^>]+min-w-0[^>]+max-w-full[^>]+overflow-hidden/);
  assert.match(source, /pb-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(source, /aria-label="Artifact ZIP" type="file"/);
  assert.match(source, /className="neo-input mt-1 block min-h-\[44px\] w-full min-w-0 max-w-full overflow-hidden/);
  assert.match(source, /className="neo-input mt-1 min-h-\[44px\] w-full min-w-0 max-w-full px-3 text-base"/);
  assert.doesNotMatch(source, /min-h-\[40px\]/);
});

test("agent updater form controls have visible labels and accessible names", () => {
  for (const label of ["Versi release", "Minimum updater", "Artifact ZIP", "Release rollout", "Target rollout", "Lab target"]) {
    assert.match(source, new RegExp(`aria-label="${label}"`));
  }
});
