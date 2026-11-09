import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  AGENT_COMMAND_POLLS_PER_WINDOW,
  AGENT_COMMAND_RATE_LIMIT_MAX,
  AGENT_HEARTBEAT_INTERVAL_MS,
  AGENT_OFFLINE_AFTER_HEARTBEATS,
  AGENT_OFFLINE_AFTER_MS,
} from "./agent-policy";

test("offline threshold tolerates two missed 60-second heartbeats", () => {
  assert.equal(AGENT_HEARTBEAT_INTERVAL_MS, 60_000);
  assert.equal(AGENT_OFFLINE_AFTER_HEARTBEATS, 3);
  assert.equal(AGENT_OFFLINE_AFTER_MS, 180_000);

  const service = readFileSync(path.join(__dirname, "../services/pc.service.ts"), "utf8");
  assert.match(service, /import \{ AGENT_OFFLINE_AFTER_MS \} from "\.\.\/config\/agent-policy"/);
  assert.doesNotMatch(service, /90 \* 1000/);
});

test("command limiter leaves headroom beyond five-second polling", () => {
  assert.equal(AGENT_COMMAND_POLLS_PER_WINDOW, 60);
  assert.equal(AGENT_COMMAND_RATE_LIMIT_MAX, 90);
  assert.ok(AGENT_COMMAND_RATE_LIMIT_MAX > AGENT_COMMAND_POLLS_PER_WINDOW);
  assert.ok(AGENT_COMMAND_RATE_LIMIT_MAX <= AGENT_COMMAND_POLLS_PER_WINDOW * 1.5);

  const middleware = readFileSync(path.join(__dirname, "../middlewares/agentAuth.middleware.ts"), "utf8");
  assert.match(middleware, /windowMs: AGENT_COMMAND_RATE_LIMIT_WINDOW_MS/);
  assert.match(middleware, /max: AGENT_COMMAND_RATE_LIMIT_MAX/);
});
