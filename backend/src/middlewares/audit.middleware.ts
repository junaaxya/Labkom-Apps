import type { NextFunction, Request, Response } from "express";
import prisma from "../config/database";

const AUDITED_RESOURCES = new Set([
  "announcements",
  "bookings",
  "keys",
  "labs",
  "schedule-changes",
  "schedules",
  "tickets",
  "users",
]);

const TERMINAL_ACTIONS = new Set([
  "approve",
  "assign",
  "cancel",
  "complete",
  "force-return",
  "reject",
  "return",
  "take",
]);

function getTargetId(parts: string[]): string {
  const last = parts[parts.length - 1] ?? "collection";
  if (TERMINAL_ACTIONS.has(last)) return parts[parts.length - 2] ?? "collection";
  return last;
}

function getReason(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const candidate = body as Record<string, unknown>;
  for (const key of ["reason", "rejectionReason", "adminNotes"]) {
    const value = candidate[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 300);
  }
  return undefined;
}

export function auditSuccessfulMutation(req: Request, res: Response, next: NextFunction): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  res.once("finish", () => {
    if (!req.user || res.statusCode < 200 || res.statusCode >= 400) return;

    const relativePath = req.originalUrl.replace(/^\/api\/v1\/?/, "").split("?")[0];
    const parts = relativePath.split("/").filter(Boolean);
    const resource = parts[0];
    if (!AUDITED_RESOURCES.has(resource)) return;

    // Approval ini sudah dicatat secara atomik oleh service terkait.
    if (
      (resource === "bookings" || resource === "schedule-changes") &&
      parts[parts.length - 1] === "approve"
    ) return;

    const reason = getReason(req.body);
    const description = `${req.method} /${relativePath}${reason ? ` | alasan: ${reason}` : ""}`;

    void prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: `${req.method}_${resource.replace(/-/g, "_").toUpperCase()}`,
        targetType: resource,
        targetId: getTargetId(parts),
        description,
        ipAddress: req.ip,
      },
    }).catch((error) => {
      console.error("[AUDIT_LOG_WRITE_FAILED]", {
        resource,
        targetId: getTargetId(parts),
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  next();
}
