import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { AccessRequestService } from "./access-request.service";
import { MagangApprovalEmailDeliveryService } from "./magang-approval-email-delivery.service";

type MagangRequestRow = {
  id: string;
  type: string;
  status: string;
  userId: string | null;
  applicantEmail: string;
  emailVerifiedAt: Date | null;
};

type MagangReviewTransaction = {
  $queryRaw: <T>() => Promise<T>;
  accessRequest: {
    update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  user: {
    findUnique: () => Promise<{ id: string; email: string; role: string; isActive: boolean } | null>;
    updateMany: () => Promise<{ count: number }>;
  };
  notification: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  magangApprovalEmailDelivery: {
    create: (args: { data: { accessRequestId: string; recipientEmail: string } }) => Promise<{ id: string }>;
  };
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

function lockedMagangRequest(emailVerifiedAt: Date | null): MagangRequestRow {
  return {
    id: "request-1",
    type: "MAGANG",
    status: "PENDING",
    userId: "magang-1",
    applicantEmail: "magang@example.test",
    emailVerifiedAt,
  };
}

function restoreMagangReviewMocks(
  request: MagangRequestRow,
  transaction: MagangReviewTransaction,
  onCommit?: () => void,
): () => void {
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => ({
    id: request.id,
    type: request.type,
  }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (callback: (tx: MagangReviewTransaction) => Promise<unknown>) => {
      const result = await callback(transaction);
      onCommit?.();
      return result;
    },
  );

  return () => {
    restoreTransaction();
    restoreRequest();
  };
}

test("verified MAGANG approval atomically queues one approval email after activation, request, and notification", async () => {
  const writes: string[] = [];
  let notificationData: Record<string, unknown> | undefined;
  let deliveryData: { accessRequestId: string; recipientEmail: string } | undefined;
  let dispatchedDeliveryId: string | undefined;
  let transactionCommitted = false;
  let queryCount = 0;
  const tx: MagangReviewTransaction = {
    $queryRaw: async <T>() => {
      queryCount += 1;
      if (queryCount === 1) return [lockedMagangRequest(new Date("2026-10-13T00:00:00.000Z"))] as T;

      return [{
        id: "verification-1",
        tokenHash: "hash",
        expiresAt: new Date("2026-10-14T00:00:00.000Z"),
        consumedAt: new Date("2026-10-13T00:00:00.000Z"),
        userId: "magang-1",
        accessRequestId: "request-1",
        requestType: "MAGANG",
        requestUserId: "magang-1",
        emailVerifiedAt: new Date("2026-10-13T00:00:00.000Z"),
      }] as T;
    },
    accessRequest: {
      update: async ({ data }) => {
        writes.push("request");
        return { id: "request-1", ...data };
      },
    },
    user: {
      findUnique: async () => ({
        id: "magang-1",
        email: "magang@example.test",
        role: "MAGANG",
        isActive: false,
      }),
      updateMany: async () => {
        writes.push("activation");
        return { count: 1 };
      },
    },
    notification: {
      create: async ({ data }) => {
        writes.push("notification");
        notificationData = data;
        return data;
      },
    },
    magangApprovalEmailDelivery: {
      create: async ({ data }) => {
        writes.push("delivery");
        deliveryData = data;
        return { id: "delivery-1" };
      },
    },
  };
  const restore = restoreMagangReviewMocks(
    lockedMagangRequest(new Date("2026-10-13T00:00:00.000Z")),
    tx,
    () => { transactionCommitted = true; },
  );
  const restoreDispatch = replaceProperty(
    MagangApprovalEmailDeliveryService,
    "dispatch",
    async (deliveryId: string) => {
      assert.equal(transactionCommitted, true);
      dispatchedDeliveryId = deliveryId;
    },
  );

  try {
    await AccessRequestService.reviewRequest("request-1", "coordinator-1", { status: "APPROVED" });

    assert.deepEqual(writes, ["activation", "request", "notification", "delivery"]);
    assert.deepEqual(notificationData, {
      userId: "magang-1",
      type: "SYSTEM",
      title: "Akun MAGANG Aktif",
      message: "Akun MAGANG Anda telah aktif dan dapat login.",
    });
    assert.deepEqual(deliveryData, {
      accessRequestId: "request-1",
      recipientEmail: "magang@example.test",
    });
    assert.equal(dispatchedDeliveryId, "delivery-1");
  } finally {
    restoreDispatch();
    restore();
  }
});

test("MAGANG dispatcher failure leaves activation, request, notification, and queue committed", async () => {
  const writes: string[] = [];
  let transactionCommitted = false;
  let approvalEmailAttempts = 0;
  let queryCount = 0;
  const tx: MagangReviewTransaction = {
    $queryRaw: async <T>() => {
      queryCount += 1;
      if (queryCount === 1) return [lockedMagangRequest(new Date("2026-10-13T00:00:00.000Z"))] as T;

      return [{
        id: "verification-1",
        tokenHash: "hash",
        expiresAt: new Date("2026-10-14T00:00:00.000Z"),
        consumedAt: new Date("2026-10-13T00:00:00.000Z"),
        userId: "magang-1",
        accessRequestId: "request-1",
        requestType: "MAGANG",
        requestUserId: "magang-1",
        emailVerifiedAt: new Date("2026-10-13T00:00:00.000Z"),
      }] as T;
    },
    accessRequest: {
      update: async ({ data }) => {
        writes.push("request");
        return { id: "request-1", ...data };
      },
    },
    user: {
      findUnique: async () => ({
        id: "magang-1",
        email: "magang@example.test",
        role: "MAGANG",
        isActive: false,
      }),
      updateMany: async () => {
        writes.push("activation");
        return { count: 1 };
      },
    },
    notification: {
      create: async ({ data }) => {
        writes.push("notification");
        return data;
      },
    },
    magangApprovalEmailDelivery: {
      create: async () => {
        writes.push("delivery");
        return { id: "delivery-1" };
      },
    },
  };
  const restore = restoreMagangReviewMocks(
    lockedMagangRequest(new Date("2026-10-13T00:00:00.000Z")),
    tx,
    () => { transactionCommitted = true; },
  );
  const restoreDispatch = replaceProperty(
    MagangApprovalEmailDeliveryService,
    "dispatch",
    async () => {
      approvalEmailAttempts += 1;
      assert.equal(transactionCommitted, true);
      throw new Error("QA email sink unavailable");
    },
  );

  try {
    const result = await AccessRequestService.reviewRequest("request-1", "coordinator-1", { status: "APPROVED" });

    assert.ok(result);
    assert.equal(result.status, "APPROVED");
    assert.equal(transactionCommitted, true);
    assert.equal(approvalEmailAttempts, 1);
    assert.deepEqual(writes, ["activation", "request", "notification", "delivery"]);
  } finally {
    restoreDispatch();
    restore();
  }
});

test("MAGANG rejection persists no notification, queue, or dispatcher call", async () => {
  let notificationCreates = 0;
  let dispatches = 0;
  const tx: MagangReviewTransaction = {
    $queryRaw: async <T>() => [lockedMagangRequest(null)] as T,
    accessRequest: {
      update: async ({ data }) => ({ id: "request-1", ...data }),
    },
    user: {
      findUnique: async () => {
        throw new Error("rejection must not read MAGANG user");
      },
      updateMany: async () => {
        throw new Error("rejection must not activate MAGANG user");
      },
    },
    notification: {
      create: async () => {
        notificationCreates += 1;
        throw new Error("rejection must not notify MAGANG user");
      },
    },
    magangApprovalEmailDelivery: {
      create: async () => {
        throw new Error("rejection must not queue approval email");
      },
    },
  };
  const restore = restoreMagangReviewMocks(lockedMagangRequest(null), tx);
  const restoreDispatch = replaceProperty(
    MagangApprovalEmailDeliveryService,
    "dispatch",
    async () => { dispatches += 1; },
  );

  try {
    await AccessRequestService.reviewRequest("request-1", "coordinator-1", {
      status: "REJECTED",
      reviewerNotes: "Tidak memenuhi syarat.",
    });

    assert.equal(notificationCreates, 0);
    assert.equal(dispatches, 0);
  } finally {
    restoreDispatch();
    restore();
  }
});

test("PEMINJAMAN_LAB rejection does not queue or dispatch MAGANG approval email", async () => {
  let dispatches = 0;
  const restoreRequest = replaceProperty(prisma.accessRequest, "findUnique", async () => ({
    id: "booking-request-1",
    type: "PEMINJAMAN_LAB",
    status: "PENDING",
  }));
  const restoreUpdate = replaceProperty(prisma.accessRequest, "update", async () => ({
    id: "booking-request-1",
    status: "REJECTED",
  }));
  const restoreDispatch = replaceProperty(
    MagangApprovalEmailDeliveryService,
    "dispatch",
    async () => { dispatches += 1; },
  );

  try {
    await AccessRequestService.reviewRequest("booking-request-1", "coordinator-1", {
      status: "REJECTED",
      reviewerNotes: "Tidak memenuhi syarat.",
    });

    assert.equal(dispatches, 0);
  } finally {
    restoreDispatch();
    restoreUpdate();
    restoreRequest();
  }
});

test("unverified MAGANG approval persists no notification", async () => {
  let requestUpdates = 0;
  let activations = 0;
  let notificationCreates = 0;
  const tx: MagangReviewTransaction = {
    $queryRaw: async <T>() => [lockedMagangRequest(null)] as T,
    accessRequest: {
      update: async () => {
        requestUpdates += 1;
        return { id: "request-1" };
      },
    },
    user: {
      findUnique: async () => {
        throw new Error("unverified request must not read MAGANG user");
      },
      updateMany: async () => {
        activations += 1;
        return { count: 1 };
      },
    },
    notification: {
      create: async () => {
        notificationCreates += 1;
        return {};
      },
    },
    magangApprovalEmailDelivery: {
      create: async () => {
        throw new Error("unverified request must not queue approval email");
      },
    },
  };
  const restore = restoreMagangReviewMocks(lockedMagangRequest(null), tx);

  try {
    await assert.rejects(
      AccessRequestService.reviewRequest("request-1", "coordinator-1", { status: "APPROVED" }),
      /belum menyelesaikan verifikasi email/,
    );

    assert.equal(requestUpdates, 0);
    assert.equal(activations, 0);
    assert.equal(notificationCreates, 0);
  } finally {
    restore();
  }
});
