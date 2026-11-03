import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import prisma from "../config/database";
import redis from "../config/redis";

const FILE_SESSION_PREFIX = "protected-file-session:";
const FILE_SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "labkom_file_session";

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function createProtectedFileSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await redis.set(`${FILE_SESSION_PREFIX}${token}`, userId, "EX", FILE_SESSION_TTL_SECONDS);
  return token;
}

export function setProtectedFileSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${FILE_SESSION_TTL_SECONDS}; Path=/api/v1/files; HttpOnly; SameSite=Strict${secure}`,
  );
}

export async function revokeProtectedFileSession(req: Request, res: Response): Promise<void> {
  const token = cookieValue(req.headers.cookie, COOKIE_NAME);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await redis.del(`${FILE_SESSION_PREFIX}${token}`);
  }
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Max-Age=0; Path=/api/v1/files; HttpOnly; SameSite=Strict${secure}`,
  );
}

export async function authenticateProtectedFileSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = cookieValue(req.headers.cookie, COOKIE_NAME);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    res.status(401).json({ success: false, message: "Sesi file tidak valid" });
    return;
  }

  const userId = await redis.get(`${FILE_SESSION_PREFIX}${token}`);
  if (!userId) {
    res.status(401).json({ success: false, message: "Sesi file kedaluwarsa" });
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, role: true },
  });
  if (!user) {
    res.status(401).json({ success: false, message: "Pengguna tidak aktif" });
    return;
  }

  req.user = { userId: user.id, role: user.role };
  next();
}
