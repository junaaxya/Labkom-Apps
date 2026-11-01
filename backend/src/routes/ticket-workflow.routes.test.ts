import assert from "node:assert/strict";
import test from "node:test";
import ticketRoutes from "./ticket.routes";
import { TicketController } from "../controllers/ticket.controller";

type RouteMethod = "get" | "patch" | "post";

function route(path: string, method: RouteMethod) {
  const layer = ticketRoutes.stack.find((entry) => {
    if (!entry.route || entry.route.path !== path) return false;
    return entry.route.stack.some((handler) => handler.method === method);
  });
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} tidak ditemukan`);
  return layer.route;
}

function lastHandler(path: string, method: RouteMethod) {
  const stack = route(path, method).stack;
  const handler = stack[stack.length - 1]?.handle;
  assert.ok(handler);
  return handler;
}

function authorize(path: string, method: RouteMethod, role: string) {
  const handler = route(path, method).stack[1]?.handle;
  assert.ok(handler);
  let status: number | undefined;
  let body: unknown;
  let nextCalled = false;
  Reflect.apply(handler, undefined, [{ user: { role } }, {
    status(code: number) { status = code; return this; },
    json(payload: unknown) { body = payload; return this; },
  }, () => { nextCalled = true; }]);
  return { status, body, nextCalled };
}

test("ticket workflow exposes intended handlers and role gates", () => {
  assert.equal(lastHandler("/:id/claim", "patch"), TicketController.claimTicket);
  assert.equal(lastHandler("/:id/assign", "patch"), TicketController.assignTicket);
  assert.equal(lastHandler("/:id/status", "patch"), TicketController.transitionTicket);
  assert.equal(lastHandler("/:id/actions", "post"), TicketController.addTicketAction);
  assert.equal(lastHandler("/:id/history", "get"), TicketController.getTicketHistory);

  assert.equal(authorize("/:id/claim", "patch", "ASISTEN_LAB").nextCalled, true);
  assert.equal(authorize("/:id/claim", "patch", "KOORDINATOR_LAB").status, 403);
  assert.equal(authorize("/:id/assign", "patch", "KOORDINATOR_LAB").nextCalled, true);
  assert.equal(authorize("/:id/assign", "patch", "ASISTEN_LAB").status, 403);
  assert.equal(authorize("/:id/actions", "post", "ASISTEN_LAB").nextCalled, true);
  assert.equal(authorize("/:id/actions", "post", "MAHASISWA").status, 403);
});
