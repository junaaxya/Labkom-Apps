import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("key scan delegates pickup authorization to eligibility contract and explains PJ access", () => {
  assert.match(page, /\/keys\/\$\{res\.data\.id\}\/eligibility/);
  assert.match(page, /const canTake = Boolean\(eligibility\?\.canTake\)/);
  assert.doesNotMatch(page, /user\.isKetuaKelas/);
  assert.match(page, /PJ aktif untuk jadwal ini atau Ketua Kelas dapat mengambil kunci setelah Asisten Lab check-in\./);
  assert.match(page, /eligibility\?\.takeReason/);
});
