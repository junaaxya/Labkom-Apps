import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../config/database";
import { authenticate } from "../middlewares/auth.middleware";
import { sseManager } from "../services/sse.service";
import { streamNotifications } from "./notification.routes";

type AuthResult = {
  req: Request;
  status?: number;
  body?: unknown;
  nextCalled: boolean;
};

async function runAuthenticate(authorization?: string, query: Record<string, string> = {}): Promise<AuthResult> {
  const req = {
    headers: authorization ? { authorization } : {},
    query,
    originalUrl: "/api/v1/notifications/stream",
  } as unknown as Request;
  const result: AuthResult = { req, nextCalled: false };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;

  const descriptor = Object.getOwnPropertyDescriptor(prisma.user, "findUnique");
  Object.defineProperty(prisma.user, "findUnique", {
    configurable: true,
    value: async () => ({ id: "stream-user", role: "MAHASISWA", isActive: true, mustChangePassword: false }),
  });

  try {
    await authenticate(req, res, () => { result.nextCalled = true; });
  } finally {
    if (descriptor) Object.defineProperty(prisma.user, "findUnique", descriptor);
    else Reflect.deleteProperty(prisma.user, "findUnique");
  }
  return result;
}

function createBearerToken(userId: string): string {
  return `Bearer ${jwt.sign({ userId, role: "MAHASISWA" }, config.jwtSecret)}`;
}

test("notification stream route uses Bearer authentication only", () => {
  const source = readFileSync(path.join(__dirname, "notification.routes.ts"), "utf8");
  assert.match(source, /router\.get\("\/stream", authenticate, streamNotifications\);/);
  assert.doesNotMatch(source, /authenticateQueryToken/);
});

test("notification stream authentication accepts Bearer and rejects query-only, absent, and invalid credentials", async () => {
  const valid = await runAuthenticate(createBearerToken("stream-user"));
  assert.equal(valid.nextCalled, true);
  assert.equal(valid.req.user?.userId, "stream-user");
  assert.equal(valid.req.user?.role, "MAHASISWA");

  const queryOnly = await runAuthenticate(undefined, {
    token: createBearerToken("stream-user").replace("Bearer ", ""),
  });
  const absent = await runAuthenticate();
  const invalid = await runAuthenticate("Bearer invalid-token");

  for (const result of [queryOnly, absent, invalid]) {
    assert.equal(result.status, 401);
    assert.equal(result.nextCalled, false);
  }
});

test("notification stream writes connected event and registers authenticated client", async () => {
  const authenticated = await runAuthenticate(createBearerToken("stream-user"));
  assert.equal(authenticated.nextCalled, true);

  const headers = new Map<string, string>();
  const writes: string[] = [];
  let flushed = false;
  const res = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    flushHeaders() {
      flushed = true;
    },
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  } as unknown as Response;
  const descriptor = Object.getOwnPropertyDescriptor(sseManager, "addClient");
  let registeredUserId: string | undefined;
  let registeredResponse: Response | undefined;

  Object.defineProperty(sseManager, "addClient", {
    configurable: true,
    value: (userId: string, response: Response) => {
      registeredUserId = userId;
      registeredResponse = response;
    },
  });

  try {
    streamNotifications(authenticated.req, res);
  } finally {
    if (descriptor) {
      Object.defineProperty(sseManager, "addClient", descriptor);
    } else {
      Reflect.deleteProperty(sseManager, "addClient");
    }
  }

  assert.equal(headers.get("Content-Type"), "text/event-stream");
  assert.equal(headers.get("Cache-Control"), "no-cache");
  assert.equal(headers.get("Connection"), "keep-alive");
  assert.equal(headers.get("X-Accel-Buffering"), "no");
  assert.equal(flushed, true);
  assert.deepEqual(writes, ["event: connected\ndata: {\"status\":\"ok\"}\n\n"]);
  assert.equal(registeredUserId, "stream-user");
  assert.equal(registeredResponse, res);
});
