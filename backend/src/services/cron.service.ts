import cron from "node-cron";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { PCService } from "./pc.service";
import { MissionService } from "./mission.service";
import { AttendanceService, ShiftScheduleService } from "./attendance.service";

const DAYS_MAP: Record<string, number> = {
  MINGGU: 0,
  SENIN: 1,
  SELASA: 2,
  RABU: 3,
  KAMIS: 4,
  JUMAT: 5,
  SABTU: 6,
};

function getCurrentDayEnum(): string {
  const dayIndex = new Date().getDay();
  return Object.entries(DAYS_MAP).find(([, v]) => v === dayIndex)?.[0] || "SENIN";
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

async function checkScheduleReminders() {
  const now = new Date();
  const currentDay = getCurrentDayEnum();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = currentMinutes + 15;

  const schedules = await prisma.schedule.findMany({
    where: {
      day: currentDay as any,
      isActive: true,
      status: "SCHEDULED",
    },
    include: {
      lab: { select: { name: true } },
      assistant: { select: { id: true } },
    },
  });

  for (const schedule of schedules) {
    const startMinutes = timeToMinutes(schedule.startTime);
    if (startMinutes >= targetMinutes - 1 && startMinutes <= targetMinutes + 1) {
      const recipients: string[] = [];
      if (schedule.assistant?.id) recipients.push(schedule.assistant.id);

      for (const userId of recipients) {
        await notificationService.notifyScheduleReminder(
          userId,
          schedule.title,
          schedule.lab.name,
          schedule.startTime
        );
      }
    }
  }
}

async function checkKeyNotReturned() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const overdueKeys = await prisma.key.findMany({
    where: {
      status: "BORROWED",
      currentHolderId: { not: null },
      updatedAt: { lt: twoHoursAgo },
    },
    include: {
      lab: { select: { name: true } },
    },
  });

  for (const key of overdueKeys) {
    if (key.currentHolderId) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: key.currentHolderId,
          type: "KEY_NOT_RETURNED",
          createdAt: { gt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
          metadata: { path: ["keyCode"], equals: key.keyCode },
        },
      });

      if (!alreadyNotified) {
        await notificationService.notifyKeyNotReturned(
          key.currentHolderId,
          key.keyCode,
          key.lab.name
        );
      }
    }
  }
}

async function checkAttendanceReminder() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDay = getCurrentDayEnum();
  if (currentDay === "MINGGU" || currentDay === "SABTU") return;

  const assistants = await prisma.user.findMany({
    where: { role: "ASISTEN_LAB", isActive: true },
    select: { id: true },
  });

  for (const asleb of assistants) {
    const todayAttendance = await prisma.attendance.findFirst({
      where: {
        userId: asleb.id,
        createdAt: { gte: today },
      },
    });

    if (!todayAttendance) {
      const alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: asleb.id,
          type: "ATTENDANCE_REMINDER",
          createdAt: { gte: today },
        },
      });

      if (!alreadyNotified) {
        await notificationService.notifyAttendanceReminder(asleb.id);
      }
    }
  }
}

async function checkForgotCheckout() {
  const stale = await AttendanceService.markForgotCheckout();
  if (stale.length === 0) return;

  const userIds = [...new Set(stale.map((s) => s.userId))];
  if (userIds.length === 0) return;

  await notificationService.createBulk({
    userIds,
    type: "SYSTEM",
    title: "Lupa Check-out",
    message: "Sesi absensi Anda ditandai sebagai lupa check-out. Hubungi koordinator jika perlu koreksi.",
    metadata: { source: "forgot-checkout-cron", count: stale.length },
  });
}

async function cleanupOldNotifications() {
  await notificationService.cleanup(30);
}

async function checkPcAgentOffline() {
  const stalePCs = await PCService.markStaleAgentsOffline();
  if (stalePCs.length === 0) return;

  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["KOORDINATOR_LAB", "ASISTEN_LAB"] },
    },
    select: { id: true },
  });

  const userIds = recipients.map((user) => user.id);
  if (userIds.length === 0) return;

  const title = stalePCs.length === 1 ? "PC Agent Offline" : `${stalePCs.length} PC Agent Offline`;
  const message =
    stalePCs.length === 1
      ? `${stalePCs[0].pcCode} (${stalePCs[0].name}) di ${stalePCs[0].lab.name} offline lebih dari 90 detik.`
      : `${stalePCs.length} PC agent offline lebih dari 90 detik. Cek halaman PC Monitoring.`;

  await notificationService.createBulk({
    userIds,
    type: "SYSTEM",
    title,
    message,
    metadata: {
      source: "pc-agent-offline-cron",
      pcIds: stalePCs.map((pc) => pc.id),
      pcCodes: stalePCs.map((pc) => pc.pcCode),
      count: stalePCs.length,
    },
  });
}

async function maintainRecurringPicketHorizon() {
  const result = await ShiftScheduleService.maintainRecurringPicketHorizon();
  if (result.createdCount > 0 || result.skippedDates.length > 0) {
    console.log(`[CRON] Recurring picket horizon: ${result.createdCount} jadwal ditambahkan, ${result.skippedDates.length} tanggal dilewati`);
  }
}

export function startCronJobs() {
  // Every minute: mark stale PC agents offline and notify operators once per offline transition
  cron.schedule("* * * * *", () => {
    checkPcAgentOffline().catch(console.error);
  });

  // Every 5 minutes: check schedule reminders
  cron.schedule("*/5 * * * *", () => {
    checkScheduleReminders().catch(console.error);
  });

  // Every 15 minutes: mark stale check-ins as forgot checkout and notify
  cron.schedule("*/15 * * * *", () => {
    checkForgotCheckout().catch(console.error);
  });

  // Every 30 minutes: check keys not returned
  cron.schedule("*/30 * * * *", () => {
    checkKeyNotReturned().catch(console.error);
  });

  // Weekdays at 08:30: attendance reminder
  cron.schedule("30 8 * * 1-5", () => {
    checkAttendanceReminder().catch(console.error);
  });

  // Daily at 02:00: cleanup old notifications
  cron.schedule("0 2 * * *", () => {
    cleanupOldNotifications().catch(console.error);
  });

  // Daily at 01:00: expire overdue missions
  cron.schedule("0 1 * * *", () => {
    MissionService.expireOverdueMissions().catch(console.error);
  });

  cron.schedule("15 1 * * *", () => {
    maintainRecurringPicketHorizon().catch(console.error);
  });

  console.log("[CRON] Scheduled jobs started");
}
