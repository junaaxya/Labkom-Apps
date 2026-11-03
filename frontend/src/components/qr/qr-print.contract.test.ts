import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("QR print rendering contract", () => {
  test("builds preview print DOM without HTML interpolation", () => {
    const modal = source("./qr-preview-modal.tsx");
    assert.doesNotMatch(modal, /document\.write|innerHTML|outerHTML/);
    assert.match(modal, /title\.textContent = `\$\{label\} - \$\{code\}`/);
    assert.match(modal, /text\.textContent = code/);
    assert.match(modal, /isPngDataUrl\(qrImage\)/);
  });

  test("keeps hostile labels and QR payloads as data, not markup or URLs", () => {
    const modal = source("./qr-preview-modal.tsx");
    const lab = source("../../app/(dashboard)/labs/[id]/page.tsx");
    const hostileLabel = '<img src=x onerror="alert(1)">';
    const payload = "data:image/png;base64,QUJDRA==";

    assert.doesNotMatch(modal, /src=\"\$\{qrImage\}\"|<p>\$\{code\}<\/p>/);
    assert.match(modal, /const PNG_DATA_URL = \/\^data:image\\\/png;base64/);
    assert.match(lab, /new DOMParser\(\)\.parseFromString\(html, "text\/html"\)/);
    assert.match(lab, /code\.textContent = sourceItem\.querySelector\("\.code"\)\?\.textContent/);
    assert.match(lab, /label\.textContent = sourceItem\.querySelector\("\.label"\)\?\.textContent/);
    assert.ok(hostileLabel.includes("<img"));
    assert.ok(payload.startsWith("data:image/png;base64,"));
    assert.doesNotMatch(lab, /document\.write|innerHTML|outerHTML/);
  });

  test("preserves authenticated print-sheet fetch and blocked-popup feedback", () => {
    const lab = source("../../app/(dashboard)/labs/[id]/page.tsx");
    assert.match(lab, /response\.text\(\)/);
    assert.match(lab, /Authorization: `Bearer \$\{token\}`/);
    assert.match(lab, /if \(!printWindow\)/);
    assert.match(lab, /Popup diblokir browser/);
    assert.match(lab, /printWindow\.focus\(\)/);
    assert.match(lab, /printWindow\.print\(\)/);
  });
});
