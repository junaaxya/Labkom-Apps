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

const bookingRoutes = readFileSync(path.join(__dirname, "booking.routes.ts"), "utf8");
const accessRequestRoutes = readFileSync(path.join(__dirname, "access-request.routes.ts"), "utf8");

function assertCoordinatorOnlyReviewGuard(): void {
  assert.equal(runAuthorization(["KOORDINATOR_LAB"], "KOORDINATOR_LAB").nextCalled, true);

  for (const role of ["ASISTEN_LAB", "MAHASISWA", "MAGANG"]) {
    const result = runAuthorization(["KOORDINATOR_LAB"], role);
    assert.equal(result.status, 403, role);
    assert.equal(result.nextCalled, false, role);
  }

  const missingUser = runAuthorization(["KOORDINATOR_LAB"]);
  assert.equal(missingUser.status, 401);
  assert.equal(missingUser.nextCalled, false);
}

test("booking approval and rejection routes allow only coordinators", () => {
  assert.match(bookingRoutes, /router\.get\("\/", authenticate, authorize\("KOORDINATOR_LAB", "ASISTEN_LAB"\), BookingController\.getAllBookings\);/);
  assert.match(bookingRoutes, /router\.patch\("\/:id\/approve", authenticate, authorize\("KOORDINATOR_LAB"\), BookingController\.approveBooking\);/);
  assert.match(bookingRoutes, /router\.patch\("\/:id\/reject", authenticate, authorize\("KOORDINATOR_LAB"\), BookingController\.rejectBooking\);/);
  assertCoordinatorOnlyReviewGuard();
});

test("access-request review route allows only coordinators and preserves public/read routes", () => {
  assert.match(accessRequestRoutes, /router\.get\("\/labs", AccessRequestController\.getPublicLabs\);/);
  assert.match(accessRequestRoutes, /router\.post\("\/", AccessRequestController\.create\);/);
  assert.match(accessRequestRoutes, /router\.get\("\/check\/:requestCode", AccessRequestController\.getByCode\);/);
  assert.match(accessRequestRoutes, /router\.get\("\/", authenticate, authorize\("KOORDINATOR_LAB", "ASISTEN_LAB"\), AccessRequestController\.getAll\);/);
  assert.match(accessRequestRoutes, /router\.get\("\/:id", authenticate, authorize\("KOORDINATOR_LAB", "ASISTEN_LAB"\), AccessRequestController\.getById\);/);
  assert.match(accessRequestRoutes, /router\.patch\("\/:id\/status", authenticate, authorize\("KOORDINATOR_LAB"\), AccessRequestController\.review\);/);
  assertCoordinatorOnlyReviewGuard();
});
