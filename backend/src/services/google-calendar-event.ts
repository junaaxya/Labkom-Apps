import { createHash } from "node:crypto";

export type CalendarSchedule = {
  id: string;
  title: string;
  labName: string;
  day: string;
  startTime: string;
  endTime: string;
  semester?: string;
};

const DAY_INDEX: Record<string, number> = {
  MINGGU: 0,
  SENIN: 1,
  SELASA: 2,
  RABU: 3,
  KAMIS: 4,
  JUMAT: 5,
  SABTU: 6,
};

function wibParts(now: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function hhmmToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Format waktu Calendar tidak valid: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function dateOnlyAfterDays(parts: ReturnType<typeof wibParts>, days: number): string {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function buildGoogleCalendarEventId(userId: string, scheduleId: string): string {
  return `labkom${createHash("sha256").update(`${userId}:${scheduleId}`).digest("hex")}`;
}

export function buildGoogleCalendarEvent(userId: string, schedule: CalendarSchedule, now = new Date()) {
  const current = wibParts(now);
  const currentDay = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const targetDay = DAY_INDEX[schedule.day];
  if (targetDay === undefined) throw new Error(`Hari Calendar tidak valid: ${schedule.day}`);

  const startMinutes = hhmmToMinutes(schedule.startTime);
  hhmmToMinutes(schedule.endTime);
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0 && startMinutes < current.hour * 60 + current.minute) daysUntil = 7;
  const date = dateOnlyAfterDays(current, daysUntil);

  return {
    id: buildGoogleCalendarEventId(userId, schedule.id),
    summary: `[Labkom] ${schedule.title}`,
    location: schedule.labName,
    description: `Jadwal Lab: ${schedule.title}\nLab: ${schedule.labName}\nSemester: ${schedule.semester || "-"}`,
    start: { dateTime: `${date}T${schedule.startTime}:00+07:00`, timeZone: "Asia/Jakarta" },
    end: { dateTime: `${date}T${schedule.endTime}:00+07:00`, timeZone: "Asia/Jakarta" },
    recurrence: ["RRULE:FREQ=WEEKLY;COUNT=16"],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "popup", minutes: 10 },
      ],
    },
    extendedProperties: {
      private: {
        labkomScheduleId: schedule.id,
        labkomUserHash: createHash("sha256").update(userId).digest("hex").slice(0, 24),
      },
    },
  };
}
