import assert from "node:assert/strict";
import test from "node:test";
import { attendancePointAwards } from "../src/services/attendance-gamification";

test("attendance selesai yang tepat waktu memperoleh poin sekali untuk setiap jenis award", () => {
  assert.deepEqual(
    attendancePointAwards({ attendanceId: "att-1", status: "CHECKED_OUT", checkedInStatus: "CHECKED_IN" }),
    [
      { amount: 5, reason: "Kehadiran shift selesai", referenceId: "attendance:att-1:completed" },
      { amount: 2, reason: "Bonus datang tepat waktu", referenceId: "attendance:att-1:on-time" },
    ]
  );
});

test("attendance terlambat hanya memperoleh poin kehadiran selesai", () => {
  assert.deepEqual(
    attendancePointAwards({ attendanceId: "att-2", status: "CHECKED_OUT", checkedInStatus: "LATE" }),
    [{ amount: 5, reason: "Kehadiran shift selesai", referenceId: "attendance:att-2:completed" }]
  );
});

test("attendance yang belum selesai atau bermasalah tidak memperoleh poin", () => {
  for (const status of ["CHECKED_IN", "WAITING_VERIFICATION", "FORGOT_CHECKOUT", "ABSENT", "SICK", "PERMISSION", "REJECTED"]) {
    assert.deepEqual(attendancePointAwards({ attendanceId: "att-3", status, checkedInStatus: "CHECKED_IN" }), []);
  }
});
