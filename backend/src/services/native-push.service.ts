import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import prisma from "../config/database";

function metadataLink(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "/notifications";
  const link = (metadata as Record<string, unknown>).link;
  return typeof link === "string" && link.startsWith("/") ? link : "/notifications";
}

function firebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawCredentials) {
    const serviceAccount = JSON.parse(rawCredentials) as ServiceAccount;
    return initializeApp({ credential: cert(serviceAccount) });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }
  return null;
}

class NativePushService {
  isEnabled(): boolean {
    return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  async register(userId: string, input: { token: string; platform: string; deviceName?: string }): Promise<void> {
    await prisma.nativePushToken.upsert({
      where: { token: input.token },
      create: { userId, token: input.token, platform: input.platform, deviceName: input.deviceName },
      update: { userId, platform: input.platform, deviceName: input.deviceName, lastSeenAt: new Date() },
    });
  }

  async unregister(userId: string, token: string): Promise<void> {
    await prisma.nativePushToken.deleteMany({ where: { userId, token } });
  }

  async sendToUser(userId: string, notification: { id?: string; type: string; title: string; message: string; metadata?: unknown }): Promise<void> {
    const app = firebaseApp();
    if (!app) return;
    const tokens = await prisma.nativePushToken.findMany({ where: { userId }, select: { token: true } });
    if (tokens.length === 0) return;

    const result = await getMessaging(app).sendEachForMulticast({
      tokens: tokens.map((item) => item.token),
      notification: { title: notification.title, body: notification.message },
      data: {
        notificationId: notification.id || "",
        type: notification.type,
        link: metadataLink(notification.metadata),
      },
      android: { priority: "high", notification: { channelId: "labkom_notifications", sound: "default" } },
    });

    const invalidTokens = result.responses.flatMap((response, index) => {
      if (response.success) return [];
      const code = response.error?.code;
      return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token"
        ? [tokens[index].token]
        : [];
    });
    if (invalidTokens.length > 0) await prisma.nativePushToken.deleteMany({ where: { token: { in: invalidTokens } } });
  }

  async sendToUsers(userIds: string[], notification: { type: string; title: string; message: string; metadata?: unknown }): Promise<void> {
    await Promise.all(userIds.map((userId) => this.sendToUser(userId, notification)));
  }
}

export const nativePushService = new NativePushService();
