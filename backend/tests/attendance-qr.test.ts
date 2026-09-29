import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { AttendanceQrService } from "../src/services/attendance-qr.service";
import { config } from "../src/config";

function token(overrides: Record<string, unknown> = {}, expiresIn = "30s") {
  return jwt.sign({
    type: "ATTENDANCE_QR",
    locationId: "loc-1",
    nonce: "nonce-1",
    ...overrides,
  }, config.jwtSecret, { audience: "labkom-attendance", expiresIn: expiresIn as any });
}

test("QR absensi menerima payload sah dan terikat lokasi", () => {
  const payload = AttendanceQrService.verify(token());
  assert.equal(payload.locationId, "loc-1");
  assert.equal(payload.nonce, "nonce-1");
});

test("QR absensi menolak audience dan tipe payload yang salah", () => {
  const wrongAudience = jwt.sign({ type: "ATTENDANCE_QR", locationId: "loc-1", nonce: "n" }, config.jwtSecret, { audience: "other", expiresIn: "30s" });
  assert.throws(() => AttendanceQrService.verify(wrongAudience), /tidak valid/);
  assert.throws(() => AttendanceQrService.verify(token({ type: "OTHER" })), /tidak valid/);
});

test("QR absensi menolak token kedaluwarsa", () => {
  assert.throws(() => AttendanceQrService.verify(token({}, "-1s")), /kedaluwarsa/);
});
