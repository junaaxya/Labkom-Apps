import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { BookingController } from "./booking.controller";
import { BookingService } from "../services/booking.service";

type Actor = {
  userId: string;
  role: string;
};

type ControllerResult = {
  status?: number;
  body?: unknown;
};

function createResponse(result: ControllerResult): Response {
  return {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;
}

function createRequest(user?: Actor): Request {
  return {
    params: { id: "booking-1" },
    ...(user ? { user } : {}),
  } as unknown as Request;
}

function mockGetBookingById(
  implementation: (id: string, actor: Actor) => Promise<unknown>,
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(BookingService, "getBookingById");

  Object.defineProperty(BookingService, "getBookingById", {
    configurable: true,
    value: implementation,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(BookingService, "getBookingById", descriptor);
    } else {
      Reflect.deleteProperty(BookingService, "getBookingById");
    }
  };
}

test("booking detail controller returns 401 before calling service without an actor", async () => {
  const result: ControllerResult = {};
  await BookingController.getBookingById(createRequest(), createResponse(result));

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { success: false, message: "Unauthorized" });
});

test("booking detail controller passes authenticated actor to service", async () => {
  const actor = { userId: "owner-1", role: "MAHASISWA" };
  const calls: Array<{ id: string; actor: Actor }> = [];
  const restore = mockGetBookingById(async (id, serviceActor) => {
    calls.push({ id, actor: serviceActor });
    return { id, requestedBy: "owner-1" };
  });
  const result: ControllerResult = {};

  try {
    await BookingController.getBookingById(createRequest(actor), createResponse(result));
  } finally {
    restore();
  }

  assert.deepEqual(calls, [{ id: "booking-1", actor }]);
  assert.deepEqual(result.body, { success: true, data: { id: "booking-1", requestedBy: "owner-1" } });
});

test("booking detail controller maps non-owner assistant denial to 403 and missing to 404", async () => {
  const actor = { userId: "assistant-1", role: "ASISTEN_LAB" };
  let error = new Error("Anda tidak memiliki akses ke data ini");
  const restore = mockGetBookingById(async () => { throw error; });
  const forbidden: ControllerResult = {};

  try {
    await BookingController.getBookingById(createRequest(actor), createResponse(forbidden));
    error = new Error("Pengajuan peminjaman tidak ditemukan");
    const missing: ControllerResult = {};
    await BookingController.getBookingById(createRequest(actor), createResponse(missing));

    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, { success: false, message: "Anda tidak memiliki akses ke data ini" });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { success: false, message: "Pengajuan peminjaman tidak ditemukan" });
  } finally {
    restore();
  }
});
