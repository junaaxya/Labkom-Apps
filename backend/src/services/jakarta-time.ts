export const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;

export type JakartaDayOfWeek = (typeof dayNames)[number];

export type JakartaClock = {
  readonly date: Date;
  readonly day: JakartaDayOfWeek;
  readonly time: string;
};

const jakartaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function dateOnlyText(value: Date): string {
  return canonicalDateOnly(value).toISOString().slice(0, 10);
}

export function canonicalDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function weekdayForDateOnly(value: Date): JakartaDayOfWeek {
  return dayNames[canonicalDateOnly(value).getUTCDay()];
}

export function getJakartaClock(instant = new Date()): JakartaClock {
  const parts = jakartaFormatter.formatToParts(instant);
  const year = Number(formatPart(parts, "year"));
  const month = Number(formatPart(parts, "month"));
  const day = Number(formatPart(parts, "day"));
  const hours = formatPart(parts, "hour");
  const minutes = formatPart(parts, "minute");
  const date = new Date(Date.UTC(year, month - 1, day));

  return { date, day: weekdayForDateOnly(date), time: `${hours}:${minutes}` };
}

export function dateOnlyRange(value: Date): { start: Date; end: Date } {
  const start = canonicalDateOnly(value);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function jakartaTimestampRangeForDateOnly(value: Date): { start: Date; end: Date } {
  const start = new Date(`${dateOnlyText(value)}T00:00:00.000+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function jakartaDateTime(dateOnly: Date, time: string, endOfMinute = false): Date {
  return new Date(`${dateOnlyText(dateOnly)}T${time}:${endOfMinute ? "59.999" : "00.000"}+07:00`);
}
