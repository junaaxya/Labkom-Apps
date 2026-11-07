import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monitoring = readFileSync(new URL("../../app/(dashboard)/pc-monitoring/page.tsx", import.meta.url), "utf8");
const updater = readFileSync(new URL("../../app/(dashboard)/pc-monitoring/agent-updater/page.tsx", import.meta.url), "utf8");

test("PC Monitoring exposes updater as a compact quick action", () => {
  assert.match(monitoring, /href=\{selectedPCs\.length \? `\/pc-monitoring\/agent-updater\?pcs=/);
  assert.match(monitoring, /Kelola pembaruan agent/);
  assert.doesNotMatch(monitoring, /<AgentUpdaterPanel/);
});

test("dedicated updater route renders responsive panel and preserves selected PCs", () => {
  assert.match(updater, /searchParams\.get\("pcs"\)/);
  assert.match(updater, /<AgentUpdaterPanel labs=\{labs\} selectedPcIds=\{selectedPcIds\}/);
  assert.match(updater, /Kembali ke PC Monitoring/);
});
