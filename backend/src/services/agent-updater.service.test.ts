import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionUpdate, compareSemver, requireSemver } from "./agent-updater.service";

test("updater compares numeric SemVer and rejects invalid versions", () => {
  assert.equal(compareSemver("1.10.0", "1.9.9") > 0, true);
  assert.equal(compareSemver("2.0.0", "2.0.0"), 0);
  assert.throws(() => requireSemver("1.2", "version"), /SemVer/);
  assert.throws(() => requireSemver("01.2.3", "version"), /SemVer/);
});

test("runtime may roll back after swap/start failure while agent cannot report success", () => {
  assert.equal(canTransitionUpdate("INSTALLING", "ROLLING_BACK"), true);
  assert.equal(canTransitionUpdate("INSTALLING", "FAILED"), true);
  assert.equal(canTransitionUpdate("AWAITING_HEARTBEAT", "SUCCEEDED"), false);
  assert.equal(canTransitionUpdate("ROLLING_BACK", "ROLLED_BACK"), true);
});
