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
  return replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => operation(client));
}

function silenceNotifications(): Restore[] {
  return [
    replace(notificationService, "notifyTicketAssigned", async () => undefined),
    replace(notificationService, "notifyTicketReporterInProgress", async () => undefined),
  ];
}

test("assignment records assign and reassign event variants", async () => {
  let current = ticket();
  const eventTypes: string[] = [];
  const tx = {
    user: {
      findUnique: async ({ where }: { readonly where: { readonly id: string } }) => {
        if (where.id === "coordinator-1") return { id: where.id, role: "KOORDINATOR_LAB", isActive: true };
        return { id: where.id, role: "ASISTEN_LAB", isActive: true };
      },
    },
    ticket: {
      findUnique: async () => current,
      updateMany: async ({ data }: { readonly data: { readonly assignedTo: string; readonly status: TicketStatus } }) => {
        current = { ...current, assignedTo: data.assignedTo, status: data.status };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: {
      create: async ({ data }: { readonly data: { readonly eventType: string } }) => {
        eventTypes.push(data.eventType);
        return { id: `event-${eventTypes.length}` };
      },
    },
  };
  const restores = [transactionWith(tx), ...silenceNotifications()];
  try {
    await TicketWorkflowService.assign("ticket-1", "assistant-1", { userId: "coordinator-1" });
    await TicketWorkflowService.assign("ticket-1", "assistant-2", { userId: "coordinator-1" });
    assert.deepEqual(eventTypes, ["ASSIGNED", "REASSIGNED"]);
  } finally {
    restoreAll(restores);
  }
});

test("ticket notifications run only after workflow transaction commits", async () => {
  let committed = false;
  let reporterNotifiedAfterCommit = false;
  let assigneeNotifiedAfterCommit = false;
  const current = ticket();
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({ ...current, status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" }),
    },
    ticketEvent: { create: async () => ({ id: "event-1" }) },
  };
  const restoreTransaction = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    const result = await operation(tx);
    committed = true;
    return result;
  });
  const restores = [
    restoreTransaction,
    replace(notificationService, "notifyTicketReporterInProgress", async () => { reporterNotifiedAfterCommit = committed; }),
    replace(notificationService, "notifyTicketAssigned", async () => { assigneeNotifiedAfterCommit = committed; }),
  ];
  try {
    await TicketWorkflowService.claim("ticket-1", { userId: "assistant-1" });
    assert.equal(reporterNotifiedAfterCommit, true);
    assert.equal(assigneeNotifiedAfterCommit, true);
  } finally {
    restoreAll(restores);
  }
});

test("waiting and resume notifications run after their transactions commit", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  let committed = false;
  let waitingNotifiedAfterCommit = false;
  let resumedNotifiedAfterCommit = false;
  const restoreTransaction = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    committed = false;
    const result = await operation({
      user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
      ticket: {
        findUnique: async () => current,
        updateMany: async ({ data }: { readonly data: { readonly status: TicketStatus; readonly waitingReason: string | null } }) => {
          current = { ...current, status: data.status, waitingReason: data.waitingReason };
          return { count: 1 };
        },
        findUniqueOrThrow: async () => current,
      },
      ticketEvent: { create: async () => ({ id: "event-1" }) },
    });
    committed = true;
    return result;
  });
  const restores = [
    restoreTransaction,
    replace(notificationService, "notifyTicketWaiting", async () => { waitingNotifiedAfterCommit = committed; }),
    replace(notificationService, "notifyTicketResumed", async () => { resumedNotifiedAfterCommit = committed; }),
  ];
  try {
    await TicketWorkflowService.transition("ticket-1", "WAITING", { userId: "assistant-1" }, "Menunggu spare part");
    await TicketWorkflowService.transition("ticket-1", "IN_PROGRESS", { userId: "assistant-1" });
    assert.equal(waitingNotifiedAfterCommit, true);
    assert.equal(resumedNotifiedAfterCommit, true);
  } finally {
    restoreAll(restores);
  }
});

test("resolve and reject notifications run after their transactions commit", async () => {
  let current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  let committed = false;
  let resolvedNotifiedAfterCommit = false;
  let rejectedNotifiedAfterCommit = false;
  const restoreTransaction = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    committed = false;
    const result = await operation({
      user: {
        findUnique: async ({ where }: { readonly where: { readonly id: string } }) => ({
          id: where.id,
          role: where.id === "coordinator-1" ? "KOORDINATOR_LAB" : "ASISTEN_LAB",
          isActive: true,
        }),
      },
      ticket: {
        findUnique: async () => current,
        updateMany: async ({ data }: { readonly data: { readonly status: TicketStatus } }) => {
          current = { ...current, status: data.status };
          return { count: 1 };
        },
        findUniqueOrThrow: async () => current,
      },
      ticketEvent: { create: async () => ({ id: "event-1" }) },
    });
    committed = true;
    return result;
  });
  const restores = [
    restoreTransaction,
    replace(notificationService, "notifyTicketResolved", async () => { resolvedNotifiedAfterCommit = committed; }),
    replace(notificationService, "notifyTicketRejected", async () => { rejectedNotifiedAfterCommit = committed; }),
  ];
  try {
    await TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }, "PSU diganti");
    current = ticket();
    await TicketWorkflowService.reject("ticket-1", { userId: "coordinator-1" }, "Laporan duplikat");
    assert.equal(resolvedNotifiedAfterCommit, true);
    assert.equal(rejectedNotifiedAfterCommit, true);
  } finally {
    restoreAll(restores);
  }
});
