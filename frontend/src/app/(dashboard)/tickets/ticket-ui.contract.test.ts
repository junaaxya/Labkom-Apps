import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { isConflict, ticketCategoryLabel, ticketStatusLabel, ticketStatuses } from "./ticket-ui";

describe("ticket UI contract", () => {
  test("keeps backend ticket categories and WAITING status", () => {
    assert.equal(ticketCategoryLabel.MOUSE, "Mouse");
    assert.equal(ticketStatusLabel.OPEN, "Terbuka");
    assert.equal(ticketCategoryLabel.HARDWARE, undefined);
    assert.ok(ticketStatuses.includes("WAITING"));
  });

  test("recognizes shared API conflict errors", () => {
    assert.equal(isConflict(new Error("HTTP 409")), true);
    assert.equal(isConflict(new Error("Ticket status conflict")), true);
  });

  test("creation surfaces only backend-authorized duplicate links", async () => {
    const apiSource = await readFile("src/services/api.ts", "utf8");
    const newTicketSource = await readFile("src/app/(dashboard)/tickets/new/page.tsx", "utf8");
    const qrSource = await readFile("src/app/(dashboard)/scan/pc/[code]/page.tsx", "utf8");
    assert.match(apiSource, /export class ApiError/);
    assert.match(apiSource, /error\.data/);
    assert.match(newTicketSource, /Buka ticket existing/);
    assert.match(newTicketSource, /duplicateTicket\.link/);
    assert.match(qrSource, /Buka ticket existing/);
    assert.match(qrSource, /duplicateTicket\.link/);
    assert.doesNotMatch(newTicketSource, /reportedBy/);
    assert.doesNotMatch(qrSource, /reportedBy/);
  });

  test("QR flow uses asset route and redacted-safe rendering", async () => {
    const qrSource = await readFile("src/app/(dashboard)/scan/pc/[code]/page.tsx", "utf8");
    const mapSource = await readFile("src/app/(dashboard)/lab-map/page.tsx", "utf8");
    assert.match(qrSource, /\/tickets\/qr\/\$\{encodeURIComponent\(pcData\.assetCode\)\}/);
    assert.doesNotMatch(qrSource, /api\.post\("\/tickets",/);
    assert.match(qrSource, /Laporan aktif pada perangkat ini/);
    assert.match(qrSource, /z-\[100\]/);
    assert.match(qrSource, /aria-modal="true"/);
    assert.match(mapSource, /assetCode\?: string/);
    assert.match(mapSource, /\/tickets\/\$\{t\.id\}/);
    assert.match(mapSource, /\/tickets\/new/);
  });

  test("ticket list retry preserves active scope", async () => {
    const source = await readFile("src/app/(dashboard)/tickets/page.tsx", "utf8");
    assert.match(source, /load\(page, status, scope\)/);
    assert.match(source, /nextScope === "INCOMING"/);
  });
});
