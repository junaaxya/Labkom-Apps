import { randomBytes } from "node:crypto";
import prisma from "../config/database";
import redis from "../config/redis";

const SSE_TICKET_PREFIX = "notification:sse-ticket:";
const SSE_TICKET_TTL_SECONDS = 60;

export type SseTicketIdentity = { userId: string; role: string };

export async function createSseTicket(identity: SseTicketIdentity): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ticket = randomBytes(32).toString("base64url");
    const stored = await redis.set(
      `${SSE_TICKET_PREFIX}${ticket}`,
      JSON.stringify(identity),
      "EX",
      SSE_TICKET_TTL_SECONDS,
      "NX",
    );
    if (stored === "OK") return ticket;
  }
  throw new Error("Gagal membuat tiket notifikasi realtime");
}

export async function consumeSseTicket(ticket: string): Promise<SseTicketIdentity | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  const raw = await redis.getdel(`${SSE_TICKET_PREFIX}${ticket}`);
  if (!raw) return null;

  try {
    const identity = JSON.parse(raw) as Partial<SseTicketIdentity>;
    if (!identity.userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: identity.userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user?.isActive) return null;
    return { userId: user.id, role: user.role };
  } catch {
    return null;
  }
}
