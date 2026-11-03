import assert from "node:assert/strict";
import test from "node:test";
import { TicketController } from "./ticket.controller";
import { TicketService } from "../services/ticket.service";
import {
  TicketAuthorizationError,
  TicketConflictError,
  TicketDuplicateError,
  TicketNotFoundError,
} from "../services/ticket-workflow.error";

type Result = { status?: number; body?: unknown };

type TestResponse = {
  status(code: number): TestResponse;
  json(body: unknown): TestResponse;
};

function response(result: Result): TestResponse {
  return {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  };
}

function request(body: unknown = {}) {
  return {
    params: { id: "ticket-1" },
    body,
    user: { userId: "assistant-1", role: "ASISTEN_LAB" },
  };
}

async function invoke(
  handler: Function,
  req: ReturnType<typeof request>,
  res: TestResponse
): Promise<void> {
  await Reflect.apply(handler, TicketController, [req, res]);
}

function replace(target: object, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("claim controller maps race loss to HTTP 409", async () => {
  const result: Result = {};
  const restore = replace(TicketService, "claimTicket", async () => {
    throw new TicketConflictError("Ticket tidak tersedia untuk diambil.");
  });
  try {
    await invoke(TicketController.claimTicket, request(), response(result));
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { success: false, message: "Ticket tidak tersedia untuk diambil." });
  } finally {
    restore();
  }
});

test("transition controller rejects an invalid state payload with HTTP 400", async () => {
  const result: Result = {};
  await invoke(TicketController.transitionTicket, request({ status: "RESOLVED" }), response(result));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { success: false, message: "Validasi gagal" });
});

test("transition controller requires a waiting reason", async () => {
  const result: Result = {};
  await invoke(TicketController.transitionTicket, request({ status: "WAITING" }), response(result));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { success: false, message: "Validasi gagal" });
});

test("history controller maps service authorization and missing ticket errors", async () => {
  const forbidden: Result = {};
  const missing: Result = {};
  const restore = replace(TicketService, "getTicketHistory", async (ticketId: string) => {
    if (ticketId === "ticket-1") throw new TicketAuthorizationError("Anda tidak memiliki akses ke ticket ini.");
    throw new TicketNotFoundError("Ticket tidak ditemukan");
  });
  try {
    await invoke(TicketController.getTicketHistory, request(), response(forbidden));
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, { success: false, message: "Anda tidak memiliki akses ke ticket ini." });

    const missingRequest = request();
    missingRequest.params.id = "ticket-2";
    await invoke(TicketController.getTicketHistory, missingRequest, response(missing));
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { success: false, message: "Ticket tidak ditemukan" });
  } finally {
    restore();
  }
});

test("reporter update controller maps CAS loss to HTTP 409", async () => {
  const result: Result = {};
  const restore = replace(TicketService, "updateTicket", async () => {
    throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
  });
  try {
    await invoke(TicketController.updateTicket, request({ title: "PC mati total" }), response(result));
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { success: false, message: "Ticket berubah oleh proses lain. Silakan coba lagi." });
  } finally {
    restore();
  }
});

test("workflow controller hides unexpected failures behind HTTP 500", async () => {
  const result: Result = {};
  const restore = replace(TicketService, "claimTicket", async () => {
    throw new Error("database connection details");
  });
  try {
    await invoke(TicketController.claimTicket, request(), response(result));
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { success: false, message: "Operasi ticket gagal" });
  } finally {
    restore();
  }
});

test("duplicate response exposes ticket link only to staff or exact reporter", async () => {
  const existing = {
    id: "ticket-existing",
    status: "OPEN",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    reportedBy: "student-owner",
  };
  const restore = replace(TicketService, "createTicket", async () => { throw new TicketDuplicateError(existing); });
  try {
    const validCreateBody = { labId: "lab-1", category: "CPU", title: "PC mati total" };
    const unrelated = request(validCreateBody);
    unrelated.user = { userId: "student-other", role: "MAHASISWA" };
    const hidden: Result = {};
    await invoke(TicketController.createTicket, unrelated, response(hidden));
    assert.equal(hidden.status, 409);
    assert.deepEqual(hidden.body, {
      success: false,
      message: "Laporan aktif serupa sudah ada untuk PC dan masalah ini.",
      data: { existingTicket: { status: "OPEN", createdAt: existing.createdAt } },
    });

    const owner = request(validCreateBody);
    owner.user = { userId: "student-owner", role: "MAHASISWA" };
    const visible: Result = {};
    await invoke(TicketController.createTicket, owner, response(visible));
    assert.equal(visible.status, 409);
    assert.deepEqual((visible.body as { data: { existingTicket: unknown } }).data.existingTicket, {
      id: "ticket-existing", link: "/tickets/ticket-existing", status: "OPEN", createdAt: existing.createdAt,
    });
  } finally {
    restore();
  }
});
