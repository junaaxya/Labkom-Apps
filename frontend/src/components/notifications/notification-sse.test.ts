import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { createSseParser, parseNotificationEvent } from "./notification-sse";

describe("notification SSE client contract", () => {
  test("parses event data split across chunks and ignores other events", () => {
    const events: Array<{ event: string; data: string }> = [];
    const parser = createSseParser((event) => events.push(event));

    parser.push("event: connect");
    parser.push("ed\ndata: ok\n\nevent: notification\ndata: {\"id\":\"n1\"}\n\n");

    assert.deepEqual(events, [
      { event: "connected", data: "ok" },
      { event: "notification", data: '{"id":"n1"}' },
    ]);
    assert.equal(parseNotificationEvent(events[0]), null);
    assert.deepEqual(parseNotificationEvent(events[1]), { id: "n1" });
  });

  test("ignores malformed notification payloads", () => {
    assert.equal(parseNotificationEvent({ event: "notification", data: "{" }), null);
    assert.equal(parseNotificationEvent({ event: "unknown", data: "{}" }), null);
  });

  test("uses bearer fetch stream without URL token or EventSource", () => {
    const source = readFileSync(new URL("./notification-panel.tsx", import.meta.url), "utf8");
    assert.match(source, /Authorization: `Bearer \$\{token\}`/);
    assert.match(source, /fetch\(streamUrl/);
    assert.doesNotMatch(source, /EventSource/);
    assert.doesNotMatch(source, /\?token=/);
  });
});
