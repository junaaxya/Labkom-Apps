import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(__dirname, "support-chat.service.ts"), "utf8");

test("createChat snapshots every globally active assistant without lab or duty filtering", () => {
  const createChat = source.slice(source.indexOf("static async createChat"), source.indexOf("static async getChatsForUser"));
  assert.match(createChat, /transaction\.user\.findMany\(\{\s*where: \{ role: "ASISTEN_LAB", isActive: true \},\s*select: \{ id: true \},\s*orderBy: \{ id: "asc" \}/s);
  assert.match(createChat, /recipients: \{ create: assistants\.map\(\(assistant\) => \(\{ assistantId: assistant\.id \}\)\) \}/);
  assert.doesNotMatch(createChat, /asLabShiftSchedule|labId: pc\.labId|findActiveSupportChatRecipientDuty|supportChatDutyDates/);
});

test("createChat sends a targeted support-chat.created event to every recipient through sseManager only", () => {
  const createChat = source.slice(source.indexOf("static async createChat"), source.indexOf("static async getChatsForUser"));
  assert.match(createChat, /sseManager\.sendToUser\(assistantId, "support-chat\.created", \{ chatId: created\.chat\.id \}\)/);
  assert.doesNotMatch(createChat, /notificationService|sendToAll/);
});
