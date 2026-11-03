import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("MAGANG attendance frontend contract", () => {
  test("allows only personal attendance routes", () => {
    const guard = source("../../../components/auth/role-guard.tsx");
    assert.match(guard, /"\/attendance": \["KOORDINATOR_LAB", "ASISTEN_LAB", "MAGANG"\]/);
    assert.match(guard, /"\/attendance\/shifts": \["KOORDINATOR_LAB", "ASISTEN_LAB"\]/);
    assert.match(guard, /"\/attendance\/monitoring": \["KOORDINATOR_LAB"\]/);
    assert.match(guard, /"\/attendance\/settings": \["KOORDINATOR_LAB"\]/);
  });

  test("exposes attendance in MAGANG navigation and keeps it in mobile first four", () => {
    const sidebar = source("../../../components/layout/neo-sidebar.tsx");
    const mobile = source("../../../components/layout/mobile-bottom-nav.tsx");
    assert.match(sidebar, /MAGANG:[\s\S]*label: "Absensi Saya", href: "\/attendance"/);
    assert.doesNotMatch(sidebar, /MAGANG:[\s\S]*label: "Jadwal Piket"/);
    assert.match(mobile, /MAGANG:[\s\S]*label: "Absensi", href: "\/attendance"/);
  });

  test("uses personal APIs only for MAGANG and dual role references for coordinators", () => {
    const attendance = source("./page.tsx");
    const shifts = source("./shifts/page.tsx");
    const monitoring = source("./monitoring/page.tsx");
    assert.match(attendance, /if \(isMagang\)[\s\S]*\/attendance\/shift-schedules\/me[\s\S]*\/attendance\/me\?month=\$\{selectedMonth\}[\s\S]*\/attendance\/stats\?month=\$\{selectedMonth\}/);
     const magangStart = attendance.indexOf("if (isMagang) {");
     const magangEnd = attendance.indexOf("        return;", magangStart);
     assert.ok(magangStart >= 0 && magangEnd > magangStart, "MAGANG fetch branch must be extractable");
     const magangBranch = attendance.slice(magangStart, magangEnd);
     assert.doesNotMatch(magangBranch, /\/attendance\/(?:tasks|corrections|leaves)/);
     const tabs = attendance.slice(attendance.indexOf("{/* Tabs */}"), attendance.indexOf("{/* Tab Content */}"));
     assert.match(tabs, /isMagang \? \(\["today", "history"\] as const\)/);
     assert.doesNotMatch(shifts, /schedule\.user\.role/);
    for (const page of [shifts, monitoring]) {
      assert.match(page, /\/users\?role=ASISTEN_LAB/);
      assert.match(page, /\/users\?role=MAGANG/);
      assert.match(page, /user\.role === "MAGANG" \? "Magang" : "Asisten Lab"/);
    }
  });

  test("adds isolated coordinator MAGANG history reporting", () => {
    const monitoring = source("./monitoring/page.tsx");
    assert.match(monitoring, /type MonitoringTab = "TODAY" \| "MAGANG"/);
    assert.match(monitoring, /\/attendance\/all\?role=MAGANG&limit=100/);
    for (const label of ["Nama", "Tanggal", "Jam Masuk", "Jam Pulang", "Status"]) {
      assert.match(monitoring, new RegExp(`label: "${label}"|>${label}<`));
    }
    assert.match(monitoring, /attendance\.checkinAt \?\? attendance\.createdAt/);
    assert.match(monitoring, /\/attendance\/monitoring\/today/);
    assert.match(monitoring, /\/users\?role=ASISTEN_LAB/);
    assert.match(monitoring, /\/users\?role=MAGANG/);
  });
});
