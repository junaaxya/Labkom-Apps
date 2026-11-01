import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, TicketPriority, TicketStatus, TicketCategory, type Ticket } from "@prisma/client";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { TicketWorkflowService } from "./ticket-workflow.service";
import { TicketAuthorizationError, TicketConflictError } from "./ticket-workflow.error";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

function restoreAll(restores: Restore[]): void {
  for (const restore of restores.reverse()) restore();
}

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1",
    pcId: "pc-1",
    labId: "lab-1",
    reportedBy: "student-1",
    assignedTo: null,
    category: TicketCategory.CPU,
    title: "PC tidak menyala",
    description: null,
    photo: [],
    status: TicketStatus.OPEN,
    priority: TicketPriority.MEDIUM,
    resolutionNotes: null,
    rejectionReason: null,
    waitingReason: null,
    activeDuplicateKey: null,
    sourceLogbookConditionId: null,
    resolvedAt: null,
    createdAt: new Date("2026-10-31T00:00:00.000Z"),
    updatedAt: new Date("2026-10-31T00:00:00.000Z"),
    ...overrides,
  };
}

function transactionWith(client: object): Restore {
  return replace(
    prisma,
    "$transaction",
    async (operation: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
      const transactionClient = Object.assign({
        ticketEvent: { create: async () => ({ id: "event-1" }) },
      }, client);
      return operation(transactionClient);
    },
  );
}

function silenceNotifications(): Restore[] {
  return [
    replace(notificationService, "notifyTicketAssigned", async () => undefined),
    replace(notificationService, "notifyTicketReporterInProgress", async () => undefined),
    replace(notificationService, "notifyTicketWaiting", async () => undefined),
    replace(notificationService, "notifyTicketResumed", async () => undefined),
    replace(notificationService, "notifyTicketResolved", async () => undefined),
    replace(notificationService, "notifyTicketRejected", async () => undefined),
  ];
}

test("double claim atomically lets only one assistant win", async () => {
  let current = ticket();
  const tx = {
    user: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => {
        if (current.status !== TicketStatus.OPEN || current.assignedTo !== null) return { count: 0 };
        current = { ...current, assignedTo: "assistant-1", status: TicketStatus.IN_PROGRESS };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const claimed = await TicketWorkflowService.claim("ticket-1", { userId: "assistant-1" });
    assert.equal(claimed.assignedTo, "assistant-1");
    await assert.rejects(
      TicketWorkflowService.claim("ticket-1", { userId: "assistant-2" }),
      (error) => error instanceof TicketConflictError && /tidak tersedia/.test(error.message),
    );
  } finally {
    restoreAll(restores);
  }
});

test("terminal tickets are immutable for assignment and status changes", async () => {
  for (const status of [TicketStatus.RESOLVED, TicketStatus.REJECTED]) {
    const current = ticket({ status, assignedTo: "assistant-1" });
    const tx = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          role: where.id === "coordinator-1" ? "KOORDINATOR_LAB" : "ASISTEN_LAB",
          isActive: true,
        }),
      },
      ticket: { findUnique: async () => current },
    };
    const restores = [transactionWith(tx), ...silenceNotifications()];
    try {
      await assert.rejects(
        TicketWorkflowService.assign("ticket-1", "assistant-2", { userId: "coordinator-1" }),
        TicketConflictError,
      );
      await assert.rejects(
        TicketWorkflowService.transition("ticket-1", "WAITING", { userId: "coordinator-1" }, "Menunggu komponen"),
        TicketConflictError,
      );
    } finally {
      restoreAll(restores);
    }
  }
});

test("coordinator assignment rejects inactive or non-assistant assignee", async () => {
  for (const assignee of [
    { id: "assistant-1", role: "ASISTEN_LAB", isActive: false },
    { id: "student-1", role: "MAHASISWA", isActive: true },
  ]) {
    const tx = {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => where.id === "coordinator-1"
          ? { id: where.id, role: "KOORDINATOR_LAB", isActive: true }
          : assignee,
      },
    };
    const restore = transactionWith(tx);
    try {
      await assert.rejects(
        TicketWorkflowService.assign("ticket-1", assignee.id, { userId: "coordinator-1" }),
        /Asisten Lab aktif tidak ditemukan/,
      );
    } finally {
      restore();
    }
  }
});

