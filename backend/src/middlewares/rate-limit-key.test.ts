import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  authenticatedUserRateLimitKey,
  bodyIdentityRateLimitKey,
  headerRateLimitKey,
} from "./rate-limit-key";

function request(options: {
  body?: unknown;
  ip?: string;
  userId?: string;
  headers?: Record<string, string>;
} = {}): Request {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    body: options.body ?? {},
    ip: options.ip ?? "172.24.0.1",
    user: options.userId ? { userId: options.userId, role: "MAHASISWA" } : undefined,
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

test("120 authenticated users behind one tunnel gateway receive distinct limiter keys", () => {
  const keys = new Set(
    Array.from({ length: 120 }, (_, index) =>
      authenticatedUserRateLimitKey(request({ userId: `user-${index}` }), "file-session"),
    ),
  );
  assert.equal(keys.size, 120);
});

test("authenticated user keys are stable and do not retain raw user IDs", () => {
  const first = authenticatedUserRateLimitKey(request({ userId: "private-user-id" }), "register");
  const second = authenticatedUserRateLimitKey(request({ userId: "private-user-id" }), "register");
  assert.equal(first, second);
  assert.equal(first.includes("private-user-id"), false);
});

test("public body identity keys normalize nested email without retaining PII", () => {
  const first = bodyIdentityRateLimitKey(
    request({ body: { customer: { email: " Student@Example.COM " } } }),
    "hosting-checkout",
    ["customer.email"],
  );
  const second = bodyIdentityRateLimitKey(
    request({ body: { customer: { email: "student@example.com" } } }),
    "hosting-checkout",
    ["customer.email"],
  );
  assert.equal(first, second);
  assert.equal(first.includes("student@example.com"), false);
});

test("public action keys can use either email or one-time token", () => {
  const emailKey = bodyIdentityRateLimitKey(
    request({ body: { email: "student@example.com" } }),
    "external-student",
    ["email", "token"],
  );
  const tokenKey = bodyIdentityRateLimitKey(
    request({ body: { token: "opaque-one-time-token" } }),
    "external-student",
    ["email", "token"],
  );
  assert.notEqual(emailKey, tokenKey);
  assert.equal(tokenKey.includes("opaque-one-time-token"), false);
});

test("cookie-backed logout keys are hashed and missing identities fall back to normalized IP", () => {
  const cookieKey = headerRateLimitKey(
    request({ headers: { cookie: "protected_session=sensitive-value" } }),
    "file-session-delete",
    "cookie",
  );
  const fallback = headerRateLimitKey(request({ ip: "2001:db8::1234" }), "file-session-delete", "cookie");
  assert.equal(cookieKey.includes("sensitive-value"), false);
  assert.match(fallback, /^file-session-delete:ip:/);
});
