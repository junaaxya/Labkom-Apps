import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(__dirname, "support-chat.service.ts"), "utf8");
const accessSource = readFileSync(path.join(__dirname, "support-chat-access.ts"), "utf8");

test("assistant claims use a WAITING-and-unassigned CAS and notify captured recipients through sseManager", () => {
  assert.match(source, /static async claimChat\(chatId: string, actor: SupportChatActor, now = new Date\(\)\)/);
  assert.match(source, /updateMany\(\{\s*where: \{ id: chat\.id, status: "WAITING", assignedAssistantId: null \},\s*data: \{ assignedAssistantId: actor\.userId, status: "HANDLED" \}/s);
  assert.match(source, /if \(claim\.count !== 1\) throw new SupportChatError\("CLAIM_LOST"\);/);
  assert.match(source, /sseManager\.sendToUser\([^\n]+, "support-chat\.claimed", \{ chatId/);
});

test("assistant replies require the winning claim and never implicitly claim a waiting chat", () => {
  const createMessage = source.slice(source.indexOf("static async createMessage"), source.lastIndexOf("\n  }") + 4);
  assert.doesNotMatch(createMessage, /updateMany\(/);
  assert.match(createMessage, /if \(actor\.role === "ASISTEN_LAB" && chat\.assignedAssistantId !== actor\.userId\) \{\s*throw new SupportChatError\("NOT_PARTICIPANT"\);/s);
  assert.match(source, /sseManager\.sendToUser\([^\n]+, "support-chat\.message", \{ chatId/);
  assert.doesNotMatch(accessSource, /findActiveSupportChatRecipientDuty|isActiveSupportChatDuty|supportChatDutyDates/);
});

test("receipts accept messages from other party, preserve first delivery/read timestamps, and notify the sender", () => {
  assert.match(source, /static async recordReceipt\(chatId: string, messageId: string, actor: SupportChatActor, input: .*ReceiptInput/);
  assert.match(source, /senderId: \{ not: actor\.userId \}/);
  assert.match(source, /input\.status === "DELIVERED"[\s\S]*where: \{ id: messageId, chatId, deliveredAt: null \}[\s\S]*data: \{ deliveredAt: now \}/);
  assert.match(source, /input\.status === "READ"[\s\S]*where: \{ id: messageId, chatId, readAt: null \}[\s\S]*data: \{ readAt: now \}/);
  assert.match(source, /if \(updated\.count === 0\) return/);
  assert.match(source, /sseManager\.sendToUser\(message\.senderId, "support-chat\.message", \{ chatId, messageId/);
});
