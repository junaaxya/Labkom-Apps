import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("ticket integrity migration is additive and enforces stable links", async () => {
  const sql = await readFile(resolve(process.cwd(), "prisma/migrations/20261101000000_add_ticket_integrity_links/migration.sql"), "utf8");
  assert.match(sql, /ADD COLUMN "activeDuplicateKey" TEXT/);
  assert.match(sql, /ADD COLUMN "sourceLogbookConditionId" TEXT/);
  assert.match(sql, /ADD COLUMN "sourceTicketId" TEXT/);
  assert.match(sql, /CREATE UNIQUE INDEX "tickets_activeDuplicateKey_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "tickets_sourceLogbookConditionId_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "missions_sourceTicketId_key"/);
  assert.match(sql, /CREATE TABLE "logbook_ticket_automation_attempts"/);
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE)\b/im);
});
