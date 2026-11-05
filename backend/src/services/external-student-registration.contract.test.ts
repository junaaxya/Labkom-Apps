import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const service = readFileSync(path.join(__dirname, "external-student-registration.service.ts"), "utf8");
const routes = readFileSync(path.join(__dirname, "../routes/access-request.routes.ts"), "utf8");

test("external student registration creates only inactive MAHASISWA accounts with unique email and NIM", () => {
  assert.match(service, /OR: \[\{ email:[\s\S]*\}, \{ nim \}\]/);
  assert.match(service, /role: "MAHASISWA", isActive: false/);
  assert.match(service, /externalStudentVerification\.create/);
  assert.match(service, /tokenHash: hash, expiresAt/);
});

test("verification is one-time and activates atomically after password creation", () => {
  assert.match(service, /consumedAt: null, expiresAt: \{ gt: now \}/);
  assert.match(service, /where: \{ id: verification\.userId, role: "MAHASISWA", isActive: false \}/);
  assert.match(service, /data: \{ password, isActive: true \}/);
  assert.match(service, /emailVerifiedAt: now, status: "APPROVED"/);
});

test("public registration endpoints are rate limited", () => {
  assert.match(routes, /registrationLimiter/);
  assert.match(routes, /router\.post\("\/external-student", registrationLimiter/);
  assert.match(routes, /router\.post\("\/external-student\/verify", registrationLimiter/);
});
