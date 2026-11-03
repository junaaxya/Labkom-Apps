import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config";
import prisma from "../config/database";
import { AuthService } from "../services/auth.service";
import { authenticate } from "./auth.middleware";

type StoredUser = {
  id: string;
  role: "KOORDINATOR_LAB" | "ASISTEN_LAB" | "MAHASISWA" | "MAGANG";
  isActive: boolean;
  mustChangePassword: boolean;
};

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

function token(userId = "user-1", role = "MAHASISWA") {
  return `Bearer ${jwt.sign({ userId, role }, config.jwtSecret)}`;
}

async function runAuthenticate(user: StoredUser | null, method = "GET", originalUrl = "/api/v1/tickets") {
  const req = {
    headers: { authorization: token("user-1", "KOORDINATOR_LAB") },
    method,
    originalUrl,
  } as unknown as Request;
  let status: number | undefined;
  let body: unknown;
  let nextCalled = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  const restore = replaceProperty(prisma.user, "findUnique", async () => user);

  try {
    await authenticate(req, res, () => { nextCalled = true; });
  } finally {
    restore();
  }

  return { req, status, body, nextCalled };
}

test("must-change users of every role are denied ordinary and SSE routes", async () => {
  for (const role of ["MAHASISWA", "MAGANG", "KOORDINATOR_LAB"] as const) {
    const normal = await runAuthenticate({ id: "user-1", role, isActive: true, mustChangePassword: true });
    const sse = await runAuthenticate({ id: "user-1", role, isActive: true, mustChangePassword: true }, "GET", "/api/v1/notifications/stream");
    assert.equal(normal.status, 403);
    assert.equal(normal.nextCalled, false);
    assert.equal(sse.status, 403);
    assert.equal(sse.nextCalled, false);
  }
});

test("must-change users can only read profile or submit current-password change", async () => {
  const user: StoredUser = { id: "user-1", role: "MAHASISWA", isActive: true, mustChangePassword: true };
  const profile = await runAuthenticate(user, "GET", "/api/v1/auth/profile?from=guard");
  const change = await runAuthenticate(user, "PATCH", "/api/v1/auth/change-password");
  const profilePatch = await runAuthenticate(user, "PATCH", "/api/v1/auth/profile");

  assert.equal(profile.nextCalled, true);
  assert.equal(change.nextCalled, true);
  assert.equal(profilePatch.status, 403);
});

test("persisted state overrides stale JWT role and blocks deleted or inactive accounts", async () => {
  const ordinary = await runAuthenticate({ id: "user-1", role: "MAGANG", isActive: true, mustChangePassword: false });
  const inactive = await runAuthenticate({ id: "user-1", role: "MAHASISWA", isActive: false, mustChangePassword: false });
  const deleted = await runAuthenticate(null);

  assert.equal(ordinary.nextCalled, true);
  assert.equal(ordinary.req.user?.role, "MAGANG");
  assert.equal(inactive.status, 401);
  assert.equal(deleted.status, 401);
});

test("password change only clears restriction after current password verifies", async () => {
  const oldHash = await bcrypt.hash("old-password", 4);
  const calls: Array<Record<string, unknown>> = [];
  const restoreFind = replaceProperty(prisma.user, "findUnique", async () => ({ id: "user-1", password: oldHash }));
  const restoreUpdate = replaceProperty(prisma.user, "update", async (args: Record<string, unknown>) => {
    calls.push(args);
    return {};
  });

  try {
    await assert.rejects(() => AuthService.changePassword("user-1", "wrong-password", "new-password"), /Password lama salah/);
    assert.equal(calls.length, 0);
    const result = await AuthService.changePassword("user-1", "old-password", "new-password");
    assert.deepEqual(result, { message: "Password berhasil diubah", mustChangePassword: false });
    assert.equal(calls.length, 1);
    assert.equal((calls[0].data as { mustChangePassword: boolean }).mustChangePassword, false);
    assert.equal(await bcrypt.compare("new-password", (calls[0].data as { password: string }).password), true);
  } finally {
    restoreUpdate();
    restoreFind();
  }
});

test("reset remains coordinator-routed, public status stays redacted, and agent auth is separate", () => {
  const routes = readFileSync(path.join(__dirname, "../routes/user.routes.ts"), "utf8");
  const publicStatusTest = readFileSync(path.join(__dirname, "../services/access-request.service.test.ts"), "utf8");
  const agentAuth = readFileSync(path.join(__dirname, "agentAuth.middleware.ts"), "utf8");

  assert.match(routes, /router\.patch\("\/:id\/reset-password", authenticate, authorize\("KOORDINATOR_LAB"\), UserController\.resetPassword\)/);
  assert.match(publicStatusTest, /omits reviewer notes and credentials/);
  assert.match(agentAuth, /export function authenticateAgent/);
});
