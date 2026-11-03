import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Feature 05 frontend truthfulness contract", () => {
  test("keeps booking review readable by assistants but mutable only by coordinators", () => {
    const booking = source("./lab-booking/page.tsx");
    assert.match(booking, /role === "KOORDINATOR_LAB" \|\| role === "ASISTEN_LAB"/);
    assert.match(booking, /const canApprove = user\?\.role === "KOORDINATOR_LAB"/);
    assert.match(booking, /if \(!canApprove\) return;/);
    assert.match(booking, /\{canApprove \? </);
    assert.match(booking, /Pengambilan kunci mengikuti alur kunci terpisah/);
  });

  test("keeps access-request review mutation coordinator-only", () => {
    const requests = source("./access-requests/page.tsx");
    assert.match(requests, /const canReview = user\?\.role === "KOORDINATOR_LAB"/);
    assert.match(requests, /if \(!canReview\) return;/);
    assert.match(requests, /\{canReview && item\.status/);
  });

  test("keeps approved account onboarding secure", () => {
    const requests = source("./access-requests/page.tsx");
    assert.doesNotMatch(requests, /password awal = kode pengajuan/);
    assert.match(requests, /mengaktifkan akun MAGANG dan mengirim email konfirmasi\. Jika email gagal terkirim, akun tetap aktif\./);
    assert.match(requests, /akses sementara\. Detail akses disampaikan secara aman oleh koordinator melalui kanal terverifikasi; kode pengajuan bukan password\./);
  });

  test("states condition submission and pending official verification after key return", () => {
    const key = source("./scan/key/[code]/page.tsx");
    assert.match(key, /Kondisi lab berhasil dikirim dan kunci dikembalikan\. Menunggu verifikasi asisten dan checkout resmi\./);
    assert.match(key, /Verifikasi asisten dan checkout resmi dilakukan setelahnya\./);
    assert.doesNotMatch(key, /Kondisi lab berhasil divalidasi & kunci dikembalikan/);
  });
});
