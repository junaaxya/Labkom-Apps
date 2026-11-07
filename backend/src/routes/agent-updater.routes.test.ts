import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routes = readFileSync(path.join(__dirname, "pc.routes.ts"), "utf8");
const adminRoutes = readFileSync(path.join(__dirname, "agent-updater.routes.ts"), "utf8");
const service = readFileSync(path.join(__dirname, "../services/agent-updater.service.ts"), "utf8");

test("agent updater endpoints retain agent auth, replay limiter, and authenticated artifact download", () => {
  assert.match(routes, /router\.get\("\/agent\/update", agentCommandLimiter, authenticateAgent/);
  assert.match(routes, /router\.post\("\/agent\/update-status", agentCommandLimiter, authenticateAgent/);
  assert.match(routes, /router\.get\("\/agent\/releases\/:version\/download", agentCommandLimiter, authenticateAgent/);
});

test("coordinator mutates updater while assistant can only read", () => {
  assert.match(adminRoutes, /router\.use\(authenticate, authorize\("KOORDINATOR_LAB", "ASISTEN_LAB"\)\)/);
  for (const endpoint of ["releases", "rollouts"]) assert.match(adminRoutes, new RegExp(`router\\.get\\(\"/${endpoint}\"`));
  assert.match(adminRoutes, /router\.post\("\/releases", authorize\("KOORDINATOR_LAB"\)/);
  assert.match(adminRoutes, /router\.post\("\/rollouts", authorize\("KOORDINATOR_LAB"\)/);
  assert.match(adminRoutes, /router\.post\("\/rollouts\/:id\/rollback", authorize\("KOORDINATOR_LAB"\)/);
});

test("success remains heartbeat-owned and artifacts are signed immutable metadata", () => {
  assert.match(service, /SUCCEEDED hanya dapat disahkan oleh heartbeat target/);
  assert.match(service, /status: \{ in: \["AWAITING_HEARTBEAT", "ROLLING_BACK"\] \}, targetVersion: agentVersion/);
  assert.match(service, /crypto\.sign\(null, Buffer\.from\(canonicalManifest\(data\)\), privateKey\)/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /AGENT_RELEASE_MAX_BYTES = 50 \* 1024 \* 1024/);
});
