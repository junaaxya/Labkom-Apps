import assert from "node:assert/strict";
import test from "node:test";
import { TicketCategory, TicketPriority, TicketStatus, type Ticket } from "@prisma/client";
import prisma from "../config/database";
import { TicketOperationHistoryService } from "./ticket-operation-history.service";
import { TicketAuthorizationError } from "./ticket-workflow.error";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
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

test("repair action appends history without mutating ticket", async () => {
  const current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  const events: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ id: "assistant-1", role: "ASISTEN_LAB", isActive: true }) },
    ticket: { findUnique: async () => current, findUniqueOrThrow: async () => current },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restore = transactionWith(tx);
  try {
    const result = await TicketOperationHistoryService.addAction("ticket-1", "Ganti kabel daya", { userId: "assistant-1" });
    assert.equal(result.description, "Laporan awal");
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "assistant-1", eventType: "REPAIR_ACTION",
      fromStatus: "IN_PROGRESS", toStatus: "IN_PROGRESS", fromAssigneeId: "assistant-1",
      toAssigneeId: "assistant-1", note: "Ganti kabel daya",
    }]);
  } finally {
    restore();
  }
});

test("history allows exact reporter and rejects other students", async () => {
  const current = ticket();
  const history = [{ id: "event-1", eventType: "CREATED" }];
  const tx = {
    user: {
      findUnique: async ({ where }: { readonly where: { readonly id: string } }) => ({
        id: where.id, role: "MAHASISWA", isActive: true,
      }),
    },
    ticket: { findUnique: async () => current },
    ticketEvent: { findMany: async () => history },
  };
  const restore = transactionWith(tx);
  try {
    assert.deepEqual(await TicketOperationHistoryService.history("ticket-1", { userId: "student-1" }), history);
    await assert.rejects(TicketOperationHistoryService.history("ticket-1", { userId: "student-2" }), TicketAuthorizationError);
  } finally {
    restore();
  }
});

test("history allows staff and repair action requires assignment or coordinator", async () => {
  const current = ticket({ status: TicketStatus.IN_PROGRESS, assignedTo: "assistant-1" });
  const events: unknown[] = [];
  const history = [{ id: "event-1", eventType: "CREATED" }];
  const tx = {
    user: {
      findUnique: async ({ where }: { readonly where: { readonly id: string } }) => ({
        id: where.id,
        role: where.id === "coordinator-1" ? "KOORDINATOR_LAB" : "ASISTEN_LAB",
        isActive: true,
      }),
    },
    ticket: { findUnique: async () => current, findUniqueOrThrow: async () => current },
    ticketEvent: {
      findMany: async () => history,
      create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-2" }; },
    },
  };
  const restore = transactionWith(tx);
  try {
    assert.deepEqual(await TicketOperationHistoryService.history("ticket-1", { userId: "assistant-2" }), history);
    await assert.rejects(
      TicketOperationHistoryService.addAction("ticket-1", "Cek kabel", { userId: "assistant-2" }),
      TicketAuthorizationError,
    );
    await TicketOperationHistoryService.addAction("ticket-1", "Cek kabel", { userId: "coordinator-1" });
    assert.equal(events.length, 1);
  } finally {
    restore();
  }
});
