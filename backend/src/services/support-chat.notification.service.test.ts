import assert from "node:assert/strict";
import test from "node:test";
import { notificationService } from "./notification.service";

type Restore = () => void;

function replaceProperty(target: object, property: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

test("notifySupportChatAssigned delegates deduplicated broadcast recipients through bulk delivery", async () => {
  const inputs: unknown[] = [];
  const restore = replaceProperty(notificationService, "createBulk", async (input: unknown) => {
    inputs.push(input);
    return { count: 2 };
  });

  try {
    await notificationService.notifySupportChatAssigned({
      assistantIds: ["assistant-first", "assistant-second", "assistant-first"],
      chatId: "chat-1",
      studentName: "Mahasiswa",
      pcCode: "LAB-PC-01",
      labName: "Lab Dasar",
    });
    assert.deepEqual(inputs, [{
      userIds: ["assistant-first", "assistant-second"],
      type: "SUPPORT_CHAT_ASSIGNED",
      title: "Permintaan Bantuan Baru",
      message: "Mahasiswa membutuhkan bantuan di Lab Dasar, PC LAB-PC-01.",
      metadata: { chatId: "chat-1", link: "/support-chats/chat-1", source: "support-chat" },
    }]);
  } finally {
    restore();
  }
});
