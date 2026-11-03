import assert from "node:assert/strict";
import test from "node:test";
import { TicketCategory, TicketPriority, TicketStatus, type Ticket } from "@prisma/client";
import prisma from "../config/database";
import { TicketQueryService } from "./ticket-query.service";
import { TicketAuthorizationError } from "./ticket-workflow.error";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

function ticket(): Ticket {
  return {
    id: "ticket-1", pcId: null, labId: "lab-1", reportedBy: "student-1", assignedTo: null,
    category: TicketCategory.CPU, title: "PC tidak menyala", description: null, photo: [],
    status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, resolutionNotes: null,
    rejectionReason: null, waitingReason: null, activeDuplicateKey: null, sourceLogbookConditionId: null, resolvedAt: null,
    createdAt: new Date("2026-10-31T00:00:00.000Z"), updatedAt: new Date("2026-10-31T00:00:00.000Z"),
  };
}

test("ticket detail permits exact reporter and staff but rejects another student", async () => {
  const current = ticket();
  const restore = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    return operation({
      user: {
        findUnique: async ({ where }: { readonly where: { readonly id: string } }) => ({
          id: where.id,
          role: where.id === "assistant-1" ? "ASISTEN_LAB" : "MAHASISWA",
          isActive: true,
        }),
      },
      ticket: { findUnique: async () => current },
    });
  });
  try {
    assert.equal((await TicketQueryService.detail("ticket-1", { userId: "student-1" })).id, "ticket-1");
    assert.equal((await TicketQueryService.detail("ticket-1", { userId: "assistant-1" })).id, "ticket-1");
    await assert.rejects(TicketQueryService.detail("ticket-1", { userId: "student-2" }), TicketAuthorizationError);
  } finally {
    restore();
  }
});
