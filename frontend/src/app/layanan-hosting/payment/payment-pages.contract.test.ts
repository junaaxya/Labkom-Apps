import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("hosting payment result pages", () => {
  test("await Next.js 16 search params while preserving payment state and order display", () => {
    const failed = source("./failed/page.tsx");
    const success = source("./success/page.tsx");

    assert.match(failed, /async function HostingPaymentFailedPage/);
    assert.match(failed, /searchParams: Promise<\{ order_id\?: string \}>/);
    assert.match(failed, /const \{ order_id \} = await searchParams/);
    assert.match(failed, /Order ID: \{order_id\}/);
    assert.match(success, /async function HostingPaymentSuccessPage/);
    assert.match(success, /searchParams: Promise<\{ status\?: string; order_id\?: string \}>/);
    assert.match(success, /const \{ order_id, status \} = await searchParams/);
    assert.match(success, /const isPending = status === "pending"/);
    assert.match(success, /Order ID: \{order_id\}/);
  });
});
