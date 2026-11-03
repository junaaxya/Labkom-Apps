import assert from "node:assert/strict";
import test from "node:test";
import { MagangApprovalEmailDeliveryService } from "./magang-approval-email-delivery.service";
import { MagangVerificationEmailService } from "./magang-verification-email.service";

type Delivery = {
  id: string;
  recipientEmail: string;
  status: "QUEUED" | "PROCESSING";
  attempts: number;
  leaseExpiresAt: Date | null;
};

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, property, descriptor);
    } else {
      Reflect.deleteProperty(target, property);
    }
  };
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function mockDeliveryStore(delivery: Delivery | null) {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  let claimed = false;
  const store = {
    findUnique: async () => delivery,
    findMany: async () => [],
    updateMany: async (args: { where: unknown; data: Record<string, unknown> }) => {
      updates.push(args);
      const isClaim = args.data.status === "PROCESSING";
      if (isClaim && claimed) return { count: 0 };
      if (isClaim) claimed = true;
      if (isClaim && delivery) {
        delivery.status = "PROCESSING";
        delivery.attempts += 1;
        delivery.leaseExpiresAt = args.data.leaseExpiresAt as Date;
      }
      return { count: 1 };
    },
  };
  MagangApprovalEmailDeliveryService.setStoreForTest(store);

  return { updates, restore: () => MagangApprovalEmailDeliveryService.setStoreForTest(null) };
}

test("claimed MAGANG approval delivery captures QA email and persists QA_CAPTURED once", async () => {
  const originalAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://labkom.example.test";
  const { updates, restore } = mockDeliveryStore({
    id: "delivery-1",
    recipientEmail: "magang@example.test",
    status: "QUEUED",
    attempts: 0,
    leaseExpiresAt: null,
  });
  let sent: { email: string; loginUrl: string } | undefined;
  const restoreEmail = replaceProperty(
    MagangVerificationEmailService,
    "sendApprovalNotification",
    async (email: string, loginUrl: string) => { sent = { email, loginUrl }; return "QA_CAPTURED" as const; },
  );

  try {
    await MagangApprovalEmailDeliveryService.dispatch("delivery-1");

    assert.deepEqual(sent, {
      email: "magang@example.test",
      loginUrl: "https://labkom.example.test/login",
    });
    assert.equal(updates.length, 2);
    assert.equal((updates[0].where as { id: string }).id, "delivery-1");
    assert.equal(updates[0].data.status, "PROCESSING");
    assert.deepEqual(updates[0].data.attempts, { increment: 1 });
    assert.ok(updates[0].data.lastAttemptAt instanceof Date);
    assert.equal((updates[1].where as { id: string }).id, "delivery-1");
    assert.equal(updates[1].data.status, "QA_CAPTURED");
    assert.equal(updates[1].data.attempts, undefined);
    assert.equal(updates[1].data.lastAttemptAt, undefined);
    assert.ok(updates[1].data.completedAt instanceof Date);
    assert.equal(updates[1].data.lastErrorCode, null);
  } finally {
    restoreEmail();
    restore();
    restoreEnvironment("APP_URL", originalAppUrl);
  }
});

test("failed claimed MAGANG approval delivery records FAILED without raw exception", async () => {
  const { updates, restore } = mockDeliveryStore({
    id: "delivery-1",
    recipientEmail: "magang@example.test",
    status: "QUEUED",
    attempts: 0,
    leaseExpiresAt: null,
  });
  const restoreEmail = replaceProperty(
    MagangVerificationEmailService,
    "sendApprovalNotification",
    async () => { throw new Error("sink path /secret must not persist"); },
  );

  try {
    await MagangApprovalEmailDeliveryService.dispatch("delivery-1");

    assert.equal(updates.length, 2);
    assert.equal((updates[0].where as { id: string }).id, "delivery-1");
    assert.equal(updates[0].data.status, "PROCESSING");
    assert.deepEqual(updates[0].data.attempts, { increment: 1 });
    assert.ok(updates[0].data.lastAttemptAt instanceof Date);
    assert.equal((updates[1].where as { id: string }).id, "delivery-1");
    assert.equal(updates[1].data.status, "QUEUED");
    assert.equal(updates[1].data.attempts, undefined);
    assert.equal(updates[1].data.lastAttemptAt, undefined);
    assert.ok(updates[1].data.nextAttemptAt instanceof Date);
    assert.equal(updates[1].data.lastErrorCode, "DELIVERY_UNAVAILABLE");
    assert.ok(!JSON.stringify(updates).includes("/secret"));
  } finally {
    restoreEmail();
    restore();
  }
});

