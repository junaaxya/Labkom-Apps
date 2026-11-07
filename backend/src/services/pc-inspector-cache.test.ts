import assert from "node:assert/strict";
import test from "node:test";
import { parseInspectorResult, readInspectorResult, saveInspectorResult } from "./pc-inspector-cache";

test("webcam snapshot overwrites previous value without putting base64 in DB summary", () => {
  const first = parseInspectorResult("CAPTURE_WEBCAM", JSON.stringify({ kind: "webcam", imageBase64: Buffer.from("first").toString("base64"), mimeType: "image/jpeg", width: 10, height: 8 }));
  const second = parseInspectorResult("CAPTURE_WEBCAM", JSON.stringify({ kind: "webcam", imageBase64: Buffer.from("next").toString("base64"), mimeType: "image/jpeg", width: 10, height: 8 }));
  assert.ok(first && second);
  saveInspectorResult("test-pc", first.cacheKey, first.value);
  saveInspectorResult("test-pc", second.cacheKey, second.value);
  assert.equal((readInspectorResult("test-pc", "webcam") as { imageBase64: string }).imageBase64, Buffer.from("next").toString("base64"));
  assert.doesNotMatch(second.summary, /bmV4dA==/);
  assert.equal(parseInspectorResult("CAPTURE_WEBCAM", JSON.stringify({ kind: "screen", imageBase64: "YQ==" })), null);
  assert.equal(parseInspectorResult("CAPTURE_WEBCAM", JSON.stringify({ kind: "webcam", imageBase64: "invalid!" })), null);
});

test("process list cached with count-only DB summary and rejected above limit", () => {
  const item = parseInspectorResult("LIST_PROCESSES", JSON.stringify({ kind: "processes", processes: [{ pid: 42, name: "editor" }] }));
  assert.ok(item);
  saveInspectorResult("test-pc", item.cacheKey, item.value);
  assert.equal(item.summary, "1 proses aktif ditemukan");
  assert.deepEqual((readInspectorResult("test-pc", "processes") as { processes: unknown[] }).processes, [{ pid: 42, name: "editor" }]);
  assert.equal(parseInspectorResult("LIST_PROCESSES", JSON.stringify({ kind: "processes", processes: ["x".repeat(300_000)] })), null);
});
