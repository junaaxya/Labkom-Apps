import assert from "node:assert/strict";
import test from "node:test";
import { canViewLeaderboardDetail, isCompletedAttendanceStatus } from "../src/services/leaderboard-security";

test("detail leaderboard hanya dapat dibuka oleh pemilik atau Koordinator", () => {
  assert.equal(canViewLeaderboardDetail({ userId: "aslab-1", role: "ASISTEN_LAB" }, "aslab-1"), true);
  assert.equal(canViewLeaderboardDetail({ userId: "aslab-1", role: "ASISTEN_LAB" }, "aslab-2"), false);
  assert.equal(canViewLeaderboardDetail({ userId: "koord-1", role: "KOORDINATOR_LAB" }, "aslab-2"), true);
});

test("hanya attendance final yang dihitung sebagai kehadiran leaderboard", () => {
  assert.equal(isCompletedAttendanceStatus("CHECKED_OUT"), true);
  assert.equal(isCompletedAttendanceStatus("APPROVED"), true);
  for (const status of ["CHECKED_IN", "LATE", "WAITING_VERIFICATION", "FORGOT_CHECKOUT", "ABSENT", "REJECTED"]) {
    assert.equal(isCompletedAttendanceStatus(status), false);
  }
});
