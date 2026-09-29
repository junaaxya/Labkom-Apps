import { Prisma } from "@prisma/client";
import cron from "node-cron";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { PCService } from "./pc.service";
import { MissionService } from "./mission.service";
import { AttendanceService, AttendanceSettingsService, ShiftScheduleService } from "./attendance.service";
import { evaluateShiftWindow, jakartaDate } from "./attendance-security";

const CRON_OPTIONS = { timezone: "Asia/Jakarta" };

const DAYS_MAP: Record<string, number> = {
  MINGGU: 0,
  SENIN: 1,
  SELASA: 2,
  RABU: 3,
  KAMIS: 4,
  JUMAT: 5,
  SABTU: 6,
};

function getJakartaClock(now: Date): { dayIndex: number; hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const dayIndex = new Date(`${jakartaDate(now)}T00:00:00.000Z`).getUTCDay();
  return { dayIndex, hours: value("hour"), minutes: value("minute") };
}

function getCurrentDayEnum(now = new Date()): string {
  const { dayIndex } = getJakartaClock(now);
  return Object.entries(DAYS_MAP).find(([, v]) => v === dayIndex)?.[0] || "SENIN";
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getPicketDestinationLabel(destination: string | null | undefined): string {
  if (destination === "RUANGAN_ASLAB") return "Ruangan Aslab";
  if (destination === "LAB_MULTIMEDIA") return "Lab Multimedia";
  if (destination === "LAB_DASAR") return "Lab Dasar";
  return "Lokasi piket";
}

async function checkScheduleReminders() {
  const now = new Date();
  const currentDay = getCurrentDayEnum(now);
  const jakartaClock = getJakartaClock(now);
  const currentMinutes = jakartaClock.hours * 60 + jakartaClock.minutes;
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
          schedule.startTime,
          schedule.id,
          jakartaDate(now)
        );
      }
    }
  }
}

async function checkPicketReminders() {
  const schedules = await ShiftScheduleService.getUpcomingPicketReminders(new Date(), 60);
  for (const schedule of schedules) {
    await notificationService.notifyPicketReminder({
      userId: schedule.userId,
      scheduleId: schedule.id,
      scheduleDate: schedule.scheduleDate.toISOString().slice(0, 10),
      destinationLabel: schedule.lab?.name ?? getPicketDestinationLabel(schedule.destination),
      shiftName: schedule.shift.name ?? `${schedule.shift.startTime} - ${schedule.shift.endTime}`,
      startTime: schedule.shift.startTime,
      reminderKind: "60M",
    });
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
  const now = new Date();
  const businessDate = jakartaDate(now);
  const scheduleDate = new Date(`${businessDate}T00:00:00.000Z`);
  const nextScheduleDate = new Date(scheduleDate);
  nextScheduleDate.setUTCDate(nextScheduleDate.getUTCDate() + 1);

  const assignments = await prisma.asLabShiftSchedule.findMany({
    where: {
      scheduleDate: { in: [scheduleDate, nextScheduleDate] },
      status: "SCHEDULED",
      user: { role: "ASISTEN_LAB", isActive: true },
    },
    select: {
      id: true,
      userId: true,
      scheduleDate: true,
      shift: { select: { startTime: true, endTime: true } },
      attendances: { select: { id: true }, take: 1 },
    },
  });

  for (const assignment of assignments) {
    if (assignment.attendances.length > 0) continue;
    const window = evaluateShiftWindow(now, assignment.shift.startTime, assignment.shift.endTime, 0, assignment.scheduleDate);
    if (!window.canCheckin) continue;
    try {
      await notificationService.notifyAttendanceReminder(assignment.userId, assignment.id);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
}

async function checkCheckoutReminders() {
  const now = new Date();
  const settings = await AttendanceSettingsService.get();
  const openAttendances = await prisma.attendance.findMany({
    where: { checkoutAt: null, status: { in: ["CHECKED_IN", "LATE"] }, shiftScheduleId: { not: null } },
    include: { shiftSchedule: { include: { shift: true } } },
  });

  for (const attendance of openAttendances) {
    const schedule = attendance.shiftSchedule;
    if (!schedule) continue;
    const graceMinutes = schedule.shift.checkoutGraceMinutes ?? settings.checkoutGraceMinutes;
    const window = evaluateShiftWindow(now, schedule.shift.startTime, schedule.shift.endTime, graceMinutes, schedule.scheduleDate);
    const beforeEndAt = new Date(window.endsAt.getTime() - 15 * 60_000);
    const send = async (stage: "before-end" | "deadline-passed", title: string, message: string) => {
      try {
        await notificationService.create({
          userId: attendance.userId,
          type: "ATTENDANCE_REMINDER",
          title,
          message,
          reminderKey: `checkout:${attendance.id}:${stage}`,
          metadata: { source: "checkout-reminder", attendanceId: attendance.id, shiftScheduleId: schedule.id, stage, link: "/attendance" },
        });
      } catch (error) {
        // A second cron tick or future additional backend instance may race here.
        // reminderKey is unique; duplicate delivery is intentionally ignored.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      }
    };

    if (now >= beforeEndAt && now < window.endsAt) {
      await send("before-end", "Check-out 15 Menit Lagi", `Shift Anda berakhir pukul ${schedule.shift.endTime}. Selesaikan task dan lakukan check-out sebelum batas waktu.`);
    } else if (now >= window.checkoutClosesAt && now < new Date(window.checkoutClosesAt.getTime() + 5 * 60_000)) {
      await send("deadline-passed", "Batas Check-out Terlewati", "Batas check-out shift Anda telah berakhir. Ajukan koreksi kepada Koordinator bila diperlukan.");
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
  }, CRON_OPTIONS);

  // Every 5 minutes: schedule, picket, and checkout reminders
  cron.schedule("*/5 * * * *", () => {
    checkScheduleReminders().catch(console.error);
    checkPicketReminders().catch(console.error);
    checkAttendanceReminder().catch(console.error);
    checkCheckoutReminders().catch(console.error);
  }, CRON_OPTIONS);

  // Every 15 minutes: mark stale check-ins as forgot checkout and notify
  cron.schedule("*/15 * * * *", () => {
    checkForgotCheckout().catch(console.error);
  }, CRON_OPTIONS);

  // Every 30 minutes: check keys not returned
  cron.schedule("*/30 * * * *", () => {
    checkKeyNotReturned().catch(console.error);
  }, CRON_OPTIONS);


  // Daily at 02:00 WIB: cleanup old notifications
  cron.schedule("0 2 * * *", () => {
    cleanupOldNotifications().catch(console.error);
  }, CRON_OPTIONS);

  // Daily at 01:00 WIB: expire overdue missions
  cron.schedule("0 1 * * *", () => {
    MissionService.expireOverdueMissions().catch(console.error);
  }, CRON_OPTIONS);

  cron.schedule("15 1 * * *", () => {
    maintainRecurringPicketHorizon().catch(console.error);
  }, CRON_OPTIONS);

  console.log("[CRON] Scheduled jobs started (Asia/Jakarta)");
}
