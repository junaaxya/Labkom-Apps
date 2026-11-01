import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

const here = dirname(new URL(import.meta.url).pathname);
const page = readFileSync(join(here, "page.tsx"), "utf8");
const guard = readFileSync(join(here, "../../../components/auth/role-guard.tsx"), "utf8");
const sidebar = readFileSync(join(here, "../../../components/layout/neo-sidebar.tsx"), "utf8");
const dashboard = readFileSync(join(here, "../dashboard/page.tsx"), "utf8");

test("academic UI uses only scoped academic routes and optimistic report revisions", () => {
  assert.match(page, /api\.get<ApiList<AcademicOffering>>\("\/academic\/offerings"\)/);
  assert.match(page, /api\.get<ApiList<AcademicReport>>\("\/academic\/reports"\)/);
  assert.match(page, /api\.post\("\/academic\/reports"/);
  assert.match(page, /expectedRevision: editing\.revision/);
  assert.doesNotMatch(page, /\/(?:schedules|keys|lab-booking|logbooks|bookings)(?:["`?])/);
});

test("academic UI reads occurrence release state and submits releases through academic routes", () => {
  assert.match(page, /api\.get<ApiList<OccurrenceRelease>>\("\/academic\/occurrence-releases"\)/);
  assert.match(page, /api\.get<ApiList<SlotRequest>>\("\/academic\/slot-requests"\)/);
  assert.match(page, /api\.post\("\/academic\/occurrence-releases", \{ reportId: report\.id \}\)/);
  assert.match(page, /api\.post\("\/academic\/slot-requests", \{ releaseId, targetOfferingId \}\)/);
  assert.match(page, /Lepaskan slot/);
  assert.match(page, /Ajukan penggunaan slot rilis/);
});

test("academic UI reads actual occurrences and submits scoped swaps", () => {
  assert.match(page, /\/academic\/actual-schedules\?date=/);
  assert.match(page, /\/academic\/occurrence-swaps/);
  assert.match(page, /Konfirmasi kelas/);
  assert.match(page, /occurrence-swaps\/\$\{swapId\}\/cancel/);
  assert.match(page, /Jadwal praktikum resmi tidak diubah/);
});

test("DOSEN route surface excludes legacy operational flows", () => {
  assert.match(guard, /"\/academic": \["KOORDINATOR_LAB", "DOSEN", "MAHASISWA"\]/);
  assert.match(sidebar, /DOSEN: \[/);
  const dosenBlock = sidebar.match(/DOSEN: \[([\s\S]*?)\n  \],/)?.[1] || "";
  assert.match(dosenBlock, /"\/academic"/);
  assert.doesNotMatch(dosenBlock, /"\/(?:schedules|keys|lab-booking|logbook|tickets)"/);
  assert.match(dashboard, /if \(role !== "DOSEN"\)/);
  assert.match(dashboard, /if \(role === "DOSEN"\)/);
});

test("DOSEN can submit reports only through scoped academic routes", () => {
  assert.match(page, /role === "MAHASISWA" \|\| role === "DOSEN"/);
  assert.match(page, /Laporan baru dan revisi hanya tersedia untuk penawaran dosen/);
});

test("academic workspace exposes named sections and name-first course presentation", () => {
  for (const label of ["Ringkasan", "Mata Kuliah", "Kelola PJ", "Laporan", "Ketersediaan Lab", "Perubahan Jadwal", "Riwayat"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /offering\.course\?\.name \|\| offering\.course\?\.code/);
  assert.match(page, /offering\.academicClass\?\.name \|\| offering\.academicClass\?\.code/);
  assert.match(page, /offering\.term\?\.name \|\| offering\.term\?\.code/);
  assert.match(page, /offering\.dosen\?\.name/);
});

test("PJ management stays scoped and never reads global student management routes", () => {
  assert.match(page, /academic\/offerings\/\$\{selectedOfferingId\}\/memberships/);
  assert.match(page, /academic\/offerings\/\$\{selectedOfferingId\}\/pjs/);
  assert.match(page, /api\.post\(`\/academic\/offerings\/\$\{selectedOfferingId\}\/pjs`/);
  assert.match(page, /api\.patch\(`\/academic\/pjs\/\$\{pj\.id\}`/);
  assert.match(page, /isActive: false/);
  assert.doesNotMatch(page, /api\.get[^\n]*\/academic\/memberships["`]/);
  assert.doesNotMatch(page, /api\.get[^\n]*\/academic\/pjs["`]/);
});

test("academic onboarding separates empty state from offering load failure", () => {
  assert.match(page, /offeringsError/);
  assert.match(page, /Penawaran akademik gagal dimuat/);
  assert.match(page, /Belum ada penawaran terhubung/);
  assert.match(page, /Koordinator Lab perlu menghubungkan Anda/);
  assert.doesNotMatch(page, /academic\/offerings"\)\.catch\(\(\) => \(\{ data: \[\] \}\)\)/);
});

test("coordinator onboarding uses explicit setup and filtered schedule candidates", () => {
  for (const route of ["/academic/dosen", "/academic/terms", "/academic/courses", "/academic/classes", "/academic/memberships", "/academic/leaders", "/academic/offerings", "/academic/onboarding/schedule-candidates"]) {
    assert.match(page, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(page, /offerings\/\$\{selectedOfferingId\}\/schedule/);
  assert.match(page, /Workspace Koordinator/);
  assert.match(page, /role !== "KOORDINATOR_LAB"/);
  assert.doesNotMatch(page, /api\.get[^\n]*\/schedules/);
});
