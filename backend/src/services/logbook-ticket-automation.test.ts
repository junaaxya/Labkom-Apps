import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { LogbookService } from "./logbook.service";
import { TicketService } from "./ticket.service";
import { TicketDuplicateError } from "./ticket-workflow.error";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

function baseMocks(attempts: unknown[]): Restore[] {
  return [
    replace(prisma.logbook, "findUnique", async () => ({ id: "logbook-1", status: "CHECKED_IN", labId: "lab-1" })),
    replace(prisma.lab, "findUnique", async () => ({ id: "lab-1" })),
    replace(prisma.logbookCondition, "upsert", async () => ({ id: "condition-1", logbookId: "logbook-1", labId: "lab-1" })),
    replace(prisma.logbookTicketAutomationAttempt, "create", async ({ data }: { readonly data: unknown }) => {
      attempts.push(data);
      return { id: `attempt-${attempts.length}`, ...data as object };
    }),
  ];
}

test("logbook damage records a created ticket attempt", async () => {
  const attempts: unknown[] = [];
  const restores = [
    ...baseMocks(attempts),
    replace(TicketService, "createTicket", async (input: { readonly sourceLogbookConditionId?: string }) => {
      assert.equal(input.sourceLogbookConditionId, "condition-1");
      return { id: "ticket-1" };
    }),
  ];
  try {
    const result = await LogbookService.submitCondition("logbook-1", "lab-1", "assistant-1", "ASISTEN_LAB", {
      fotoBukti: ["photo"], kerusakanBaru: "Monitor mati",
    });
    assert.deepEqual(result.ticketAutomation, {
      status: "CREATED", ticketId: "ticket-1", message: "Ticket kerusakan berhasil dibuat.",
    });
    assert.deepEqual(attempts, [{ logbookConditionId: "condition-1", ticketId: "ticket-1", status: "CREATED" }]);
  } finally { restores.reverse().forEach((restore) => restore()); }
});

test("logbook duplicate records the existing ticket without false success", async () => {
  const attempts: unknown[] = [];
  const existing = { id: "ticket-1", status: "OPEN", createdAt: new Date(), reportedBy: "student-1" };
  const restores = [
    ...baseMocks(attempts),
    replace(TicketService, "createTicket", async () => { throw new TicketDuplicateError(existing); }),
  ];
  try {
    const result = await LogbookService.submitCondition("logbook-1", "lab-1", "assistant-1", "ASISTEN_LAB", {
      fotoBukti: ["photo"], kerusakanBaru: "Monitor mati",
    });
    assert.equal(result.ticketAutomation?.status, "DUPLICATE");
    assert.equal(result.ticketAutomation?.ticketId, "ticket-1");
    assert.deepEqual(attempts, [{
      logbookConditionId: "condition-1", ticketId: "ticket-1", status: "DUPLICATE",
      errorCode: "ACTIVE_DUPLICATE", errorMessage: "Ticket aktif yang sama sudah tersedia.",
    }]);
  } finally { restores.reverse().forEach((restore) => restore()); }
});

test("logbook automation failure is persisted and returned explicitly", async () => {
  const attempts: unknown[] = [];
  const restores = [
    ...baseMocks(attempts),
    replace(TicketService, "createTicket", async () => { throw new Error("mission unavailable"); }),
  ];
  try {
    const result = await LogbookService.submitCondition("logbook-1", "lab-1", "assistant-1", "ASISTEN_LAB", {
      fotoBukti: ["photo"], kerusakanBaru: "Monitor mati",
    });
    assert.equal(result.ticketAutomation?.status, "FAILED");
    assert.match(result.ticketAutomation?.message ?? "", /ticket gagal dibuat/i);
    assert.deepEqual(attempts, [{
      logbookConditionId: "condition-1", ticketId: undefined, status: "FAILED",
      errorCode: "TICKET_CREATE_FAILED", errorMessage: "Ticket otomatis gagal dibuat.",
    }]);
  } finally { restores.reverse().forEach((restore) => restore()); }
});

test("coordinator monitoring returns safe automation messages and pagination", async () => {
  const restores = [
    replace(prisma.logbookTicketAutomationAttempt, "findMany", async () => [{
      id: "attempt-1",
      status: "FAILED",
      errorCode: "TICKET_CREATE_FAILED",
      errorMessage: "raw database failure detail",
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
      ticket: null,
      logbookCondition: {
        id: "condition-1",
        kerusakanBaru: "Monitor mati",
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        lab: { id: "lab-1", name: "Lab Dasar" },
        submittedBy: { id: "assistant-1", name: "Asisten" },
        logbook: { id: "logbook-1", date: new Date("2026-11-01T00:00:00.000Z") },
      },
    }]),
    replace(prisma.logbookTicketAutomationAttempt, "count", async () => 1),
  ];
  try {
    const result = await LogbookService.getTicketAutomationAttempts({ status: "FAILED", page: 1, limit: 20 });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.errorCode, "TICKET_CREATE_FAILED");
    assert.equal(result.items[0]?.message, "Ticket otomatis gagal dibuat. Tinjau kondisi dan buat ticket manual bila diperlukan.");
    assert.equal(JSON.stringify(result).includes("raw database failure detail"), false);
    assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 1, totalPages: 1 });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("blank damage does not create ticket automation attempts", async () => {
  const attempts: unknown[] = [];
  let ticketCalls = 0;
  const restores = [
    ...baseMocks(attempts),
    replace(TicketService, "createTicket", async () => { ticketCalls += 1; return { id: "ticket-1" }; }),
  ];
  try {
    const result = await LogbookService.submitCondition("logbook-1", "lab-1", "assistant-1", "ASISTEN_LAB", {
      fotoBukti: ["photo"], kerusakanBaru: "   ",
    });
    assert.equal(result.ticketAutomation, null);
    assert.equal(ticketCalls, 0);
    assert.deepEqual(attempts, []);
  } finally { restores.reverse().forEach((restore) => restore()); }
});
