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

const keyRoutes = readFileSync(path.join(__dirname, "key.routes.ts"), "utf8");
const logbookRoutes = readFileSync(path.join(__dirname, "logbook.routes.ts"), "utf8");

test("key and official logbook transition route matrix preserves class-leader service checks and coordinator force return", () => {
  assert.match(keyRoutes, /router\.patch\("\/:id\/take", authenticate, KeyController\.takeKey\);/);
  assert.match(keyRoutes, /router\.patch\("\/:id\/return", authenticate, KeyController\.returnKey\);/);
  assert.match(keyRoutes, /router\.patch\("\/:id\/force-return", authenticate, authorize\("KOORDINATOR_LAB"\), KeyController\.forceReturnKey\);/);
  assert.match(logbookRoutes, /router\.post\("\/checkin", authenticate, authorize\("ASISTEN_LAB", "KOORDINATOR_LAB"\), LogbookController\.checkin\);/);
  assert.match(logbookRoutes, /router\.patch\("\/:id\/checkout", authenticate, authorize\("ASISTEN_LAB", "KOORDINATOR_LAB"\), LogbookController\.checkout\);/);

  for (const role of ["KOORDINATOR_LAB", "ASISTEN_LAB"]) {
    assert.equal(runAuthorization(["ASISTEN_LAB", "KOORDINATOR_LAB"], role).nextCalled, true, role);
  }
  for (const role of ["MAHASISWA", "MAGANG"]) {
    const officialTransition = runAuthorization(["ASISTEN_LAB", "KOORDINATOR_LAB"], role);
    assert.equal(officialTransition.status, 403, role);
    assert.equal(officialTransition.nextCalled, false, role);
  }
  for (const role of ["ASISTEN_LAB", "MAHASISWA", "MAGANG"]) {
    const forceReturn = runAuthorization(["KOORDINATOR_LAB"], role);
    assert.equal(forceReturn.status, 403, role);
    assert.equal(forceReturn.nextCalled, false, role);
  }
  assert.equal(runAuthorization(["KOORDINATOR_LAB"], "KOORDINATOR_LAB").nextCalled, true);
});
