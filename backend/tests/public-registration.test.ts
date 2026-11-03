import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("endpoint register tidak terbuka untuk pendaftaran mandiri", () => {
  const routes = readFileSync(new URL("../src/routes/auth.routes.ts", import.meta.url), "utf8");

  assert.match(
    routes,
    /router\.post\("\/register", registerLimiter, authenticate, authorize\("KOORDINATOR_LAB"\), AuthController\.register\);/
  );
});
