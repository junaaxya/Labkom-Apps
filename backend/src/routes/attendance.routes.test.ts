import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { authorize } from "../middlewares/auth.middleware";

type AuthorizationResult = { status?: number; nextCalled: boolean };

function runAuthorization(roles: string[], role?: string): AuthorizationResult {
  const result: AuthorizationResult = { nextCalled: false };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json() {
      return this;
    },
  };

  authorize(...roles)(
    role ? ({ user: { userId: "user-1", role } } as never) : ({} as never),
    res as never,
    () => { result.nextCalled = true; },
  );

  return result;
}

const source = readFileSync(path.join(__dirname, "attendance.routes.ts"), "utf8");
const controllerSource = readFileSync(path.join(__dirname, "../controllers/attendance.controller.ts"), "utf8");

test("attendance check-in and check-out allow only Asisten Lab and Magang", () => {
  assert.match(source, /router\.post\("\/checkin", authenticate, authorize\("ASISTEN_LAB", "MAGANG"\), attendanceActionLimiter, AttendanceController\.checkin\);/);
  assert.match(source, /router\.post\("\/checkout", authenticate, authorize\("ASISTEN_LAB", "MAGANG"\), attendanceActionLimiter, AttendanceController\.checkout\);/);

  for (const role of ["ASISTEN_LAB", "MAGANG"]) {
    assert.equal(runAuthorization(["ASISTEN_LAB", "MAGANG"], role).nextCalled, true, role);
  }

  for (const route of ["checkin", "checkout"]) {
    const result = runAuthorization(["ASISTEN_LAB", "MAGANG"], "MAHASISWA");
    assert.equal(result.status, 403, route);
    assert.equal(result.nextCalled, false, route);
  }

  assert.equal(runAuthorization(["ASISTEN_LAB", "MAGANG"], "KOORDINATOR_LAB").status, 403);
});

test("attendance routes keep Magang out of coordinator, task, correction, leave, and schedule management", () => {
  assert.match(source, /router\.get\("\/monitoring\/today", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.getTodayMonitoring\);/);
  assert.match(source, /router\.post\("\/tasks", authenticate, authorize\("ASISTEN_LAB"\), AttendanceController\.addDailyTask\);/);
  assert.match(source, /router\.patch\("\/tasks\/:taskId", authenticate, authorize\("ASISTEN_LAB"\), AttendanceController\.updateDailyTask\);/);
  assert.match(source, /router\.post\("\/corrections", authenticate, authorize\("ASISTEN_LAB"\), attendanceMutationLimiter, AttendanceController\.createCorrectionRequest\);/);
  assert.match(source, /router\.post\("\/leaves", authenticate, authorize\("ASISTEN_LAB"\), attendanceMutationLimiter, AttendanceController\.submitLeaveRequest\);/);

  assert.match(source, /router\.get\("\/shift-schedules", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.getShiftSchedules\);/);
  assert.match(source, /router\.post\("\/shift-schedules", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.createShiftSchedule\);/);
  assert.match(source, /router\.post\("\/shift-schedules\/weekly-preview", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.previewWeeklyShiftPlan\);/);
  assert.match(source, /router\.post\("\/shift-schedules\/weekly-plan", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.saveWeeklyShiftPlan\);/);
  assert.match(source, /router\.get\("\/shift-schedules\/recurring-pattern", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.getRecurringShiftPattern\);/);
  assert.match(source, /router\.post\("\/shift-schedules\/recurring-plan", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.saveRecurringShiftPlan\);/);
  assert.match(source, /router\.delete\("\/shift-schedules\/week", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.deleteWeekShiftSchedules\);/);
  assert.match(source, /router\.delete\("\/shift-schedules\/recurring-pattern", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.deleteRecurringShiftPattern\);/);
  assert.match(source, /router\.patch\("\/shift-schedules\/:id", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.updateShiftSchedule\);/);
  assert.match(source, /router\.delete\("\/shift-schedules\/:id", authenticate, authorize\("KOORDINATOR_LAB"\), AttendanceController\.deleteShiftSchedule\);/);

  assert.equal(runAuthorization(["KOORDINATOR_LAB"], "MAGANG").status, 403);
  assert.equal(runAuthorization(["ASISTEN_LAB"], "MAGANG").status, 403);
});

test("coordinator attendance report validates supported role filters", () => {
  assert.match(controllerSource, /const attendanceReportRoles = new Set\(\["ASISTEN_LAB", "MAGANG"\]\)/);
  assert.match(controllerSource, /role !== undefined && !attendanceReportRoles\.has\(role\)/);
  assert.match(controllerSource, /role: role as "ASISTEN_LAB" \| "MAGANG" \| undefined/);
});
