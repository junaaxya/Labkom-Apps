import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { authorize } from "../middlewares/auth.middleware";

type Result = { status?: number; body?: unknown; nextCalled: boolean };

function runAuthorization(role?: string): Result {
  const result: Result = { nextCalled: false };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  };
  authorize("KOORDINATOR_LAB")(
    role ? ({ user: { userId: "user-1", role } } as never) : ({} as never),
    res as never,
    () => { result.nextCalled = true; },
  );
  return result;
}

test("single PC command route is coordinator-only", () => {
  const source = readFileSync(path.join(__dirname, "pc.routes.ts"), "utf8");
  assert.match(source, /router\.post\("\/:id\/command", authenticate, authorize\("KOORDINATOR_LAB"\), PCController\.sendCommand\);/);
});

test("only coordinators pass remote-command authorization", () => {
  assert.equal(runAuthorization("KOORDINATOR_LAB").nextCalled, true);

  for (const role of ["ASISTEN_LAB", "MAGANG", "MAHASISWA"]) {
    const result = runAuthorization(role);
    assert.equal(result.status, 403, role);
    assert.equal(result.nextCalled, false, role);
  }

  const unauthenticated = runAuthorization();
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.nextCalled, false);
});
