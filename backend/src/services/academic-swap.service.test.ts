import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(__dirname, "academic-swap.service.ts"), "utf8");

test("swap workflow is occurrence-only and never updates an official schedule", () => {
  assert.match(source, /withSerializableRetry/);
  assert.match(source, /AcademicOccurrenceSwap/);
  assert.match(source, /reservations/);
  assert.doesNotMatch(source, /tx\.schedule\.update/);
  assert.doesNotMatch(source, /tx\.schedule\.delete/);
});

test("swap approval guards active lab use, custody, booking, and release allocation", () => {
  assert.match(source, /keyBorrowCycle/);
  assert.match(source, /status: "BORROWED"/);
  assert.match(source, /logbook/);
  assert.match(source, /labBooking/);
  assert.match(source, /academicOccurrenceRelease/);
  assert.match(source, /PENDING_APPROVAL/);
});

test("swap notifications have deterministic per-recipient keys", () => {
  assert.match(source, /academic-swap:\$\{result\.id\}/);
  assert.match(source, /reminderKey/);
});
