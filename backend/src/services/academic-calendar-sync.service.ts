import { PDFParse } from "pdf-parse";
import prisma from "../config/database";
import { getJakartaClock } from "./jakarta-time";

const CALENDAR_URL = "https://akademik.unmuhbabel.ac.id/kalender-akademik/";
const INDONESIAN_MONTHS: Record<string, number> = { januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11 };

export type ParsedAcademicTerm = { code: string; name: string; startDate: Date };

export function selectStartedTerm(terms: ParsedAcademicTerm[], today: Date): ParsedAcademicTerm | null {
  return [...terms].sort((a, b) => b.startDate.getTime() - a.startDate.getTime()).find((term) => term.startDate <= today) ?? null;
}

function normalizedText(value: string): string {
  return value.normalize("NFKD").replace(/[^\x20-\x7E\n]/g, "").replace(/\s+/g, " ");
}

function recognizedMonth(raw: string): number | undefined {
  const letters = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.startsWith("sep")) return 8;
  if (letters.startsWith("feb")) return 1;
  return Object.entries(INDONESIAN_MONTHS).find(([name]) => letters.startsWith(name.slice(0, 3)))?.[1];
}

function dateCandidates(text: string, validYears: Set<number>) {
  return [...text.matchAll(/(\d{1,2})\s*((?:jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[a-z0-9,.'-]{0,12}?)(20[0-9z]{2})/gi)]
    .map((match) => ({
      day: Number(match[1]),
      month: recognizedMonth(match[2]),
      year: Number(match[3].toLowerCase().replace(/z/g, "2")),
      index: match.index ?? 0,
    }))
    .filter((item) => item.day >= 1 && item.day <= 31 && item.month !== undefined && validYears.has(item.year));
}

function dateNearMarker(snippet: string, markerOffset: number, validYears: Set<number>): Date | null {
  const nearest = dateCandidates(snippet, validYears)
    .map((item) => ({ ...item, distance: Math.abs(item.index - markerOffset) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest ? new Date(Date.UTC(nearest.year, nearest.month!, nearest.day)) : null;
}

export function parseAcademicCalendarText(raw: string): ParsedAcademicTerm[] {
  const text = normalizedText(raw).toLowerCase();
  const yearMatch = text.match(/tahun akademik\s+(20\d{2})\s*\/\s*(20\d{2})/);
  if (!yearMatch) throw new Error("Tahun akademik tidak ditemukan");
  const [, firstYear, secondYear] = yearMatch;
  const validYears = new Set([Number(firstYear), Number(secondYear)]);
  const markers = [...text.matchAll(/k[a-z]{2,8}h perdana/gi)];
  const starts = markers.map((marker) => {
    const start = Math.max(0, marker.index! - 120);
    return dateNearMarker(text.slice(start, marker.index! + 240), marker.index! - start, validYears);
  }).filter((date): date is Date => Boolean(date));
  const unique = [...new Map(starts.map((date) => [date.toISOString(), date])).values()].sort((a, b) => a.getTime() - b.getTime());
  if (unique.length < 2) {
    const allDates = dateCandidates(text, validYears);
    const oddCandidates = allDates.filter((item) => item.year === Number(firstYear) && item.month! >= 7 && item.month! <= 9).sort((a, b) => a.index - b.index);
    const evenCandidates = allDates.filter((item) => item.year === Number(secondYear) && item.month! >= 0 && item.month! <= 2).sort((a, b) => a.index - b.index);
    const odd = oddCandidates[oddCandidates.length - 1];
    const even = evenCandidates[evenCandidates.length - 1];
    if (odd && even) unique.splice(0, unique.length, new Date(Date.UTC(odd.year, odd.month!, odd.day)), new Date(Date.UTC(even.year, even.month!, even.day)));
  }
  if (unique.length !== 2 || unique[0].getUTCMonth() < 7 || unique[0].getUTCMonth() > 9 || unique[1].getUTCMonth() > 2) throw new Error("Tanggal kuliah perdana Ganjil/Genap tidak lengkap");
  return ["GANJIL", "GENAP"].map((period, index) => ({
    code: `${firstYear}-${secondYear}-${period}`,
    name: `Semester ${period === "GANJIL" ? "Ganjil" : "Genap"} ${firstYear}/${secondYear}`,
    startDate: unique[index],
  }));
}

function pdfId(html: string): string {
  const match = html.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/(?:view|preview)/);
  if (!match) throw new Error("Dokumen kalender resmi tidak ditemukan");
  return match[1];
}

export class AcademicCalendarSyncService {
  static async fetchOfficialTerms(): Promise<ParsedAcademicTerm[]> {
    const page = await fetch(CALENDAR_URL, { signal: AbortSignal.timeout(20_000) });
    if (!page.ok) throw new Error(`Kalender resmi HTTP ${page.status}`);
    const html = await page.text();
    const pdf = await fetch(`https://drive.google.com/uc?export=download&id=${pdfId(html)}`, { signal: AbortSignal.timeout(30_000) });
    if (!pdf.ok) throw new Error(`Dokumen kalender HTTP ${pdf.status}`);
    const parser = new PDFParse({ data: Buffer.from(await pdf.arrayBuffer()) });
    try { return parseAcademicCalendarText((await parser.getText()).text); }
    finally { await parser.destroy(); }
  }

  static async sync(now = new Date()) {
    const terms = await this.fetchOfficialTerms();
    const today = getJakartaClock(now).date;
    const active = selectStartedTerm(terms, today);
    await prisma.$transaction(async (tx) => {
      if (active) await tx.academicTerm.updateMany({ where: { isActive: true, code: { not: active.code } }, data: { isActive: false } });
      for (let index = 0; index < terms.length; index += 1) {
        const term = terms[index];
        const next = terms[index + 1];
        await tx.academicTerm.upsert({
          where: { code: term.code },
          create: { code: term.code, name: term.name, startDate: term.startDate, endDate: next ? new Date(next.startDate.getTime() - 86_400_000) : null, isActive: Boolean(active && term.code === active.code) },
          update: { name: term.name, startDate: term.startDate, endDate: next ? new Date(next.startDate.getTime() - 86_400_000) : null, ...(active ? { isActive: term.code === active.code } : {}) },
        });
      }
    });
    return { terms, activeCode: active?.code ?? null, source: CALENDAR_URL };
  }
}
