import webpush, { WebPushError } from "web-push";
import type { Notification, NotificationType, Prisma } from "@prisma/client";
import { config } from "../config";
import { PushSubscriptionService } from "./push-subscription.service";

type PushPayload = {
  id?: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.JsonValue | Record<string, unknown> | null;
};

function metadataLink(metadata: PushPayload["metadata"]): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "/notifications";
  const link = (metadata as Record<string, unknown>).link;
  return typeof link === "string" && link.startsWith("/") ? link : "/notifications";
}

function isGone(error: unknown): boolean {
  return error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410);
}

class WebPushService {
  private configured = false;

  constructor() {
    if (config.vapidPublicKey && config.vapidPrivateKey) {
      webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
      this.configured = true;
    }
  }

  isEnabled(): boolean {
    return this.configured;
  }

  getPublicKey(): string {
    return config.vapidPublicKey;
  }

  async sendToUser(userId: string, notification: Notification | PushPayload) {
    if (!this.configured) return;

    const subscriptions = await PushSubscriptionService.findByUser(userId);
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      type: notification.type,
      data: {
        notificationId: "id" in notification ? notification.id : undefined,
        type: notification.type,
        link: metadataLink(notification.metadata),
      },
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload
          );
        } catch (error) {
          if (isGone(error)) {
            await PushSubscriptionService.deleteByEndpoint(subscription.endpoint);
            return;
          }
          console.warn("[WebPush] Failed to send notification", {
            endpoint: subscription.endpoint.slice(0, 48),
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      })
    );
  }

  async sendToUsers(userIds: string[], notification: PushPayload) {
    await Promise.all(userIds.map((userId) => this.sendToUser(userId, notification)));
  }
}

export const webPushService = new WebPushService();
