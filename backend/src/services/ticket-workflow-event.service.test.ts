import assert from "node:assert/strict";
import test from "node:test";
import { TicketCategory, TicketPriority, TicketStatus, type Ticket } from "@prisma/client";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { TicketWorkflowService } from "./ticket-workflow.service";

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
    id: "ticket-1", pcId: null, labId: "lab-1", reportedBy: "student-1", assignedTo: null,
    category: TicketCategory.CPU, title: "PC tidak menyala", description: "Laporan awal", photo: [],
    status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, resolutionNotes: null,
    rejectionReason: null, waitingReason: null, activeDuplicateKey: null, sourceLogbookConditionId: null, resolvedAt: null,
    createdAt: new Date("2026-10-31T00:00:00.000Z"), updatedAt: new Date("2026-10-31T00:00:00.000Z"),
    ...overrides,
  };
}

function transactionWith(client: object): Restore {
  return replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    return operation(client);
  });
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

test("claim writes assignment and claimed event together", async () => {
  let current = ticket();
  const events: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => {
        current = { ...current, status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const claimed = await TicketWorkflowService.claim("ticket-1", { userId: "assistant-1" });
    assert.equal(claimed.status, TicketStatus.IN_PROGRESS);
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "assistant-1", eventType: "CLAIMED",
      fromStatus: "OPEN", toStatus: "IN_PROGRESS", fromAssigneeId: null,
      toAssigneeId: "assistant-1", note: null,
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("claim rolls back state when event append fails", async () => {
  let committed = ticket();
  const restore = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    let staged = committed;
    const tx = {
      user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
      ticket: {
        findUnique: async () => staged,
        updateMany: async () => { staged = { ...staged, status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" }; return { count: 1 }; },
        findUniqueOrThrow: async () => staged,
      },
      ticketEvent: { create: async () => { throw new Error("event write failed"); } },
    };
    const result = await operation(tx);
    committed = staged;
    return result;
  });
  try {
    await assert.rejects(TicketWorkflowService.claim("ticket-1", { userId: "assistant-1" }), /event write failed/);
    assert.equal(committed.status, TicketStatus.OPEN);
    assert.equal(committed.assignedTo, null);
  } finally {
    restore();
  }
});

test("waiting transition persists reason and event", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  const events: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => { current = { ...current, status: TicketStatus.WAITING, waitingReason: "Menunggu spare part" }; return { count: 1 }; },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const waiting = await TicketWorkflowService.transition("ticket-1", "WAITING", { userId: "assistant-1" }, "Menunggu spare part");
    assert.equal(waiting.waitingReason, "Menunggu spare part");
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "assistant-1", eventType: "WAITING",
      fromStatus: "IN_PROGRESS", toStatus: "WAITING", fromAssigneeId: "assistant-1",
      toAssigneeId: "assistant-1", note: "Menunggu spare part",
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("resume clears current waiting reason and keeps it in history", async () => {
  let current = ticket({
    status: TicketStatus.WAITING,
    assignedTo: "assistant-1",
    waitingReason: "Menunggu spare part",
  });
  const events: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => { current = { ...current, status: TicketStatus.IN_PROGRESS, waitingReason: null }; return { count: 1 }; },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const resumed = await TicketWorkflowService.transition("ticket-1", "IN_PROGRESS", { userId: "assistant-1" });
    assert.equal(resumed.waitingReason, null);
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "assistant-1", eventType: "RESUMED",
      fromStatus: "WAITING", toStatus: "IN_PROGRESS", fromAssigneeId: "assistant-1",
      toAssigneeId: "assistant-1", note: "Menunggu spare part",
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("resolve stores resolution notes without changing description", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  const events: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => {
        current = {
          ...current,
          status: TicketStatus.RESOLVED,
          resolutionNotes: "PSU diganti",
          resolvedAt: new Date(),
        };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const resolved = await TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }, "PSU diganti");
    assert.equal(resolved.description, "Laporan awal");
    assert.equal(resolved.resolutionNotes, "PSU diganti");
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "assistant-1", eventType: "RESOLVED",
      fromStatus: "IN_PROGRESS", toStatus: "RESOLVED", fromAssigneeId: "assistant-1",
      toAssigneeId: "assistant-1", note: "PSU diganti",
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("reject stores rejection reason without changing description", async () => {
  let current = ticket();
  const events: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "coordinator-1", role: "KOORDINATOR_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => {
        current = { ...current, status: TicketStatus.REJECTED, rejectionReason: "Laporan duplikat" };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    const rejected = await TicketWorkflowService.reject("ticket-1", { userId: "coordinator-1" }, "Laporan duplikat");
    assert.equal(rejected.description, "Laporan awal");
    assert.equal(rejected.rejectionReason, "Laporan duplikat");
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "coordinator-1", eventType: "REJECTED",
      fromStatus: "OPEN", toStatus: "REJECTED", fromAssigneeId: null,
      toAssigneeId: null, note: "Laporan duplikat",
    }]);
  } finally {
    restoreAll(restores);
  }
});
