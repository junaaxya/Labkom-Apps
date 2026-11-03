import assert from "node:assert/strict";
import test from "node:test";
import { MagangApprovalEmailWorker } from "./magang-approval-email-worker.service";
import { MagangApprovalEmailDeliveryService } from "./magang-approval-email-delivery.service";

test("MagangApprovalEmailWorker remains disabled by default when EMAIL_WORKER_ENABLED is not true", () => {
  const original = process.env.EMAIL_WORKER_ENABLED;
  delete process.env.EMAIL_WORKER_ENABLED;
  MagangApprovalEmailWorker.resetForTest();

  try {
    assert.equal(MagangApprovalEmailWorker.isEnabled(), false);
    const started = MagangApprovalEmailWorker.start(100);
    assert.equal(started, false);
    assert.equal(MagangApprovalEmailWorker.isRunning(), false);
  } finally {
    MagangApprovalEmailWorker.resetForTest();
    if (original !== undefined) process.env.EMAIL_WORKER_ENABLED = original;
    else delete process.env.EMAIL_WORKER_ENABLED;
  }
});

test("MagangApprovalEmailWorker starts and stops cleanly when EMAIL_WORKER_ENABLED is true", async () => {
  const original = process.env.EMAIL_WORKER_ENABLED;
  process.env.EMAIL_WORKER_ENABLED = "true";
  MagangApprovalEmailWorker.resetForTest();

  try {
    assert.equal(MagangApprovalEmailWorker.isEnabled(), true);
    const started = MagangApprovalEmailWorker.start(100);
    assert.equal(started, true);
    assert.equal(MagangApprovalEmailWorker.isRunning(), true);

    await MagangApprovalEmailWorker.stop();
    assert.equal(MagangApprovalEmailWorker.isRunning(), false);
  } finally {
    MagangApprovalEmailWorker.resetForTest();
    if (original !== undefined) process.env.EMAIL_WORKER_ENABLED = original;
    else delete process.env.EMAIL_WORKER_ENABLED;
  }
});

test("MagangApprovalEmailWorker tick invokes recoverDue with batch size and prevents overlapping ticks", async () => {
  MagangApprovalEmailWorker.resetForTest();
  let recoveredCallCount = 0;
  let batchSizePassed = 0;

  const originalRecover = MagangApprovalEmailDeliveryService.recoverDue;
  MagangApprovalEmailDeliveryService.recoverDue = async (_now = new Date(), batchSize = 10) => {
    recoveredCallCount += 1;
    batchSizePassed = batchSize;
    // Simulate some async processing
    await new Promise((resolve) => setTimeout(resolve, 50));
    return 3;
  };

  try {
    // Run two ticks concurrently - second tick should be skipped due to isRunningTick lock
    const [res1, res2] = await Promise.all([
      MagangApprovalEmailWorker.tick(new Date(), 15),
      MagangApprovalEmailWorker.tick(new Date(), 15),
    ]);

    assert.equal(recoveredCallCount, 1);
    assert.equal(batchSizePassed, 15);
    // One tick processed 3, overlapping tick returned 0
    assert.equal(res1 + res2, 3);
  } finally {
    MagangApprovalEmailDeliveryService.recoverDue = originalRecover;
    MagangApprovalEmailWorker.resetForTest();
  }
});

test("MagangApprovalEmailWorker tick catches transient errors without crashing", async () => {
  MagangApprovalEmailWorker.resetForTest();
  const originalRecover = MagangApprovalEmailDeliveryService.recoverDue;
  const originalConsoleError = console.error;
  let loggedError = "";

  console.error = (...args: any[]) => {
    loggedError = args.join(" ");
  };
  MagangApprovalEmailDeliveryService.recoverDue = async () => {
    throw new Error("Transient database connection failure");
  };

  try {
    const result = await MagangApprovalEmailWorker.tick();
    assert.equal(result, 0);
    assert.ok(loggedError.includes("Transient database connection failure"));
    assert.equal(MagangApprovalEmailWorker.isBusy(), false);
  } finally {
    console.error = originalConsoleError;
    MagangApprovalEmailDeliveryService.recoverDue = originalRecover;
    MagangApprovalEmailWorker.resetForTest();
  }
});

test("requeue flips FAILED delivery to QUEUED with reset attempts and immediate nextAttemptAt", async () => {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  MagangApprovalEmailDeliveryService.setStoreForTest({
    findUnique: async () => null,
    findMany: async () => [],
    updateMany: async (args: { where: unknown; data: Record<string, unknown> }) => {
      updates.push(args);
      return { count: 1 };
    },
  });

  try {
    const now = new Date("2026-10-13T10:00:00Z");
    const ok = await MagangApprovalEmailDeliveryService.requeue("delivery-failed-1", now);
    assert.equal(ok, true);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].where, { id: "delivery-failed-1", status: "FAILED" });
    assert.equal(updates[0].data.status, "QUEUED");
    assert.equal(updates[0].data.attempts, 0);
    assert.equal(updates[0].data.nextAttemptAt, now);
    assert.equal(updates[0].data.leaseExpiresAt, null);
    assert.equal(updates[0].data.lastErrorCode, null);
  } finally {
    MagangApprovalEmailDeliveryService.setStoreForTest(null);
  }
});
