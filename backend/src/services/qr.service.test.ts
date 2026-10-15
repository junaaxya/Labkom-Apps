import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { QRService } from "./qr.service";

type Restore = () => void;

type PrintLab = {
  id: string;
  name: string;
};

type PrintPC = {
  id: string;
  assetCode: string;
  name: string;
  pcCode: string;
};

type PrintKey = {
  id: string;
  keyCode: string;
};

type QRCall = {
  content: string;
  size: number;
};

const QR_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2Nk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==";

function replaceMethod(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Reflect.deleteProperty(target, key);
    }
  };
}

function restoreAll(restores: Restore[]): void {
  for (const restore of restores.reverse()) restore();
}

function mockPrintSheet(
  lab: PrintLab | null,
  pcs: PrintPC[],
  keys: PrintKey[],
  qrCalls: QRCall[],
): Restore[] {
  return [
    replaceMethod(prisma.lab, "findUnique", async () => lab),
    replaceMethod(prisma.pC, "findMany", async () => pcs),
    replaceMethod(prisma.key, "findMany", async () => keys),
    replaceMethod(QRService, "generateQRDataUrl", async (content: string, size = 400) => {
      qrCalls.push({ content, size });
      return QR_IMAGE;
    }),
  ];
}

function imageTags(html: string): string[] {
  return html.match(/<img\b[^>]*>/g) ?? [];
}

function countOccurrences(content: string, value: string): number {
  return content.split(value).length - 1;
}

test("print sheet keeps normal labels, layout, raw QR payloads, and generated PNG URLs", async () => {
  const lab = { id: "lab-1", name: "Lab Jaringan" };
  const pcs = [{
    id: "pc-1",
    assetCode: "ASSET-LABJ-PC-001",
    name: "PC Guru",
    pcCode: "LABJ-PC-001",
  }];
  const keys = [{ id: "key-1", keyCode: "KEY-LABJ-001" }];
  const qrCalls: QRCall[] = [];
  const restores = mockPrintSheet(lab, pcs, keys, qrCalls);

  try {
    const html = await QRService.generatePrintSheet("lab-1", "all");

    assert.match(html, /grid-template-columns: repeat\(4, 1fr\); gap: 16px;/);
    assert.match(html, /\.item img \{ width: 150px; height: 150px;/);
    assert.match(html, /@media print \{/);
    assert.match(html, /grid-template-columns: repeat\(4, 1fr\); gap: 10px;/);
    assert.match(html, /\.item img \{ width: 120px; height: 120px;/);
    assert.ok(html.includes("<title>QR Codes - Lab Jaringan</title>"));
    assert.ok(html.includes("<h1>QR Codes — Lab Jaringan</h1>"));
    assert.ok(html.includes('<div class="code">ASSET-LABJ-PC-001</div>'));
    assert.ok(html.includes('<div class="label">PC Guru (LABJ-PC-001)</div>'));
    assert.ok(html.includes('<div class="label">Kunci Lab Jaringan</div>'));
    assert.equal(imageTags(html).length, 2);
    assert.equal(countOccurrences(html, `src="${QR_IMAGE}"`), 2);
    assert.deepEqual(qrCalls, [
      { content: QRService.getPCQRUrl("ASSET-LABJ-PC-001"), size: 200 },
      { content: QRService.getKeyQRUrl("KEY-LABJ-001"), size: 200 },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("print sheet keeps pc and key type filters", async () => {
  const lab = { id: "lab-1", name: "Lab Jaringan" };
  const pcs = [{
    id: "pc-1",
    assetCode: "ASSET-LABJ-PC-001",
    name: "PC Guru",
    pcCode: "LABJ-PC-001",
  }];
  const keys = [{ id: "key-1", keyCode: "KEY-LABJ-001" }];
  const qrCalls: QRCall[] = [];
  const restores = mockPrintSheet(lab, pcs, keys, qrCalls);

  try {
    const pcHtml = await QRService.generatePrintSheet("lab-1", "pc");
    const keyHtml = await QRService.generatePrintSheet("lab-1", "key");

    assert.ok(pcHtml.includes("ASSET-LABJ-PC-001"));
    assert.equal(pcHtml.includes("KEY-LABJ-001"), false);
    assert.equal(keyHtml.includes("ASSET-LABJ-PC-001"), false);
    assert.ok(keyHtml.includes("KEY-LABJ-001"));
    assert.deepEqual(qrCalls, [
      { content: QRService.getPCQRUrl("ASSET-LABJ-PC-001"), size: 200 },
      { content: QRService.getKeyQRUrl("KEY-LABJ-001"), size: 200 },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("print sheet escapes hostile database text without changing QR payloads or PNG sources", async () => {
  const lab = { id: "lab-1", name: 'Lab <Utama> & "A" \'B\' &lt;entitas&gt;' };
  const malformedAssetCode = 'ASSET-" onmouseover="alert(1)';
  const hostileKeyCode = 'KEY-"><img src=x onerror=alert(2)>';
  const pcs = [
    {
      id: "pc-1",
      assetCode: malformedAssetCode,
      name: "<img src=x onerror=alert(1)>",
      pcCode: "PC-<script>alert(1)</script>",
    },
    {
      id: "pc-2",
      assetCode: "ASSET-UTF-001",
      name: "Komputer Ruang Bahasa Indonesia — Lantai 2",
      pcCode: "PC-UTF-001",
    },
  ];
  const keys = [{ id: "key-1", keyCode: hostileKeyCode }];
  const qrCalls: QRCall[] = [];
  const restores = mockPrintSheet(lab, pcs, keys, qrCalls);

  try {
    const html = await QRService.generatePrintSheet("lab-1", "all");

    assert.ok(html.includes("Lab &lt;Utama&gt; &amp; &quot;A&quot; &#39;B&#39; &amp;lt;entitas&amp;gt;"));
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt; (PC-&lt;script&gt;alert(1)&lt;/script&gt;)"));
    assert.ok(html.includes("ASSET-&quot; onmouseover=&quot;alert(1)"));
    assert.ok(html.includes("KEY-&quot;&gt;&lt;img src=x onerror=alert(2)&gt;"));
    assert.ok(html.includes("Komputer Ruang Bahasa Indonesia — Lantai 2 (PC-UTF-001)"));
    assert.equal(/<script\b/i.test(html), false);
    assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
    assert.equal(html.includes('<img src=x onerror=alert(2)>'), false);

    const tags = imageTags(html);
    assert.equal(tags.length, 3);
    for (const tag of tags) {
      const prefix = `<img src="${QR_IMAGE}" alt="`;
      assert.ok(tag.startsWith(prefix));
      assert.ok(tag.endsWith('" />'));
      const alt = tag.slice(prefix.length, -4);
      assert.equal(alt.includes('"'), false);
      assert.equal(alt.includes("<"), false);
      assert.equal(alt.includes(">"), false);
    }

    assert.equal(countOccurrences(html, `src="${QR_IMAGE}"`), 3);
    assert.deepEqual(qrCalls, [
      { content: QRService.getPCQRUrl(malformedAssetCode), size: 200 },
      { content: QRService.getPCQRUrl("ASSET-UTF-001"), size: 200 },
      { content: QRService.getKeyQRUrl(hostileKeyCode), size: 200 },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("print sheet keeps missing-lab error", async () => {
  const restores = mockPrintSheet(null, [], [], []);

  try {
    await assert.rejects(QRService.generatePrintSheet("missing-lab", "all"), /Lab tidak ditemukan/);
  } finally {
    restoreAll(restores);
  }
});
