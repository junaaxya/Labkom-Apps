import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Mission & Key Return UX contract", () => {
  test("1. Missions page: Lihat Detail button, selectedMissionDetail sheet, and Leaderboard Asisten Lab fallback", () => {
    const missionsPage = source("./page.tsx");

    assert.match(missionsPage, /Lihat Detail/);
    assert.match(missionsPage, /selectedMissionDetail/);
    assert.match(missionsPage, /Klaim Misi Ini/);
    assert.match(missionsPage, /Submit Bukti Pengerjaan/);
    assert.match(missionsPage, /sourceTicket/);
    assert.doesNotMatch(missionsPage, /"Unknown User"/);
    assert.match(missionsPage, /"Asisten Lab"/);
    assert.match(missionsPage, /pb-28 sm:pb-16/);
  });

  test("2. Key return page: textarea inputs, Kirim Kondisi & Serahkan Kunci, zoom photo modal, and clearance", () => {
    const keyReturnPage = source("../scan/key/[code]/page.tsx");

    assert.match(keyReturnPage, /<textarea[\s\S]*rows=\{3\}[\s\S]*value=\{kerusakanBaru\}/);
    assert.match(keyReturnPage, /<textarea[\s\S]*rows=\{3\}[\s\S]*value=\{catatan\}/);
    assert.match(keyReturnPage, /Kirim Kondisi & Serahkan Kunci/);
    assert.match(keyReturnPage, /Alur Verifikasi:/);
    assert.match(keyReturnPage, /Preview Foto Kondisi/);
    assert.match(keyReturnPage, /zoomPhoto/);
    assert.match(keyReturnPage, /pb-28 sm:pb-16/);
  });
});
