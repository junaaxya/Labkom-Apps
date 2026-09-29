const JAKARTA_OFFSET = "+07:00";
const CHECKIN_OPEN_MINUTES = 60;

export type ShiftWindowReason = "CHECKIN_NOT_OPEN" | "SHIFT_ENDED";

export type ShiftWindow = {
  canCheckin: boolean;
  canCheckout: boolean;
  reason?: ShiftWindowReason;
  opensAt: Date;
  startsAt: Date;
  endsAt: Date;
  checkoutClosesAt: Date;
};

export function jakartaDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function atJakartaTime(date: string, time: string): Date {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Format waktu shift tidak valid");
  }
  return new Date(`${date}T${time}:00${JAKARTA_OFFSET}`);
}

export function evaluateShiftWindow(
  now: Date,
  startTime: string,
  endTime: string,
  checkoutGraceMinutes: number,
  scheduleDate?: Date | string,
): ShiftWindow {
  const date = typeof scheduleDate === "string"
    ? scheduleDate
    : scheduleDate
      ? scheduleDate.toISOString().slice(0, 10)
      : jakartaDate(now);
  const parsedScheduleDate = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedScheduleDate.getTime()) || parsedScheduleDate.toISOString().slice(0, 10) !== date) {
    throw new Error("Tanggal jadwal shift tidak valid");
  }
  const startsAt = atJakartaTime(date, startTime);
  const endsAt = atJakartaTime(date, endTime);
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  }

  const opensAt = new Date(startsAt.getTime() - CHECKIN_OPEN_MINUTES * 60_000);
  const checkoutClosesAt = new Date(endsAt.getTime() + Math.max(0, checkoutGraceMinutes) * 60_000);
  const nowMs = now.getTime();
  const canCheckin = nowMs >= opensAt.getTime() && nowMs <= endsAt.getTime();
  const canCheckout = nowMs >= opensAt.getTime() && nowMs <= checkoutClosesAt.getTime();

  return {
    canCheckin,
    canCheckout,
    reason: canCheckin ? undefined : nowMs < opensAt.getTime() ? "CHECKIN_NOT_OPEN" : "SHIFT_ENDED",
    opensAt,
    startsAt,
    endsAt,
    checkoutClosesAt,
  };
}

export function assertCoordinates(latitude: unknown, longitude: unknown): asserts latitude is number {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Koordinat GPS tidak valid");
  }
}

export function assertRadius(radiusMeter: unknown): asserts radiusMeter is number {
  if (typeof radiusMeter !== "number" || !Number.isInteger(radiusMeter) || radiusMeter < 10 || radiusMeter > 2000) {
    throw new Error("Radius lokasi harus bilangan bulat 10-2000 meter");
  }
}

function pickFields(input: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field];
  }
  return output;
}

export function pickAttendanceLocationUpdate(input: Record<string, unknown>): Record<string, unknown> {
  return pickFields(input, ["name", "latitude", "longitude", "radiusMeter", "isActive"]);
}

export function pickShiftScheduleUpdate(input: Record<string, unknown>): Record<string, unknown> {
  return pickFields(input, ["status", "notes", "destination"]);
}

const DAILY_TASK_UPDATE_FIELDS = [
  "task",
  "description",
  "category",
  "categoryConfigId",
  "photoUrl",
  "duration",
  "labId",
  "relatedTicketId",
  "relatedMissionId",
  "relatedScheduleId",
] as const;

export function pickDailyTaskUpdate(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of DAILY_TASK_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) output[field] = input[field];
  }
  return output;
}

type AttendanceCorrectionInput = {
  requestType: string;
  newValue?: string | null;
  checkinAt?: Date | null;
  checkoutAt?: Date | null;
  createdAt: Date;
};

const CORRECTABLE_STATUSES = new Set([
  "CHECKED_IN", "LATE", "CHECKED_OUT", "WAITING_VERIFICATION",
  "FORGOT_CHECKOUT", "ABSENT", "SICK", "PERMISSION",
]);

function parseCorrectionTime(value: string | null | undefined, referenceDate: Date): Date {
  if (!value) throw new Error("Nilai waktu koreksi wajib diisi");
  const businessDate = jakartaDate(referenceDate);
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return atJakartaTime(businessDate, value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Nilai waktu koreksi tidak valid");
  if (jakartaDate(parsed) !== businessDate) throw new Error("Tanggal koreksi harus sama dengan tanggal absensi");
  return parsed;
}

export function buildAttendanceCorrection(input: AttendanceCorrectionInput): Record<string, unknown> {
  const referenceDate = input.checkinAt ?? input.createdAt;
  const update: Record<string, unknown> = {};
  let checkinAt = input.checkinAt ?? null;
  let checkoutAt = input.checkoutAt ?? null;

  if (input.requestType === "CHECKIN_TIME") {
    checkinAt = parseCorrectionTime(input.newValue, referenceDate);
    update.checkinAt = checkinAt;
  } else if (input.requestType === "CHECKOUT_TIME" || input.requestType === "FORGOT_CHECKOUT") {
    checkoutAt = parseCorrectionTime(input.newValue, referenceDate);
    update.checkoutAt = checkoutAt;
    update.status = "CHECKED_OUT";
  } else if (input.requestType === "STATUS_CORRECTION") {
    if (!input.newValue || !CORRECTABLE_STATUSES.has(input.newValue)) throw new Error("Status koreksi tidak valid");
    update.status = input.newValue;
    if (["CHECKED_OUT", "WAITING_VERIFICATION"].includes(input.newValue) && !checkoutAt) {
      throw new Error("Status tersebut memerlukan waktu check-out");
    }
    if (["CHECKED_IN", "LATE"].includes(input.newValue) && !checkinAt) {
      throw new Error("Status tersebut memerlukan waktu check-in");
    }
    if (["ABSENT", "SICK", "PERMISSION"].includes(input.newValue)) {
      update.checkinAt = null;
      update.checkoutAt = null;
      update.workDurationMinutes = null;
      checkinAt = null;
      checkoutAt = null;
    }
  } else if (input.requestType !== "LOCATION_ERROR") {
    throw new Error("Tipe koreksi tidak valid");
  }

  if (checkinAt && checkoutAt) {
    const duration = Math.round((checkoutAt.getTime() - checkinAt.getTime()) / 60_000);
    if (duration < 0) throw new Error("Waktu check-out tidak boleh lebih awal dari check-in");
    update.workDurationMinutes = duration;
  }
  return update;
}
