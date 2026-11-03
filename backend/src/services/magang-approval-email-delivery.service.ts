import prisma from "../config/database";
import { MagangVerificationEmailService } from "./magang-verification-email.service";

const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;

type DeliveryStatus = "QUEUED" | "PROCESSING" | "SENT" | "QA_CAPTURED" | "FAILED";
type Delivery = { id: string; recipientEmail: string; attempts: number; status: DeliveryStatus; leaseExpiresAt: Date | null };
type DeliveryStore = {
  findUnique: (args: { where: { id: string } }) => Promise<Delivery | null>;
  findMany: (args: { where: unknown; select: { id: true }; take?: number }) => Promise<Array<{ id: string }>>;
  updateMany: (args: { where: unknown; data: Record<string, unknown> }) => Promise<{ count: number }>;
};

let storeOverride: DeliveryStore | null = null;

function store(): DeliveryStore {
  if (storeOverride) return storeOverride;
  return (prisma as unknown as { magangApprovalEmailDelivery: DeliveryStore }).magangApprovalEmailDelivery;
}

function retryAt(attempts: number, now: Date): Date {
  return new Date(now.getTime() + Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000));
}

export class MagangApprovalEmailDeliveryService {
  static setStoreForTest(value: DeliveryStore | null): void {
    storeOverride = value;
  }
  static async dispatch(deliveryId: string, now = new Date()): Promise<void> {
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    const claimed = await store().updateMany({
      where: {
        id: deliveryId,
        OR: [
          { status: "QUEUED", nextAttemptAt: { lte: now } },
          { status: "QUEUED", nextAttemptAt: null },
          { status: "PROCESSING", leaseExpiresAt: { lt: now } },
        ],
      },
      data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: now, leaseExpiresAt, nextAttemptAt: null },
    });
    if (claimed.count !== 1) return;

    const delivery = await store().findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== "PROCESSING" || delivery.leaseExpiresAt?.getTime() !== leaseExpiresAt.getTime()) return;
    const loginUrl = `${process.env.APP_URL || "http://localhost:3000"}/login`;
    try {
      const result = await MagangVerificationEmailService.sendApprovalNotification(delivery.recipientEmail, loginUrl);
      await store().updateMany({
        where: { id: delivery.id, status: "PROCESSING", leaseExpiresAt },
        data: { status: result, completedAt: new Date(), leaseExpiresAt: null, nextAttemptAt: null, lastErrorCode: null },
      });
    } catch {
      const attempts = delivery.attempts;
      const terminal = attempts >= MAX_ATTEMPTS;
      await store().updateMany({
        where: { id: delivery.id, status: "PROCESSING", leaseExpiresAt },
        data: terminal
          ? { status: "FAILED", leaseExpiresAt: null, nextAttemptAt: null, lastErrorCode: "DELIVERY_UNAVAILABLE" }
          : { status: "QUEUED", leaseExpiresAt: null, nextAttemptAt: retryAt(attempts, now), lastErrorCode: "DELIVERY_UNAVAILABLE" },
      });
      if (terminal) {
        console.error(
          `[OutboxAlert] Permanent delivery failure: deliveryId=${delivery.id}, attempts=${attempts}, error=DELIVERY_UNAVAILABLE`
        );
      }
    }
  }

  static async recoverDue(now = new Date(), batchSize = 10): Promise<number> {
    const due = await store().findMany({
      where: {
        OR: [
          { status: "QUEUED", nextAttemptAt: { lte: now } },
          { status: "QUEUED", nextAttemptAt: null },
          { status: "PROCESSING", leaseExpiresAt: { lt: now } },
        ],
      },
      take: batchSize,
      select: { id: true },
    });
    for (const delivery of due) {
      await this.dispatch(delivery.id, now);
    }
    return due.length;
  }

  static async requeue(deliveryId: string, now = new Date()): Promise<boolean> {
    const res = await store().updateMany({
      where: { id: deliveryId, status: "FAILED" },
      data: {
        status: "QUEUED",
        attempts: 0,
        nextAttemptAt: now,
        leaseExpiresAt: null,
        lastErrorCode: null,
      },
    });
    return res.count === 1;
  }
}
