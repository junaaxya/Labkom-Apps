import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import prisma from "../config/database";
import { PC } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      pc?: PC;
    }
  }
}

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = REPLAY_WINDOW_MS;

interface NonceEntry {
  expiresAt: number;
}

const nonceStore = new Map<string, NonceEntry>();

function pruneNonces(now: number): void {
  for (const [key, entry] of nonceStore) {
    if (entry.expiresAt <= now) nonceStore.delete(key);
  }
}

function rememberNonce(pcCode: string, nonce: string, now: number): boolean {
  const key = `${pcCode}:${nonce}`;
  if (nonceStore.has(key)) return false;
  nonceStore.set(key, { expiresAt: now + NONCE_TTL_MS });
  if (nonceStore.size > 5000) pruneNonces(now);
  return true;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function extractPcCode(req: Request): string | undefined {
  const fromBody = (req.body as { pcCode?: unknown } | undefined)?.pcCode;
  const fromParams = (req.params as { pcCode?: string } | undefined)?.pcCode;
  const fromQuery = req.query?.pcCode;
  const candidate =
    typeof fromBody === "string" && fromBody
      ? fromBody
      : fromParams ||
        (typeof fromQuery === "string" ? fromQuery : undefined);
  return candidate || undefined;
}

function unauthorized(res: Response, message = "Agent token tidak valid."): void {
  res.status(401).json({ success: false, message });
}

function strictTimestampRequired(): boolean {
  return process.env.AGENT_REQUIRE_TIMESTAMP === "true";
}

function checkTimestampAndNonce(req: Request, pcCode: string): {
  ok: boolean;
  status?: number;
  message?: string;
} {
  const tsHeader = req.headers["x-agent-timestamp"];
  const nonceHeader = req.headers["x-agent-nonce"];

  const tsRaw = Array.isArray(tsHeader) ? tsHeader[0] : tsHeader;
  const nonceRaw = Array.isArray(nonceHeader) ? nonceHeader[0] : nonceHeader;

  if (!tsRaw && !nonceRaw) {
    if (strictTimestampRequired()) {
      return { ok: false, status: 401, message: "Header X-Agent-Timestamp dan X-Agent-Nonce wajib." };
    }
    return { ok: true };
  }

  if (!tsRaw || !nonceRaw) {
    return { ok: false, status: 401, message: "Header X-Agent-Timestamp dan X-Agent-Nonce harus dikirim bersamaan." };
  }

  const ts = Number(tsRaw);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 401, message: "X-Agent-Timestamp invalid." };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > REPLAY_WINDOW_MS) {
    return { ok: false, status: 401, message: "Timestamp di luar jendela toleransi." };
  }

  if (typeof nonceRaw !== "string" || nonceRaw.length < 8 || nonceRaw.length > 128) {
    return { ok: false, status: 401, message: "X-Agent-Nonce invalid." };
  }

  if (!rememberNonce(pcCode, nonceRaw, now)) {
    return { ok: false, status: 401, message: "Nonce sudah dipakai." };
  }

  return { ok: true };
}

const agentRateLimitKey = (req: Request): string => {
  const code = extractPcCode(req);
  if (code) return `pc:${code}`;
  return `ip:${ipKeyGenerator(req.ip ?? "", 56)}`;
};

export const agentHeartbeatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: agentRateLimitKey,
  message: { success: false, message: "Terlalu banyak request agent. Coba lagi nanti." },
});

export const agentCommandLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: agentRateLimitKey,
  message: { success: false, message: "Terlalu banyak request command agent. Coba lagi nanti." },
});

export function authenticateAgent(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    unauthorized(res, "Agent token tidak ditemukan.");
    return;
  }

  const token = authHeader.split(" ")[1];
  const pcCode = extractPcCode(req);

  if (!pcCode) {
    res.status(400).json({ success: false, message: "pcCode wajib disertakan." });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  prisma.pC
    .findUnique({ where: { pcCode } })
    .then((pc) => {
      if (!pc || !pc.agentTokenHash) {
        unauthorized(res);
        return;
      }

      if (!constantTimeEquals(pc.agentTokenHash, tokenHash)) {
        unauthorized(res);
        return;
      }

      const replayCheck = checkTimestampAndNonce(req, pcCode);
      if (!replayCheck.ok) {
        res.status(replayCheck.status || 401).json({
          success: false,
          message: replayCheck.message || "Replay protection gagal.",
        });
        return;
      }

      req.pc = pc;
      next();
    })
    .catch((err) => {
      console.error("Agent auth error:", err);
      res.status(500).json({ success: false, message: "Internal server error." });
    });
}
