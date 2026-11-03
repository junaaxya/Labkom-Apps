import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { AccessRequestService } from "../services/access-request.service";
import { VerificationDeliveryError } from "../services/magang-verification-email.service";
import { AccessRequestController } from "./access-request.controller";

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

function createRequest(body: unknown): Request {
  return { body } as Request;
}

function replaceMethod(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, property, descriptor);
    } else {
      Reflect.deleteProperty(target, property);
    }
  };
}

const validMagangRequest = {
  type: "MAGANG",
  applicantName: "Test Applicant",
  applicantEmail: "applicant@example.com",
  title: "Magang Lab",
  requestedRole: "MAGANG",
  password: "StrongPassword1!",
  confirmPassword: "StrongPassword1!",
};

test("public access-request create keeps Zod validation issues structured", async () => {
  const result: ControllerResult = {};

  await AccessRequestController.create(createRequest({}), createResponse(result));

  const body = result.body as { success?: unknown; message?: unknown; errors?: unknown };
  assert.equal(result.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Validasi gagal");
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.length > 0);
});

test("public MAGANG email verification keeps Zod validation issues structured", async () => {
  const result: ControllerResult = {};

  await AccessRequestController.verifyMagangEmail(createRequest({ token: "invalid" }), createResponse(result));

  const body = result.body as { success?: unknown; message?: unknown; errors?: unknown };
  assert.equal(result.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Validasi gagal");
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.length > 0);
});

test("public access-request create exposes only duplicate-email domain error", async () => {
  const result: ControllerResult = {};
  const restore = replaceMethod(AccessRequestService, "createRequest", async () => {
    throw new Error("Email sudah terdaftar");
  });

  try {
    await AccessRequestController.create(createRequest(validMagangRequest), createResponse(result));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { success: false, message: "Email sudah terdaftar" });
  } finally {
    restore();
  }
});

test("public access-request create preserves generic verification delivery response", async () => {
  const result: ControllerResult = {};
  const restore = replaceMethod(AccessRequestService, "createRequest", async () => {
    throw new VerificationDeliveryError();
  });

  try {
    await AccessRequestController.create(createRequest(validMagangRequest), createResponse(result));
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, {
      success: false,
      message: "Pengajuan tersimpan tetapi email verifikasi belum dapat dikirim. Hubungi administrator.",
    });
  } finally {
    restore();
  }
});

test("public access-request create hides unexpected persistence errors", async () => {
  const result: ControllerResult = {};
  const restore = replaceMethod(AccessRequestService, "createRequest", async () => {
    throw new Error("The table `public.users` does not exist");
  });

  try {
    await AccessRequestController.create(createRequest(validMagangRequest), createResponse(result));
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, {
      success: false,
      message: "Pengajuan tidak dapat diproses. Silakan coba lagi.",
    });
  } finally {
    restore();
  }
});

test("public MAGANG email verification hides unexpected persistence errors", async () => {
  const result: ControllerResult = {};
  const restore = replaceMethod(AccessRequestService, "verifyMagangEmail", async () => {
    throw new Error("Invalid `prisma.$queryRaw()` invocation: relation does not exist");
  });

  try {
    await AccessRequestController.verifyMagangEmail(createRequest({ token: "a".repeat(43) }), createResponse(result));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
      success: false,
      message: "Token verifikasi tidak valid atau sudah kedaluwarsa",
    });
  } finally {
    restore();
  }
});

test("public MAGANG resend gives identical generic response for no-match and delivery failures", async () => {
  const request = createRequest({ email: "unknown@example.test" });
  const first: ControllerResult = {};
  const second: ControllerResult = {};
  const restore = replaceMethod(AccessRequestService, "resendMagangVerification", async () => undefined);

  try {
    await AccessRequestController.resendMagangVerification(request, createResponse(first));
    const failure = replaceMethod(AccessRequestService, "resendMagangVerification", async () => {
      throw new Error("delivery unavailable");
    });
    try {
      await AccessRequestController.resendMagangVerification(request, createResponse(second));
    } finally {
      failure();
    }
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, second.body);
    assert.deepEqual(first.body, {
      success: true,
      message: "Jika pengajuan MAGANG yang belum diverifikasi ditemukan, email verifikasi baru akan dikirim.",
    });
  } finally {
    restore();
  }
});
