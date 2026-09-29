export const SCHEDULE_DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;

export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];
export type SchedulePeriod = "today" | "tomorrow" | "week";

interface JakartaDateParts {
  day: ScheduleDay;
  dayIndex: number;
  dateLabel: string;
  time: string;
}

export interface ScheduleQuery {
  period: SchedulePeriod;
  days: ScheduleDay[];
  primaryDay: ScheduleDay;
  label: string;
  currentTime: string;
}

function getJakartaParts(date: Date): JakartaDateParts {
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = (parts.weekday || "").toLocaleUpperCase("id-ID") as ScheduleDay;
  const dayIndex = SCHEDULE_DAYS.indexOf(weekday);

  if (dayIndex < 0) throw new Error(`Hari WIB tidak dikenali: ${parts.weekday || "unknown"}`);

  return {
    day: weekday,
    dayIndex,
    dateLabel: `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function detectSchedulePeriod(message: string): SchedulePeriod {
  const normalized = message.toLocaleLowerCase("id-ID");
  if (/minggu\s+ini/.test(normalized)) return "week";
  if (/besok/.test(normalized)) return "tomorrow";
  return "today";
}

export function getScheduleQuery(message: string, now = new Date()): ScheduleQuery {
  const period = detectSchedulePeriod(message);
  const current = getJakartaParts(now);

  if (period === "tomorrow") {
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow = getJakartaParts(tomorrowDate);
    return {
      period,
      days: [tomorrow.day],
      primaryDay: tomorrow.day,
      label: `Besok — ${tomorrow.dateLabel}`,
      currentTime: current.time,
    };
  }

  if (period === "week") {
    return {
      period,
      days: [...SCHEDULE_DAYS],
      primaryDay: current.day,
      label: "Minggu Ini",
      currentTime: current.time,
    };
  }

  return {
    period,
    days: [current.day],
    primaryDay: current.day,
    label: `Hari Ini — ${current.dateLabel}`,
    currentTime: current.time,
  };
}
