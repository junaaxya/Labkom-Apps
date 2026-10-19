import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const page = readFileSync(new URL("./verify-email/page.tsx", import.meta.url), "utf8");

describe("public MAGANG email verification UX contract", () => {
  test("uses explicit verification action with App Router query handling", () => {
    assert.match(page, /useSearchParams/);
    assert.match(page, /searchParams\.get\("token"\)/);
    assert.match(page, /onClick=\{verifyEmail\}/);
    assert.match(page, /method: "POST"/);
    assert.match(page, /access-requests\/verify-email/);
    assert.match(page, /JSON\.stringify\(\{ token \}\)/);
    assert.match(page, /outcome !== "idle"/);
  });

  test("keeps token and API failures private while distinguishing verification from activation", () => {
    assert.match(page, /Tautan verifikasi tidak valid atau sudah kedaluwarsa/);
    assert.match(page, /Email berhasil diverifikasi\. Pengajuan sedang menunggu persetujuan Koordinator Laboratorium\./);
    assert.match(page, /response\.ok && data\?\.success/);
    assert.doesNotMatch(page, /console\.(log|error).*token/);
    assert.doesNotMatch(page, /data\.message/);
    assert.doesNotMatch(page, /\{token\}/);
  });

  test("offers safe next steps after every outcome", () => {
    assert.match(page, /href="\/login"/);
    assert.match(page, /href="\/register"/);
    assert.match(page, /outcome !== "idle"/);
  });
});
