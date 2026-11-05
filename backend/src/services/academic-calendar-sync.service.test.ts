import assert from "node:assert/strict";
import test from "node:test";
import { parseAcademicCalendarText, selectStartedTerm } from "./academic-calendar-sync.service";

const officialOcrFixture = `Perubahan Kalender Akademik Universitas Muhammadiyah Bangka Belitung Tahun Akademik 2026/2027
18Sepeffter2026 Sosialisasi SIMAKAD Oktober 2026 Apl 2027 Kuiah Perdana Serresilf Gan 2026/2027 21Sepl,rrt,er2026 UTS Ganjil
18 Janua-, - 20 Februa11 2027 Herregistrasi Serresi Genap 2026/2027 22 Februa1120Z7 Kufalh Perdana Serreslbr Genap 2026/2027 24-30 Apri 2027 UTS Genap`;

test("extracts official UNMUH Babel odd and even term starts despite PDF OCR noise", () => {
  const terms = parseAcademicCalendarText(officialOcrFixture);
  assert.deepEqual(terms.map((term) => ({ code: term.code, start: term.startDate.toISOString().slice(0, 10) })), [
    { code: "2026-2027-GANJIL", start: "2026-09-21" },
    { code: "2026-2027-GENAP", start: "2027-02-22" },
  ]);
});

test("fails closed when both official term markers are not available", () => {
  assert.throws(() => parseAcademicCalendarText("TAHUN AKADEMIK 2026/2027 Kuliah Perdana 21 September 2026"), /tidak lengkap/);
});

test("future calendar upload never activates before its first lecture date", () => {
  const terms = parseAcademicCalendarText(officialOcrFixture);
  assert.equal(selectStartedTerm(terms, new Date("2026-08-01T00:00:00Z")), null);
  assert.equal(selectStartedTerm(terms, new Date("2026-11-05T00:00:00Z"))?.code, "2026-2027-GANJIL");
  assert.equal(selectStartedTerm(terms, new Date("2027-03-01T00:00:00Z"))?.code, "2026-2027-GENAP");
});
