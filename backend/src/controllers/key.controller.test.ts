import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { KeyController } from "./key.controller";
import { KeyService } from "../services/key.service";

type ControllerResult = {
  status?: number;
  body?: unknown;
};

type KeyActor = {
  userId: string;
  role: string;
};

function replaceMethod(target: object, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Reflect.deleteProperty(target, key);
    }
  };
}

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

function createRequest(user: KeyActor, body?: unknown): Request {
  return {
    params: { id: "key-1" },
    user,
    ...(body === undefined ? {} : { body }),
  } as unknown as Request;
}

test("key take and return allow missing or empty bodies and preserve nonblank notes", async () => {
  const takeNotes: Array<string | undefined> = [];
  const returnNotes: Array<string | undefined> = [];
  const actor = { userId: "chair-1", role: "MAHASISWA" };
  const restores = [
    replaceMethod(KeyService, "takeKey", async (_keyId: string, _userId: string, _role: string, notes?: string) => {
      takeNotes.push(notes);
      return { id: "key-1" };
    }),
    replaceMethod(KeyService, "returnKey", async (_keyId: string, _userId: string, notes?: string) => {
      returnNotes.push(notes);
      return { id: "key-1" };
    }),
  ];

  try {
    for (const body of [undefined, {}, { notes: "  Keep exact note  " }, { notes: "" }, { notes: "   " }]) {
      await KeyController.takeKey(createRequest(actor, body), createResponse({}));
      await KeyController.returnKey(createRequest(actor, body), createResponse({}));
    }

    assert.deepEqual(takeNotes, [undefined, undefined, "  Keep exact note  ", undefined, undefined]);
    assert.deepEqual(returnNotes, [undefined, undefined, "  Keep exact note  ", undefined, undefined]);
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});

test("force return requires nonblank reason and preserves valid text", async () => {
  const reasons: Array<string | undefined> = [];
  const actor = { userId: "coordinator-1", role: "KOORDINATOR_LAB" };
  const restore = replaceMethod(KeyService, "forceReturnKey", async (_keyId: string, _userId: string, reason?: string) => {
    reasons.push(reason);
    return { id: "key-1" };
  });

  try {
    for (const body of [undefined, {}, { reason: "" }, { reason: "   " }]) {
      const result: ControllerResult = {};
      await KeyController.forceReturnKey(createRequest(actor, body), createResponse(result));
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, { success: false, message: "Alasan force return wajib diisi." });
    }

    const okResult: ControllerResult = {};
    await KeyController.forceReturnKey(createRequest(actor, { reason: "  Maintenance complete  " }), createResponse(okResult));
    assert.equal(okResult.status, undefined);
    assert.deepEqual(reasons, ["  Maintenance complete  "]);
  } finally {
    restore();
  }
});

test("key action optional text objects, arrays, and numbers return controlled 400", async () => {
  const actor = { userId: "coordinator-1", role: "KOORDINATOR_LAB" };
  const cases: Array<{
    action: (req: Request, res: Response) => Promise<void>;
    body: unknown;
    message: string;
  }> = [
    { action: KeyController.takeKey, body: { notes: {} }, message: "notes harus berupa string" },
    { action: KeyController.takeKey, body: { notes: [] }, message: "notes harus berupa string" },
    { action: KeyController.takeKey, body: { notes: 1 }, message: "notes harus berupa string" },
    { action: KeyController.returnKey, body: { notes: {} }, message: "notes harus berupa string" },
    { action: KeyController.returnKey, body: { notes: [] }, message: "notes harus berupa string" },
    { action: KeyController.returnKey, body: { notes: 1 }, message: "notes harus berupa string" },
    { action: KeyController.forceReturnKey, body: { reason: {} }, message: "reason harus berupa string" },
    { action: KeyController.forceReturnKey, body: { reason: [] }, message: "reason harus berupa string" },
    { action: KeyController.forceReturnKey, body: { reason: 1 }, message: "reason harus berupa string" },
  ];

  for (const { action, body, message } of cases) {
    const result: ControllerResult = {};
    await action(createRequest(actor, body), createResponse(result));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { success: false, message });
  }
});

test("key QR scan without body keeps required QR validation controlled", async () => {
  const result: ControllerResult = {};
  await KeyController.findByQR(createRequest({ userId: "chair-1", role: "MAHASISWA" }), createResponse(result));

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { success: false, message: "QR Code wajib diisi" });
});
