import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routes = readFileSync(path.join(__dirname, "academic.routes.ts"), "utf8");
const migration = readFileSync(
  path.join(__dirname, "../../prisma/migrations/20261022000000_add_academic_foundation/migration.sql"),
  "utf8",
);

test("academic master data remains coordinator-managed and reports have no approval path", () => {
  for (const resource of ["dosen", "terms", "courses", "classes", "memberships", "leaders", "pjs"]) {
    assert.match(routes, new RegExp(`router\\.(get|post|patch)\\("/${resource}(?:/[^\"]*)?", authorize\\("KOORDINATOR_LAB"`));
  }
  assert.match(routes, /router\.get\("\/offerings", authorize\("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"\), AcademicController\.listOfferings\);/);
  assert.match(routes, /router\.get\("\/reports", authorize\("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"\), AcademicController\.listReports\);/);
  assert.match(routes, /router\.post\("\/reports", authorize\("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"\), AcademicController\.createReport\);/);
  assert.match(routes, /router\.post\("\/offerings\/:offeringId\/pjs", authorize\("KOORDINATOR_LAB", "MAHASISWA"\), AcademicController\.assignPj\);/);
  assert.doesNotMatch(routes, /\/reports(?:\/[^\"]+)?\/approve/);
});

test("scoped PJ reads admit only coordinators and students while global reads stay coordinator-only", () => {
  assert.match(routes, /router\.get\("\/memberships", authorize\("KOORDINATOR_LAB"\), AcademicController\.listMemberships\);/);
  assert.match(routes, /router\.get\("\/pjs", authorize\("KOORDINATOR_LAB"\), AcademicController\.listPjs\);/);
  assert.match(routes, /router\.get\("\/offerings\/:offeringId\/memberships", authorize\("KOORDINATOR_LAB", "MAHASISWA"\), AcademicController\.listPjMemberships\);/);
  assert.match(routes, /router\.get\("\/offerings\/:offeringId\/pjs", authorize\("KOORDINATOR_LAB", "MAHASISWA"\), AcademicController\.listOfferingPjs\);/);
});

test("swap routes keep representative confirmation separate from coordinator review", () => {
  const source = readFileSync(path.join(__dirname, "academic.routes.ts"), "utf8");
  assert.match(source, /router\.post\("\/occurrence-swaps", authorize\("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"\)/);
  assert.match(source, /router\.post\("\/occurrence-swaps\/:id\/confirm", authorize\("DOSEN", "MAHASISWA"\)/);
  assert.match(source, /router\.post\("\/occurrence-swaps\/:id\/cancel", authorize\("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"\)/);
  assert.match(source, /router\.patch\("\/occurrence-swaps\/:id\/review", authorize\("KOORDINATOR_LAB"\)/);
});

test("academic migration is additive and does not backfill legacy schedule text", () => {
  assert.match(migration, /ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DOSEN';/);
  assert.match(migration, /CREATE TYPE "AcademicReportStatus" AS ENUM \('TATAP_MUKA', 'ONLINE', 'TIDAK_MASUK', 'PINDAH_JADWAL', 'BELUM_PASTI'\);/);
  assert.match(migration, /CREATE TABLE "academic_report_revisions"/);
  assert.doesNotMatch(migration, /UPDATE "schedules"|INSERT INTO "academic_[^"]+"[\s\S]*SELECT/);
});
