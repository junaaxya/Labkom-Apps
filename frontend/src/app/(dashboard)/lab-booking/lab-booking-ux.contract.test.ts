import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("lab booking UX contract", () => {
  test("explains server availability and rejected next steps", () => {
    const page = source("./page.tsx");
    assert.match(page, /Ketersediaan lab dikonfirmasi server saat pengajuan dikirim/);
    assert.match(page, /Buat pengajuan baru dengan informasi yang sudah diperbaiki/);
  });

  test("keeps assistant queue read-only and dates Jakarta-safe", () => {
    const page = source("./page.tsx");
    assert.match(page, /ASISTEN_LAB dapat membuka detail antrean/);
    assert.match(page, /const canApprove = user\?\.role === "KOORDINATOR_LAB"/);
    assert.match(page, /import \{ jakartaDateKey \} from "@\/utils\/jakarta-date"/);
    assert.match(page, /jakartaDateKey\(booking\.date\)/);
    assert.match(page, /jakartaDateKey\(selectedBooking\.date\)/);
    assert.doesNotMatch(page, /toLocaleDateString\(/);
  });
});
