import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express, { type Request } from "express";
import rateLimit from "express-rate-limit";
import {
  LOGIN_ACCOUNT_MAX_FAILED_ATTEMPTS,
  LOGIN_IP_MAX_FAILED_ATTEMPTS,
  loginAccountKey,
  loginAccountLimiterOptions,
  loginIpLimiterOptions,
} from "./auth-rate-limit";

function request(identifier: unknown, ip = "203.0.113.10"): Request {
  return { body: { identifier }, ip } as Request;
}

test("120 distinct accounts behind one NAT receive distinct account limiter keys", () => {
  const keys = new Set(
    Array.from({ length: 120 }, (_, index) => loginAccountKey(request(`student-${index}@example.test`))),
  );

  assert.equal(keys.size, 120);
  assert.ok(LOGIN_IP_MAX_FAILED_ATTEMPTS >= 120);
});

test("account limiter normalizes identifiers without retaining email addresses in keys", () => {
  const first = loginAccountKey(request(" Student@Example.Test "));
  const second = loginAccountKey(request("student@example.test"));

  assert.equal(first, second);
  assert.match(first, /^account:[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /student|example/i);
});

test("legacy email and current identifier fields share the same account key", () => {
  const current = loginAccountKey(request("student@example.test"));
  const legacy = loginAccountKey({ body: { email: "student@example.test" }, ip: "203.0.113.11" } as Request);

  assert.equal(current, legacy);
});

test("missing account identifier falls back to a normalized IP key", () => {
  assert.match(loginAccountKey(request(undefined)), /^ip:/);
});

test("successful logins do not consume failed-attempt budgets", () => {
  assert.equal(loginIpLimiterOptions.skipSuccessfulRequests, true);
  assert.equal(loginAccountLimiterOptions.skipSuccessfulRequests, true);
  assert.equal(loginIpLimiterOptions.limit, LOGIN_IP_MAX_FAILED_ATTEMPTS);
  assert.equal(loginAccountLimiterOptions.limit, LOGIN_ACCOUNT_MAX_FAILED_ATTEMPTS);
});

test("120 successful logins from one NAT are accepted while failures remain limited per account", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post(
    "/login",
    rateLimit(loginIpLimiterOptions),
    rateLimit(loginAccountLimiterOptions),
    (req, res) => res.status(req.body.fail ? 401 : 200).json({ success: !req.body.fail }),
  );

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/login`;

  try {
    const successfulStatuses = await Promise.all(
      Array.from({ length: 120 }, async (_, index) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
          body: JSON.stringify({ identifier: `student-${index}@example.test` }),
        });
        return response.status;
      }),
    );
    assert.deepEqual(new Set(successfulStatuses), new Set([200]));

    const failedStatuses: number[] = [];
    for (let attempt = 0; attempt <= LOGIN_ACCOUNT_MAX_FAILED_ATTEMPTS; attempt += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${attempt + 1}` },
        body: JSON.stringify({ identifier: "target@example.test", fail: true }),
      });
      failedStatuses.push(response.status);
    }

    assert.deepEqual(failedStatuses.slice(0, LOGIN_ACCOUNT_MAX_FAILED_ATTEMPTS), Array(10).fill(401));
    assert.equal(failedStatuses[failedStatuses.length - 1], 429);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
