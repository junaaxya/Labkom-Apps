import prisma from "../config/database";
import type { SubscribePushInput } from "../validators/push-subscription.validator";

export class PushSubscriptionService {
  static async upsert(userId: string, subscription: SubscribePushInput, userAgent?: string) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });
  }

  static async remove(userId: string, endpoint: string) {
    return prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  static async findByUser(userId: string) {
    return prisma.pushSubscription.findMany({ where: { userId } });
  }

  static async deleteByEndpoint(endpoint: string) {
    return prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
}
