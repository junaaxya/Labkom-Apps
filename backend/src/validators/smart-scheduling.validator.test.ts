import assert from "node:assert/strict";
import test from "node:test";
import { smartSchedulingSuggestionQuerySchema } from "./smart-scheduling.validator";

test("suggestion query defaults duration and accepts aligned inputs", () => {
  assert.deepEqual(smartSchedulingSuggestionQuerySchema.parse({}), { duration: 120 });
  assert.deepEqual(
    smartSchedulingSuggestionQuerySchema.parse({
      duration: "90",
      day: "RABU",
      labId: "cmoseuhxj0001ofz5r10a18l1",
      targetDate: "2026-10-14",
    }),
    {
      duration: 90,
      day: "RABU",
      labId: "cmoseuhxj0001ofz5r10a18l1",
      targetDate: new Date("2026-10-14T00:00:00.000Z"),
    }
  );
});

test("suggestion query rejects unsupported duration, day, and lab identifiers", () => {
  assert.equal(smartSchedulingSuggestionQuerySchema.safeParse({ duration: "91" }).success, false);
  assert.equal(smartSchedulingSuggestionQuerySchema.safeParse({ day: "MINGGU" }).success, false);
  assert.equal(smartSchedulingSuggestionQuerySchema.safeParse({ labId: "not-a-cuid" }).success, false);
  assert.equal(smartSchedulingSuggestionQuerySchema.safeParse({ targetDate: "bukan-tanggal" }).success, false);
});
