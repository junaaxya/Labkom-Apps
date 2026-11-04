import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Request, Response } from "express";
import { SupportChatController } from "./support-chat.controller";
import { SupportChatError } from "../services/support-chat.error";
import { SupportChatService } from "../services/support-chat.service";

type Restore = () => void;
type ControllerResult = { status?: number; body?: unknown };

function replaceProperty(target: object, property: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

function response(result: ControllerResult) {
  return {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  };
}

function request(options: {
  readonly body?: unknown;
  readonly user?: { readonly userId: string; readonly role: string };
  readonly id?: string;
} = {}) {
  return {
    params: { id: options.id ?? "chat-1" },
    body: options.body,
    ...(options.user ? { user: options.user } : {}),
  };
}

async function invoke(
  handler: (request: Request, response: Response) => Promise<void>,
  req: Record<string, unknown>,
  res: Record<string, unknown>,
): Promise<void> {
  await Reflect.apply(handler, SupportChatController, [req, res]);
}

test("support chat controllers reject missing authentication before service access", async () => {
  const handlers = [
    SupportChatController.create,
    SupportChatController.getAll,
    SupportChatController.getById,
    SupportChatController.createMessage,
  ];

  for (const handler of handlers) {
    const result: ControllerResult = {};
    await invoke(handler, request({ body: { pcId: "pc-1", body: "Pesan" } }), response(result));
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { success: false, message: "Unauthorized" });
  }
});

test("support chat creation accepts only pcId and body then derives the authenticated student", async () => {
  const calls: Array<{ studentId: string; input: unknown }> = [];
  const restore = replaceProperty(SupportChatService, "createChat", async (studentId: string, input: unknown) => {
    calls.push({ studentId, input });
    return { id: "chat-1" };
  });

  try {
    const invalidResult: ControllerResult = {};
    await invoke(
      SupportChatController.create,
      request({
        user: { userId: "student-auth", role: "MAHASISWA" },
        body: {
          pcId: "pc-1",
          body: "Pesan",
          studentId: "attacker",
          labId: "attacker-lab",
          assignedAssistantId: "attacker",
          shiftScheduleId: "attacker-shift",
          status: "HANDLED",
        },
      }),
      response(invalidResult),
    );
    assert.equal(invalidResult.status, 400);
    assert.equal(calls.length, 0);

    const validResult: ControllerResult = {};
    await invoke(
      SupportChatController.create,
      request({ user: { userId: "student-auth", role: "MAHASISWA" }, body: { pcId: "pc-1", body: "Pesan" } }),
      response(validResult),
    );
    assert.equal(validResult.status, 201);
    assert.deepEqual(calls, [{ studentId: "student-auth", input: { pcId: "pc-1", body: "Pesan" } }]);
  } finally {
    restore();
  }
});

test("support chat controllers map validation and domain errors to their public statuses", async () => {
  let createError: Error = new SupportChatError("PC_NOT_FOUND");
  let detailError: Error = new SupportChatError("CHAT_NOT_FOUND");
  let messageError: Error = new SupportChatError("NOT_PARTICIPANT");
  const restores = [
    replaceProperty(SupportChatService, "createChat", async () => { throw createError; }),
    replaceProperty(SupportChatService, "getChatById", async () => { throw detailError; }),
    replaceProperty(SupportChatService, "createMessage", async () => { throw messageError; }),
  ];
  const studentActor = { userId: "student-auth", role: "MAHASISWA" };

  try {
    const blankMessage: ControllerResult = {};
    await invoke(SupportChatController.createMessage, request({ user: studentActor, body: { body: "   " } }), response(blankMessage));
    assert.equal(blankMessage.status, 400);
    assert.ok(
      typeof blankMessage.body === "object" &&
      blankMessage.body !== null &&
      "errors" in blankMessage.body,
    );

    const missingPcId: ControllerResult = {};
    await invoke(SupportChatController.create, request({ user: studentActor, body: { body: "Pesan" } }), response(missingPcId));
    assert.equal(missingPcId.status, 400);

    const oversizedMessage: ControllerResult = {};
    await invoke(
      SupportChatController.create,
      request({ user: studentActor, body: { pcId: "pc-1", body: "x".repeat(5001) } }),
      response(oversizedMessage),
    );
    assert.equal(oversizedMessage.status, 400);

    const missingPc: ControllerResult = {};
    await invoke(SupportChatController.create, request({ user: studentActor, body: { pcId: "pc-1", body: "Pesan" } }), response(missingPc));
    assert.equal(missingPc.status, 404);
    assert.deepEqual(missingPc.body, { success: false, message: "PC tidak ditemukan" });

    createError = new SupportChatError("NO_CURRENT_DUTY");
    const noDuty: ControllerResult = {};
    await invoke(SupportChatController.create, request({ user: studentActor, body: { pcId: "pc-1", body: "Pesan" } }), response(noDuty));
    assert.equal(noDuty.status, 409);
    assert.deepEqual(noDuty.body, { success: false, message: "Tidak ada Asisten Lab yang sedang bertugas untuk lab ini" });

    const missingChat: ControllerResult = {};
    await invoke(SupportChatController.getById, request({ user: studentActor }), response(missingChat));
    assert.equal(missingChat.status, 404);
    assert.deepEqual(missingChat.body, { success: false, message: "Chat dukungan tidak ditemukan" });

    const forbidden: ControllerResult = {};
    await invoke(SupportChatController.createMessage, request({ user: studentActor, body: { body: "Pesan" } }), response(forbidden));
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, { success: false, message: "Anda tidak memiliki akses ke chat dukungan ini" });

    messageError = new SupportChatError("CLAIM_LOST");
    const simultaneousClaimLoss: ControllerResult = {};
    await invoke(
      SupportChatController.createMessage,
      request({ user: { userId: "assistant-loser", role: "ASISTEN_LAB" }, body: { body: "Saya bantu" } }),
      response(simultaneousClaimLoss),
    );
    assert.equal(simultaneousClaimLoss.status, 409);
    assert.deepEqual(simultaneousClaimLoss.body, { success: false, message: "Chat sudah diambil oleh asisten lain" });

    detailError = new Error("Unexpected persistence failure");
    const unexpected: ControllerResult = {};
    await invoke(SupportChatController.getById, request({ user: studentActor }), response(unexpected));
    assert.equal(unexpected.status, 500);
    assert.deepEqual(unexpected.body, { success: false, message: "Chat dukungan tidak dapat diproses" });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("support chat controller exposes strict claim and receipt contracts", () => {
  const controller = readFileSync(path.join(__dirname, "support-chat.controller.ts"), "utf8");
  const validator = readFileSync(path.join(__dirname, "../validators/support-chat.validator.ts"), "utf8");
  assert.match(controller, /static async claim\(req: Request, res: Response\)/);
  assert.match(controller, /SupportChatService\.claimChat\(getParam\(req, "id"\), req\.user\)/);
  assert.match(controller, /static async recordReceipt\(req: Request, res: Response\)/);
  assert.match(controller, /recordSupportChatReceiptSchema\.parse\(req\.body\)/);
  assert.match(controller, /SupportChatService\.recordReceipt\(getParam\(req, "id"\), getParam\(req, "messageId"\), req\.user, input\)/);
  assert.match(validator, /recordSupportChatReceiptSchema = z\.object\(\{\s*status: z\.enum\(\["DELIVERED", "READ"\]\),\s*\}\)\.strict\(\)/s);
});
