import { createHash } from "node:crypto";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// A campus NAT can legitimately place more than 120 users behind one public IP.
// Successful logins are removed from both counters; these budgets only retain
// failed responses and therefore continue to limit spraying/brute-force traffic.
export const LOGIN_IP_MAX_FAILED_ATTEMPTS = 200;
export const LOGIN_ACCOUNT_MAX_FAILED_ATTEMPTS = 10;

function ipKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip ?? "", 56)}`;
}

export function loginAccountKey(req: Request): string {
  const rawIdentifier = typeof req.body?.identifier === "string"
    ? req.body.identifier
    : typeof req.body?.email === "string"
      ? req.body.email
      : "";
  const identifier = rawIdentifier.trim().toLowerCase();

  if (!identifier) return ipKey(req);

  const digest = createHash("sha256").update(identifier).digest("hex");
  return `account:${digest}`;
}

export const loginIpLimiterOptions = {
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_IP_MAX_FAILED_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak login gagal dari jaringan ini. Coba lagi dalam 15 menit." },
};

export const loginAccountLimiterOptions = {
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_ACCOUNT_MAX_FAILED_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginAccountKey,
  message: { success: false, message: "Terlalu banyak login gagal untuk akun ini. Coba lagi dalam 15 menit." },
};
