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

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1", pcId: null, labId: "lab-1", reportedBy: "student-1", assignedTo: "assistant-1",
    category: TicketCategory.CPU, title: "PC tidak menyala", description: "Laporan awal", photo: [],
    status: TicketStatus.IN_PROGRESS, priority: TicketPriority.MEDIUM, resolutionNotes: null,
    rejectionReason: null, waitingReason: null, activeDuplicateKey: null, sourceLogbookConditionId: null, resolvedAt: null,
    createdAt: new Date("2026-10-31T00:00:00.000Z"), updatedAt: new Date("2026-10-31T00:00:00.000Z"),
    ...overrides,
  };
}

test("resolve rolls back structured resolution when event append fails", async () => {
  let committed = ticket();
  const restoreTransaction = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    let staged = committed;
    const result = await operation({
      user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
      ticket: {
        findUnique: async () => staged,
        updateMany: async () => {
          staged = { ...staged, status: TicketStatus.RESOLVED, resolutionNotes: "PSU diganti" };
          return { count: 1 };
        },
        findUniqueOrThrow: async () => staged,
      },
      ticketEvent: { create: async () => { throw new Error("event write failed"); } },
    });
    committed = staged;
    return result;
  });
  const restoreNotification = replace(notificationService, "notifyTicketResolved", async () => undefined);
  try {
    await assert.rejects(
      TicketWorkflowService.resolve("ticket-1", { userId: "assistant-1" }, "PSU diganti"),
      /event write failed/,
    );
    assert.equal(committed.status, TicketStatus.IN_PROGRESS);
    assert.equal(committed.resolutionNotes, null);
  } finally {
    restoreNotification();
    restoreTransaction();
  }
});