test("assistant cannot resolve a ticket assigned to another assistant", async () => {
  const current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-2" });
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: { findUnique: async () => current },
  };
  const restore = transactionWith(tx);
  try {
    await assert.rejects(
      TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }),
      TicketAuthorizationError,
    );
  } finally {
    restore();
  }
});

test("resolving one of multiple active PC tickets keeps the PC broken", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  let pcWrites = 0;
  let statusLogs = 0;
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => {
        current = { ...current, status: TicketStatus.RESOLVED, resolvedAt: new Date() };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
      count: async () => 1,
    },
    pC: {
      findUnique: async () => ({ id: "pc-1", status: "BROKEN" }),
      updateMany: async () => { pcWrites += 1; return { count: 1 }; },
    },
    pCStatusLog: { create: async () => { statusLogs += 1; } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    await TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" });
    assert.equal(pcWrites, 0);
    assert.equal(statusLogs, 0);
  } finally {
    restoreAll(restores);
  }
});

test("last active ticket restores only a broken PC and records one status log", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  const logs: unknown[] = [];
  let restoredWhere: unknown;
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => {
        current = { ...current, status: TicketStatus.RESOLVED, resolvedAt: new Date() };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
      count: async () => 0,
    },
    pC: {
      findUnique: async () => ({ id: "pc-1", status: "BROKEN" }),
      updateMany: async ({ where }: { where: unknown }) => { restoredWhere = where; return { count: 1 }; },
    },
    pCStatusLog: { create: async ({ data }: { data: unknown }) => { logs.push(data); } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    await TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" });
    assert.deepEqual(restoredWhere, { id: "pc-1", status: "BROKEN" });
    assert.deepEqual(logs, [{
      pcId: "pc-1",
      fromStatus: "BROKEN",
      toStatus: "AVAILABLE",
      reason: "Semua ticket aktif pada PC telah ditutup",
      changedBy: "assistant-1",
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("concurrent resolve has one winner and one conflict", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1", pcId: null });
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async ({ where }: { where: { status?: TicketStatus } }) => {
        if (current.status !== where.status) return { count: 0 };
        current = { ...current, status: TicketStatus.RESOLVED, resolvedAt: new Date() };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const results = await Promise.allSettled([
      TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }),
      TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }),
    ]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  } finally {
    restoreAll(restores);
  }
});

test("transaction failure after ticket update does not commit partial state", async () => {
  const initial = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  let committed = initial;
  const restoreTransaction = replace(
    prisma,
    "$transaction",
    async (operation: (tx: unknown) => Promise<unknown>) => {
      let staged = committed;
      const tx = {
        user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
        ticket: {
          findUnique: async () => staged,
          updateMany: async () => { staged = { ...staged, status: TicketStatus.RESOLVED }; return { count: 1 }; },
          findUniqueOrThrow: async () => staged,
          count: async () => 0,
        },
        ticketEvent: { create: async () => ({ id: "event-1" }) },
        pC: {
          findUnique: async () => ({ id: "pc-1", status: "BROKEN" }),
          updateMany: async () => ({ count: 1 }),
        },
        pCStatusLog: { create: async () => { throw new Error("status log write failed"); } },
      };
      const result = await operation(tx);
      committed = staged;
      return result;
    },
  );
  try {
    await assert.rejects(
      TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }),
      /status log write failed/,
    );
    assert.equal(committed.status, TicketStatus.IN_PROGRESS);
  } finally {
    restoreTransaction();
  }
});

test("serialization failures are retried before claim succeeds", async () => {
  let attempts = 0;
  let current = ticket();
  const restoreTransaction = replace(
    prisma,
    "$transaction",
    async (operation: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
      attempts += 1;
      if (attempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError("serialization", { code: "P2034", clientVersion: "test" });
      }
      const tx = {
        user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
        ticket: {
          findUnique: async () => current,
          updateMany: async () => { current = { ...current, status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" }; return { count: 1 }; },
          findUniqueOrThrow: async () => current,
        },
        ticketEvent: { create: async () => ({ id: "event-1" }) },
      };
      return operation(tx);
    },
  );
  const restores = [restoreTransaction, ...silenceNotifications()];
  try {
    const result = await TicketWorkflowService.claim("ticket-1", { userId: "assistant-1" });
    assert.equal(attempts, 2);
    assert.equal(result.status, TicketStatus.IN_PROGRESS);
  } finally {
    restoreAll(restores);
  }
});
