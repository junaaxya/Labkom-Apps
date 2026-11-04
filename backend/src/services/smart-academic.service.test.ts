import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd().endsWith("backend") ? process.cwd() : join(process.cwd(), "backend");
const service = readFileSync(join(root, "src/services/smart-academic.service.ts"), "utf8");
const routes = readFileSync(join(root, "src/routes/smart-academic.routes.ts"), "utf8");
const actual = readFileSync(join(root, "src/services/actual-occurrence.service.ts"), "utf8");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");

test("smart academic uses Schedule as source and scopes PJ by schedule", () => {
  assert.match(service, /prisma\.schedule\.findMany/);
  assert.match(service, /type: "PRAKTIKUM"/);
  assert.match(schema, /model SmartAcademicPj/);
  assert.match(schema, /scheduleId\s+String/);
  assert.doesNotMatch(service, /academicTerm\.create|academicCourse\.create|academicClass\.create|academicOffering\.create/);
});

test("PJ candidates require exact non-empty class and semester", () => {
  assert.match(service, /Kelas mahasiswa harus sama persis dengan kelas jadwal/);
  assert.match(service, /Semester mahasiswa harus sama persis dengan semester jadwal/);
  assert.match(service, /className: \{ equals: schedule\.className!, mode: "insensitive" \}/);
  assert.match(service, /semester: \{ equals: schedule\.semester!, mode: "insensitive" \}/);
  assert.match(service, /Jadwal wajib memiliki kelas dan semester sebelum PJ dipilih/);
});

test("green requests auto approve and yellow requests await operations", () => {
  assert.match(service, /riskLevel === "GREEN" \? "AUTO_APPROVED" : "PENDING_REVIEW"/);
  assert.match(service, /Perubahan memakai lab berbeda/);
  assert.match(service, /Ada booking yang masih menunggu keputusan/);
  assert.match(service, /Perubahan diajukan pada hari pelaksanaan/);
});

test("hard conflicts reject before request creation", () => {
  for (const text of ["Kelas memiliki jadwal lain", "Dosen memiliki jadwal lain", "Lab memiliki sesi aktif", "Kunci lab sedang dipinjam", "Lab sudah memiliki booking aktif"]) assert.match(service, new RegExp(text));
  assert.match(service, /occurrenceDate: report\.occurrenceDate/);
});

test("students can discover released slots across classes", () => {
  assert.match(service, /status: \{ in: \["KOSONG", "ONLINE"\] \}/);
});

test("assistant review requires active checked-in shift for exact lab", () => {
  assert.match(service, /isActiveLabAssistant/);
  assert.match(service, /labId, scheduleDate: date, status: "SCHEDULED"/);
  assert.match(service, /checkoutAt: null, status: "CHECKED_IN"/);
  assert.match(routes, /authorize\("KOORDINATOR_LAB", "ASISTEN_LAB"\)/);
});

test("first valid reviewer wins atomically", () => {
  assert.match(service, /smartAcademicMoveRequest\.updateMany/);
  assert.match(service, /where: \{ id, status: "PENDING_REVIEW" \}/);
  assert.match(service, /result\.count !== 1/);
});

test("approved smart moves project into shared actual occurrences", () => {
  assert.match(actual, /smartAcademicMoveRequest/);
  assert.match(actual, /AUTO_APPROVED/);
  assert.match(actual, /smartSourceReleased/);
  assert.match(actual, /targetScheduleId === schedule\.id/);
});
