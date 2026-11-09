import { createHash } from "node:crypto";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function nestedString(body: unknown, path: string): string | undefined {
  let current: unknown = body;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current !== "string") return undefined;
  const normalized = current.trim().toLowerCase();
  return normalized || undefined;
}

function fallbackIpKey(req: Request, namespace: string): string {
  return `${namespace}:ip:${ipKeyGenerator(req.ip || "unknown")}`;
}

export function bodyIdentityRateLimitKey(req: Request, namespace: string, paths: string[]): string {
  for (const path of paths) {
    const value = nestedString(req.body, path);
    if (value) return `${namespace}:identity:${digest(value)}`;
  }
  return fallbackIpKey(req, namespace);
}

export function authenticatedUserRateLimitKey(req: Request, namespace: string): string {
  const userId = req.user?.userId?.trim();
  if (userId) return `${namespace}:user:${digest(userId)}`;
  return fallbackIpKey(req, namespace);
}

export function headerRateLimitKey(req: Request, namespace: string, headerName: string): string {
  const value = req.get(headerName)?.trim();
  if (value) return `${namespace}:header:${digest(value)}`;
  return fallbackIpKey(req, namespace);
}
