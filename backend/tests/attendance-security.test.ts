import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCoordinates,
  assertRadius,
  buildAttendanceCorrection,
  evaluateShiftWindow,
  pickAttendanceLocationUpdate,
  pickDailyTaskUpdate,
  pickShiftScheduleUpdate,
} from "../src/services/attendance-security";

test("shift window membolehkan check-in satu jam sebelum mulai", () => {
  const result = evaluateShiftWindow(new Date("2026-08-26T00:15:00.000Z"), "08:00", "16:00", 30);
  assert.equal(result.canCheckin, true);
  assert.equal(result.canCheckout, true);
});

test("shift window menolak check-in terlalu awal dan setelah shift", () => {
  const tooEarly = evaluateShiftWindow(new Date("2026-08-25T23:59:00.000Z"), "08:00", "16:00", 30);
  const afterShift = evaluateShiftWindow(new Date("2026-08-26T09:01:00.000Z"), "08:00", "16:00", 30);
  assert.equal(tooEarly.canCheckin, false);
  assert.equal(tooEarly.reason, "CHECKIN_NOT_OPEN");
  assert.equal(afterShift.canCheckin, false);
  assert.equal(afterShift.reason, "SHIFT_ENDED");
});

test("checkout diberi grace period setelah shift", () => {
  const withinGrace = evaluateShiftWindow(new Date("2026-08-26T09:20:00.000Z"), "08:00", "16:00", 30);
  const expired = evaluateShiftWindow(new Date("2026-08-26T09:31:00.000Z"), "08:00", "16:00", 30);
  assert.equal(withinGrace.canCheckout, true);
  assert.equal(expired.canCheckout, false);
});

test("shift malam memakai scheduleDate dan tetap aktif setelah tengah malam", () => {
  const afterMidnight = new Date("2026-08-26T18:00:00.000Z"); // 27 Aug 01:00 WIB
  const result = evaluateShiftWindow(afterMidnight, "22:00", "06:00", 30, "2026-08-26");
  assert.equal(result.startsAt.toISOString(), "2026-08-26T15:00:00.000Z");
  assert.equal(result.endsAt.toISOString(), "2026-08-26T23:00:00.000Z");
  assert.equal(result.canCheckin, true);
  assert.equal(result.canCheckout, true);
});

test("shift malam tidak dipindahkan ke tanggal hari ini saat scheduleDate diberikan", () => {
  const now = new Date("2026-08-26T18:00:00.000Z");
  const wrongDay = evaluateShiftWindow(now, "22:00", "06:00", 30, "2026-08-27");
  assert.equal(wrongDay.canCheckin, false);
  assert.equal(wrongDay.reason, "CHECKIN_NOT_OPEN");
});

test("koordinat hanya menerima angka finite dalam rentang bumi", () => {
  assert.doesNotThrow(() => assertCoordinates(-6.2, 106.8));
  assert.throws(() => assertCoordinates(Number.NaN, 106.8), /Koordinat/);
  assert.throws(() => assertCoordinates(91, 106.8), /Koordinat/);
});

test("radius lokasi divalidasi dan update lokasi/jadwal memakai allowlist", () => {
  assert.doesNotThrow(() => assertRadius(100));
  assert.throws(() => assertRadius(0), /Radius/);
  assert.deepEqual(pickAttendanceLocationUpdate({ name: "Lab", radiusMeter: 100, createdAt: "hack", id: "hack" }), {
    name: "Lab", radiusMeter: 100,
  });
  assert.deepEqual(pickShiftScheduleUpdate({ status: "CANCELLED", notes: "izin", userId: "attacker", shiftId: "hack" }), {
    status: "CANCELLED", notes: "izin",
  });
});

test("allowlist update task membuang field ownership dan review", () => {
  const result = pickDailyTaskUpdate({
    task: "Periksa komputer",
    description: "PC 01",
    userId: "attacker",
    attendanceId: "foreign-attendance",
    reviewedBy: "attacker",
    status: "APPROVED",
  });
  assert.deepEqual(result, {
    task: "Periksa komputer",
    description: "PC 01",
  });
});

test("koreksi menolak checkout sebelum checkin dan status liar", () => {
  const base = new Date("2026-08-26T01:00:00.000Z");
  assert.throws(() => buildAttendanceCorrection({
    requestType: "CHECKOUT_TIME", newValue: "07:00", checkinAt: base, createdAt: base,
  }), /lebih awal/);
  assert.throws(() => buildAttendanceCorrection({
    requestType: "STATUS_CORRECTION", newValue: "HACKED", createdAt: base,
  }), /Status koreksi/);
});

test("koreksi waktu tetap pada tanggal bisnis Jakarta", () => {
  const base = new Date("2026-08-26T01:00:00.000Z");
  const update = buildAttendanceCorrection({
    requestType: "CHECKOUT_TIME", newValue: "16:00", checkinAt: base, createdAt: base,
  });
  assert.equal((update.checkoutAt as Date).toISOString(), "2026-08-26T09:00:00.000Z");
  assert.equal(update.workDurationMinutes, 480);
  assert.equal(update.status, "CHECKED_OUT");
});

test("koreksi status menjaga kompatibilitas timestamp", () => {
  const base = new Date("2026-08-26T01:00:00.000Z");
  assert.throws(() => buildAttendanceCorrection({
    requestType: "STATUS_CORRECTION", newValue: "CHECKED_OUT", checkinAt: base, createdAt: base,
  }), /memerlukan waktu check-out/);
  const absent = buildAttendanceCorrection({
    requestType: "STATUS_CORRECTION", newValue: "ABSENT", checkinAt: base,
    checkoutAt: new Date("2026-08-26T09:00:00.000Z"), createdAt: base,
  });
  assert.deepEqual(absent, { status: "ABSENT", checkinAt: null, checkoutAt: null, workDurationMinutes: null });
});