test("concurrent MAGANG dispatches make one winning sink write while loser only attempts claim", async () => {
  const { updates, restore } = mockDeliveryStore({
    id: "delivery-1",
    recipientEmail: "magang@example.test",
    status: "QUEUED",
    attempts: 0,
    leaseExpiresAt: null,
  });
  let sends = 0;
  const restoreEmail = replaceProperty(
    MagangVerificationEmailService,
    "sendApprovalNotification",
    async () => { sends += 1; return "QA_CAPTURED" as const; },
  );

  try {
    await Promise.all([
      MagangApprovalEmailDeliveryService.dispatch("delivery-1"),
      MagangApprovalEmailDeliveryService.dispatch("delivery-1"),
    ]);

    assert.equal(sends, 1);
    assert.equal(updates.length, 3);
    assert.equal((updates[0].where as { id: string }).id, "delivery-1");
    assert.equal(updates[0].data.status, "PROCESSING");
    assert.equal((updates[1].where as { id: string }).id, "delivery-1");
    assert.equal(updates[1].data.status, "PROCESSING");
    assert.equal((updates[2].where as { id: string }).id, "delivery-1");
    assert.equal(updates[2].data.status, "QA_CAPTURED");
  } finally {
    restoreEmail();
    restore();
  }
});

test("SMTP acceptance records SENT rather than QA_CAPTURED", async () => {
  const { updates, restore } = mockDeliveryStore({
    id: "delivery-smtp",
    recipientEmail: "magang@example.test",
    status: "QUEUED",
    attempts: 0,
    leaseExpiresAt: null,
  });
  const restoreEmail = replaceProperty(
    MagangVerificationEmailService,
    "sendApprovalNotification",
    async () => "SENT" as const,
  );
  try {
    await MagangApprovalEmailDeliveryService.dispatch("delivery-smtp");
    const completion = updates[updates.length - 1];
    assert.equal(completion?.data.status, "SENT");
    assert.equal(completion?.data.lastErrorCode, null);
  } finally {
    restoreEmail();
    restore();
  }
});

test("expired PROCESSING lease is reclaimable by explicit recovery scan", async () => {
  const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const expired = new Date(Date.now() - 1_000);
  let claimCount = 0;
  MagangApprovalEmailDeliveryService.setStoreForTest({
    findMany: async () => [{ id: "stale-delivery" }],
    findUnique: async () => ({
      id: "stale-delivery",
      recipientEmail: "magang@example.test",
      status: "PROCESSING",
      attempts: 1,
      leaseExpiresAt: updates[0]?.data.leaseExpiresAt as Date,
    }),
    updateMany: async (args) => {
      updates.push(args);
      if (args.data.status === "PROCESSING") return { count: claimCount++ === 0 ? 1 : 0 };
      return { count: 1 };
    },
  });
  const restoreEmail = replaceProperty(
    MagangVerificationEmailService,
    "sendApprovalNotification",
    async () => "QA_CAPTURED" as const,
  );
  try {
    await MagangApprovalEmailDeliveryService.recoverDue(new Date(expired.getTime() + 2_000));
    assert.equal(updates[0].data.status, "PROCESSING");
    assert.equal(updates[updates.length - 1]?.data.status, "QA_CAPTURED");
  } finally {
    restoreEmail();
    MagangApprovalEmailDeliveryService.setStoreForTest(null);
  }
});

test("terminal delivery failure when attempts reach MAX_ATTEMPTS transitions to FAILED and logs sanitized alert", async () => {
  const { updates, restore } = mockDeliveryStore({
    id: "delivery-max",
    recipientEmail: "magang@example.test",
    status: "QUEUED",
    attempts: 4, // Next attempt becomes 5 (MAX_ATTEMPTS)
    leaseExpiresAt: null,
  });
  const originalConsoleError = console.error;
  let loggedAlert = "";
  console.error = (...args: any[]) => {
    loggedAlert = args.join(" ");
  };
  const restoreEmail = replaceProperty(
    MagangVerificationEmailService,
    "sendApprovalNotification",
    async () => { throw new Error("permanent transport error"); },
  );

  try {
    await MagangApprovalEmailDeliveryService.dispatch("delivery-max");

    assert.equal(updates.length, 2);
    const terminalUpdate = updates[1];
    assert.equal(terminalUpdate.data.status, "FAILED");
    assert.equal(terminalUpdate.data.nextAttemptAt, null);
    assert.equal(terminalUpdate.data.lastErrorCode, "DELIVERY_UNAVAILABLE");
    assert.ok(loggedAlert.includes("[OutboxAlert] Permanent delivery failure: deliveryId=delivery-max, attempts=5"));
    assert.ok(!loggedAlert.includes("magang@example.test")); // No email logged
  } finally {
    console.error = originalConsoleError;
    restoreEmail();
    restore();
  }
});
