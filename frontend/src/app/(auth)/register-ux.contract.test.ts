import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("public registration UX contract", () => {
  test("keeps one detail field while preserving legacy payload fields", () => {
    const page = source("./register/page.tsx");
    assert.match(page, /name="description"/);
    assert.match(page, /description: e\.target\.value, purpose: e\.target\.value/);
    assert.match(page, /\.\.\.formData/);
    assert.match(page, /purpose: string/);
    assert.match(page, /description: string/);
    assert.doesNotMatch(page, /disabled className=.*MAGANG/);
  });

  test("keeps public status guidance private and actionable", () => {
    const page = source("./register/page.tsx");
    assert.match(page, /navigator\.clipboard\.writeText\(successCode\)/);
    assert.match(page, /Salin kode secara manual/);
    assert.match(page, /Pengajuan sedang ditinjau/);
    assert.match(page, /Akun MAGANG Anda telah diaktifkan/);
    assert.match(page, /melalui kanal resmi dengan menyebutkan kode pengajuan ini/);
    assert.match(page, /REVISION/);
    assert.doesNotMatch(page, /checkedRequest\.reviewerNotes/);
  });

  test("shows email-first MAGANG success without exposing request code while preserving non-MAGANG code tracking", () => {
    const page = source("./register/page.tsx");
    assert.match(page, /Pendaftaran berhasil! Periksa email Anda untuk melakukan verifikasi\./);
    assert.match(page, /successType === "MAGANG"/);
    assert.match(page, /successType !== "MAGANG"/);
    assert.match(page, /successCode/);
    assert.match(page, /Salin Kode Pengajuan/);
    assert.doesNotMatch(page, /Simpan kode ini/);
  });

  test("collects MAGANG credentials with client validation and safe next steps", () => {
    const page = source("./register/page.tsx");
    assert.match(page, /name="password"/);
    assert.match(page, /name="confirmPassword"/);
    assert.match(page, /minLength=\{12\}/);
    assert.match(page, /maxLength=\{128\}/);
    assert.match(page, /value\.length < 12/);
    assert.match(page, /value\.length > 128/);
    assert.match(page, /!\/\[a-z\]\/.test\(value\)/);
    assert.match(page, /!\/\[A-Z\]\/.test\(value\)/);
    assert.match(page, /!\/\\d\/.test\(value\)/);
    assert.match(page, /!\/\[\^A-Za-z0-9\]\/.test\(value\)/);
    assert.match(page, /Password minimal 12 karakter/);
    assert.match(page, /Password maksimal 128 karakter/);
    assert.match(page, /Password harus memiliki huruf kecil/);
    assert.match(page, /Password harus memiliki huruf besar/);
    assert.match(page, /Password harus memiliki angka/);
    assert.match(page, /Password harus memiliki simbol/);
    assert.match(page, /Konfirmasi password harus sama/);
    assert.match(page, /password: formData\.type === "MAGANG" \? password : undefined/);
    assert.match(page, /confirmPassword: formData\.type === "MAGANG" \? confirmPassword : undefined/);
    assert.match(page, /Periksa email Anda untuk melakukan verifikasi/);
    assert.doesNotMatch(page, /QA mail sink/);
    assert.match(page, /Setelah email terverifikasi dan pengajuan disetujui/);
    assert.doesNotMatch(page, /reviewerNotes|rawToken|reset credentials/i);
  });

  test("keeps non-MAGANG branches password-free", () => {
    const page = source("./register/page.tsx");
    assert.match(page, /value !== "MAGANG"/);
    assert.match(page, /formData\.type === "MAGANG" \? password : undefined/);
    assert.match(page, /formData\.type === "MAGANG" \? confirmPassword : undefined/);
    assert.doesNotMatch(page, /type === "PEMINJAMAN_LAB"[^\n]*password/);
    assert.doesNotMatch(page, /type === "AKSES_SEMENTARA"[^\n]*password/);
  });
});
