import assert from "node:assert/strict";
import test from "node:test";
import { validateCapacitorServerUrl } from "./check-capacitor-config.mjs";

test("valid production https URL passes", () => {
  const result = validateCapacitorServerUrl("https://labkom.university.ac.id");
  assert.equal(result.origin, "https://labkom.university.ac.id");
});

test("missing URL fails", () => {
  assert.throws(() => validateCapacitorServerUrl(""), /wajib diisi/);
});

test("http URL fails", () => {
  assert.throws(() => validateCapacitorServerUrl("http://labkom.university.ac.id"), /HTTPS/);
});

test("localhost fails", () => {
  assert.throws(() => validateCapacitorServerUrl("https://localhost:3000"), /domain produksi publik/);
});

test("private host fails", () => {
  assert.throws(() => validateCapacitorServerUrl("https://192.168.1.5"), /domain produksi publik/);
});

test("private alias host fails", () => {
  assert.throws(() => validateCapacitorServerUrl("https://127.0.0.1.nip.io"), /domain produksi publik/);
  assert.throws(() => validateCapacitorServerUrl("https://app.localhost.direct"), /domain produksi publik/);
});

test("private IPv6 hosts fail", () => {
  assert.throws(() => validateCapacitorServerUrl("https://[::1]"), /domain produksi publik/);
  assert.throws(() => validateCapacitorServerUrl("https://[fc00::1]"), /domain produksi publik/);
  assert.throws(() => validateCapacitorServerUrl("https://[fe80::1]"), /domain produksi publik/);
});

test("credentials fail", () => {
  assert.throws(() => validateCapacitorServerUrl("https://user:pass@labkom.university.ac.id"), /kredensial/);
});

test("query and hash fail", () => {
  assert.throws(() => validateCapacitorServerUrl("https://labkom.university.ac.id?foo=bar"), /query string/);
  assert.throws(() => validateCapacitorServerUrl("https://labkom.university.ac.id/#app"), /hash fragment/);
});

test("placeholder host fails", () => {
  assert.throws(() => validateCapacitorServerUrl("https://app.example.edu"), /placeholder/);
});
