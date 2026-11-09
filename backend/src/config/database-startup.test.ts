import assert from "node:assert/strict";
import test from "node:test";
import { connectDatabaseWithRetry } from "./database-startup";

test("database startup retries transient failures with bounded exponential backoff", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const retries: number[] = [];

  await connectDatabaseWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("database is starting up");
    },
    {
      maxAttempts: 5,
      initialDelayMs: 100,
      maxDelayMs: 1_000,
      sleep: async (delayMs) => { delays.push(delayMs); },
      onRetry: ({ attempt }) => { retries.push(attempt); },
    },
  );

  assert.equal(attempts, 3);
  assert.deepEqual(delays, [100, 200]);
  assert.deepEqual(retries, [1, 2]);
});

test("database startup stops after the configured attempt limit", async () => {
  let attempts = 0;
  const delays: number[] = [];

  await assert.rejects(
    connectDatabaseWithRetry(
      async () => {
        attempts += 1;
        throw new Error("database unavailable");
      },
      {
        maxAttempts: 3,
        initialDelayMs: 50,
        maxDelayMs: 100,
        sleep: async (delayMs) => { delays.push(delayMs); },
      },
    ),
    /database unavailable/,
  );

  assert.equal(attempts, 3);
  assert.deepEqual(delays, [50, 100]);
});
