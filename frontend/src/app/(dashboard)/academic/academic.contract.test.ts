import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

const here = dirname(new URL(import.meta.url).pathname);
const page = readFileSync(join(here, "page.tsx"), "utf8");
const guard = readFileSync(join(here, "../../../components/auth/role-guard.tsx"), "utf8");
const sidebar = readFileSync(join(here, "../../../components/layout/neo-sidebar.tsx"), "utf8");

test("academic workspace derives directly from existing schedules", () => {
  assert.match(page, /\/smart-academic\/schedules/);
  assert.match(page, /Data langsung dari Manajemen Jadwal/);
  assert.doesNotMatch(page, /\/academic\/(?:terms|courses|classes|offerings|dosen)/);
  assert.doesNotMatch(page, /Buat Term|Buat Mata kuliah|Buat Offering/);
});

test("class leader can assign per-schedule PJ", () => {
  assert.match(page, /\/smart-academic\/schedules\/\$\{schedule\.id\}\/classmates/);
  assert.match(page, /\/smart-academic\/schedules\/\$\{pjSchedule\.id\}\/pjs/);
  assert.match(page, /PJ mata kuliah ditetapkan/);
});

test("PJ reports empty occurrence and requests released slot", () => {
  assert.match(page, /\/smart-academic\/reports/);
  assert.match(page, /KOSONG/);
  assert.match(page, /WhatsApp dosen/);
  assert.match(page, /\/smart-academic\/moves/);
  assert.match(page, /Periksa & ajukan/);
});

test("risk decisions are transparent", () => {
  assert.match(page, /HIJAU/);
  assert.match(page, /KUNING/);
  assert.match(page, /Disetujui otomatis/);
  assert.match(page, /Menunggu petugas aktif/);
});

test("active assistant and coordinator can access review workspace", () => {
  assert.match(guard, /"\/academic": \["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"\]/);
  const assistantBlock = sidebar.match(/ASISTEN_LAB: \[([\s\S]*?)\n  \],/)?.[1] || "";
  assert.match(assistantBlock, /Persetujuan Akademik/);
  assert.match(page, /\["KOORDINATOR_LAB", "ASISTEN_LAB"\]/);
  assert.match(page, /\/smart-academic\/moves\/\$\{move\.id\}\/review/);
});
