import prisma from "../config/database";
import { NotificationType, Prisma } from "@prisma/client";
import { sseManager } from "./sse.service";
import { whatsappService } from "./whatsapp.service";
import { webPushService } from "./web-push.service";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  reminderKey?: string;
}

interface CreateBulkNotificationInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

class NotificationService {
  /**
   * Create a single notification
   */
  async create(input: CreateNotificationInput) {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        reminderKey: input.reminderKey,
      },
    });

    sseManager.sendToUser(input.userId, "notification", notification);

    whatsappService.sendNotification(input.userId, input.title, input.message).catch(() => {});
    webPushService.sendToUser(input.userId, notification).catch(() => {});

    return notification;
  }

  /**
   * Create notifications for multiple users (bulk)
   */
  async createBulk(input: CreateBulkNotificationInput) {
    const data = input.userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    }));

    const result = await prisma.notification.createMany({ data });

    for (const userId of input.userIds) {
      sseManager.sendToUser(userId, "notification", {
        type: input.type,
        title: input.title,
        message: input.message,
      });
    }

    whatsappService.sendBulkNotification(input.userIds, input.title, input.message).catch(() => {});
    webPushService
      .sendToUsers(input.userIds, {
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? null,
      })
      .catch(() => {});

    return result;
  }

  async notifyShiftAssigned(input: {
    userId: string;
    destinationLabel: string;
    scheduleDate: string;
    shiftName: string;
    count?: number;
  }) {
    const dateText = input.count && input.count > 1
      ? `${input.count} jadwal baru`
      : input.scheduleDate;

    return this.create({
      userId: input.userId,
      type: "ATTENDANCE_REMINDER",
      title: "Jadwal Piket Baru",
      message: `Anda ditugaskan piket ${input.destinationLabel} pada ${dateText} shift ${input.shiftName}.`,
      metadata: {
        source: "shift-assignment",
        link: "/attendance/shifts",
        destination: input.destinationLabel,
        scheduleDate: input.scheduleDate,
        shiftName: input.shiftName,
        count: input.count ?? 1,
      },
    });
  }

  async notifyPicketReminder(input: {
    userId: string;
    scheduleId: string;
    scheduleDate: string;
    destinationLabel: string;
    shiftName: string;
    startTime: string;
    reminderKind: "60M";
  }) {
    const reminderKey = `picket:${input.scheduleId}:${input.reminderKind}`;
    try {
      return await this.create({
        userId: input.userId,
        type: "ATTENDANCE_REMINDER",
        title: "Piket Dimulai 60 Menit Lagi",
        message: `Piket ${input.destinationLabel} shift ${input.shiftName} dimulai pukul ${input.startTime}.`,
        reminderKey,
        metadata: {
          source: "picket-reminder",
          scheduleId: input.scheduleId,
          scheduleDate: input.scheduleDate,
          reminderKind: input.reminderKind,
          link: "/attendance/shifts",
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ) {
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  /**
   * Delete old notifications (cleanup, older than 30 days)
   */
  async cleanup(daysOld: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    return prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        isRead: true,
      },
    });
  }

  // ============================================
  // EVENT-BASED NOTIFICATION TRIGGERS
  // ============================================

  /**
   * Notify when a ticket is assigned to someone
   */
  async notifyTicketAssigned(assigneeId: string, ticketTitle: string, ticketId: string) {
    return this.create({
      userId: assigneeId,
      type: "TICKET_ASSIGNED",
      title: "Ticket Baru Ditugaskan",
      message: `Anda ditugaskan untuk menangani ticket: "${ticketTitle}"`,
      metadata: { ticketId, link: `/tickets` },
    });
  }

  /**
   * Notify when a ticket is resolved
   */
  async notifyTicketResolved(reporterId: string, ticketTitle: string, ticketId: string) {
    return this.create({
      userId: reporterId,
      type: "TICKET_RESOLVED",
      title: "Ticket Selesai",
      message: `Ticket "${ticketTitle}" telah diselesaikan`,
      metadata: { ticketId, link: `/tickets` },
    });
  }

  /**
   * Notify when a new mission is available
   */
  async notifyMissionAvailable(missionTitle: string, missionId: string) {
    // Notify all ASISTEN_LAB
    const assistants = await prisma.user.findMany({
      where: { role: "ASISTEN_LAB", isActive: true },
      select: { id: true },
    });

    if (assistants.length === 0) return;

    return this.createBulk({
      userIds: assistants.map((a) => a.id),
      type: "MISSION_AVAILABLE",
      title: "Misi Baru Tersedia",
      message: `Misi baru: "${missionTitle}" — Segera claim!`,
      metadata: { missionId, link: `/missions` },
    });
  }

  /**
   * Notify when a mission claim is verified
   */
  async notifyMissionVerified(
    aslebId: string,
    missionTitle: string,
    approved: boolean,
    points?: number
  ) {
    return this.create({
      userId: aslebId,
      type: "MISSION_VERIFIED",
      title: approved ? "Misi Disetujui! 🎉" : "Misi Ditolak",
      message: approved
        ? `Misi "${missionTitle}" disetujui! +${points || 0} poin`
        : `Misi "${missionTitle}" ditolak. Silakan coba lagi.`,
      metadata: { link: `/missions` },
    });
  }

  /**
   * Notify when logbook is verified
   */
  async notifyConditionVerified(userId: string, labName: string) {
    return this.create({
      userId,
      type: "LOGBOOK_VERIFIED",
      title: "Kondisi Lab Diverifikasi",
      message: `Kondisi ${labName} telah diverifikasi oleh Asisten Lab.`,
      metadata: { link: `/logbook` },
    });
  }

  /**
   * Notify when certificate is issued
   */
  async notifyCertificateIssued(userId: string, certTitle: string) {
    return this.create({
      userId,
      type: "CERTIFICATE_ISSUED",
      title: "Sertifikat Baru! 🏆",
      message: `Selamat! Anda mendapatkan sertifikat: "${certTitle}"`,
      metadata: { link: `/certificates` },
    });
  }

  /**
   * Schedule reminder: notify user about upcoming schedule
   */
  async notifyScheduleReminder(userId: string, scheduleTitle: string, labName: string, time: string) {
    return this.create({
      userId,
      type: "SCHEDULE_REMINDER",
      title: "Jadwal Segera Dimulai",
      message: `"${scheduleTitle}" di ${labName} akan dimulai pukul ${time}`,
      metadata: { link: `/schedules` },
    });
  }

  /**
   * Key not returned reminder
   */
  async notifyKeyNotReturned(holderId: string, keyCode: string, labName: string) {
    return this.create({
      userId: holderId,
      type: "KEY_NOT_RETURNED",
      title: "⚠️ Kunci Belum Dikembalikan",
      message: `Kunci ${keyCode} (${labName}) belum dikembalikan. Segera kembalikan!`,
      metadata: { link: `/keys` },
    });
  }

  /**
   * Attendance reminder for assistant
   */
  async notifyAttendanceReminder(aslebId: string) {
    return this.create({
      userId: aslebId,
      type: "ATTENDANCE_REMINDER",
      title: "Reminder Absensi",
      message: "Anda belum melakukan check-in hari ini. Segera absen!",
      metadata: { link: `/attendance` },
    });
  }
}

export const notificationService = new NotificationService();
