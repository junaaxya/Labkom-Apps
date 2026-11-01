import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { SupportChatError } from "./support-chat.error";
import { SupportChatService } from "./support-chat.service";

type Restore = () => void;

function replaceProperty(target: object, property: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

function restoreAll(restores: readonly Restore[]): void {
  [...restores].reverse().forEach((restore) => restore());
}

const student = { id: "student-auth", name: "Mahasiswa", role: "MAHASISWA" } as const;
const assistant = { id: "assistant-first", name: "Asisten Pertama", role: "ASISTEN_LAB" } as const;
const otherAssistant = { id: "assistant-second", name: "Asisten Kedua", role: "ASISTEN_LAB" } as const;
const now = new Date("2026-10-13T03:30:00.000Z");

type MessageChat = {
  readonly id: string;
  readonly labId: string;
  readonly studentId: string;
  readonly assignedAssistantId: string | null;
  readonly status: "WAITING" | "HANDLED";
};

type ClaimUpdate = {
  readonly where: { readonly id: string; readonly status: "WAITING"; readonly assignedAssistantId: null };
  readonly data: { readonly assignedAssistantId: string; readonly status: "HANDLED"; readonly lastMessageAt: Date };
};

type RecipientDuty = {
  readonly shiftSchedule: {
    readonly id: string;
    readonly userId: string;
    readonly shift: { readonly startTime: string; readonly endTime: string };
    readonly scheduleDate: Date;
  };
};

type MessageTransaction = {
  readonly supportChat: {
    readonly findUnique: (query: unknown) => Promise<MessageChat | null>;
    readonly updateMany: (query: ClaimUpdate) => Promise<{ count: number }>;
  };
  readonly supportChatRecipient: { readonly findFirst: (query: unknown) => Promise<{ id: string } | RecipientDuty | null> };
  readonly supportChatMessage: { readonly create: (query: unknown) => Promise<unknown> };
};

function messageTransaction(chat: MessageChat, claimCount: number, claims: ClaimUpdate[], messageWrites: { count: number }): MessageTransaction {
  return {
    supportChat: {
      findUnique: async () => chat,
      updateMany: async (query) => {
        claims.push(query);
        return { count: claimCount };
      },
    },
    supportChatRecipient: {
      findFirst: async () => ({
        shiftSchedule: {
          id: "schedule-1",
          userId: assistant.id,
          shift: { startTime: "08:00", endTime: "12:00" },
          scheduleDate: new Date("2026-10-13T00:00:00.000Z"),
        },
      }),
    },
    supportChatMessage: {
      create: async () => {
        messageWrites.count += 1;
        return {
        id: "message-1",
        chatId: chat.id,
        senderId: assistant.id,
        body: "Pesan",
        createdAt: now,
        sender: assistant,
      };
      },
    },
  };
}

function chatDetail() {
  return {
    id: "chat-1",
    status: "WAITING" as const,
    studentId: student.id,
    assignedAssistantId: assistant.id,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    pc: { id: "pc-1", pcCode: "LAB-PC-01", name: "PC 01" },
    lab: { id: "lab-1", name: "Lab Dasar" },
    student,
    assignedAssistant: assistant,
    messages: [{
      id: "message-1",
      chatId: "chat-1",
      senderId: student.id,
      body: "Perlu bantuan",
      createdAt: now,
      sender: student,
    }],
  };
}

test("first active broadcast recipient conditionally claims WAITING chat before its reply is persisted", async () => {
  const claims: ClaimUpdate[] = [];
  const messageWrites = { count: 0 };
  const transactions = [
    messageTransaction({ id: "chat-1", labId: "lab-1", studentId: student.id, assignedAssistantId: null, status: "WAITING" }, 1, claims, messageWrites),
  ];
  const restore = replaceProperty(prisma, "$transaction", async (callback: (tx: MessageTransaction) => Promise<unknown>) => {
    const transaction = transactions.shift();
    if (!transaction) throw new Error("Unexpected support-chat transaction");
    return callback(transaction);
  });

  try {
    const assistantReply = await SupportChatService.createMessage("chat-1", { userId: assistant.id, role: "ASISTEN_LAB" }, { body: "Saya bantu" }, now);
    assert.equal(assistantReply.chatStatus, "HANDLED");
    assert.equal(messageWrites.count, 1);
    assert.deepEqual(claims, [{
      where: { id: "chat-1", status: "WAITING", assignedAssistantId: null },
      data: { assignedAssistantId: assistant.id, status: "HANDLED", lastMessageAt: now },
    }]);
  } finally {
    restore();
  }
});

test("a simultaneous loser receives 409 and writes no message when conditional claim affects zero rows", async () => {
  const claims: ClaimUpdate[] = [];
  const messageWrites = { count: 0 };
  const transaction = messageTransaction(
    { id: "chat-1", labId: "lab-1", studentId: student.id, assignedAssistantId: null, status: "WAITING" },
    0,
    claims,
    messageWrites,
  );
  const restore = replaceProperty(prisma, "$transaction", async (callback: (tx: MessageTransaction) => Promise<unknown>) => callback(transaction));

  try {
    await assert.rejects(
      SupportChatService.createMessage("chat-1", { userId: assistant.id, role: "ASISTEN_LAB" }, { body: "Saya bantu" }, now),
      (error: unknown) => error instanceof SupportChatError && error.statusCode === 409,
    );
    assert.equal(messageWrites.count, 0);
    assert.equal(claims.length, 1);
  } finally {
    restore();
  }
});

test("an unclaimed recipient may act only during their active duty window", async () => {
  let messageWrites = 0;
  const transaction: MessageTransaction = {
    supportChat: {
      findUnique: async () => ({ id: "chat-1", labId: "lab-1", studentId: student.id, assignedAssistantId: null, status: "WAITING" }),
      updateMany: async () => ({ count: 1 }),
    },
    supportChatRecipient: { findFirst: async () => null },
    supportChatMessage: { create: async () => { messageWrites += 1; return {}; } },
  };
  const restore = replaceProperty(prisma, "$transaction", async (callback: (tx: MessageTransaction) => Promise<unknown>) => callback(transaction));

  try {
    await assert.rejects(
      SupportChatService.createMessage("chat-1", { userId: assistant.id, role: "ASISTEN_LAB" }, { body: "Saya bantu" }, now),
      (error: unknown) => error instanceof SupportChatError && error.code === "NOT_PARTICIPANT",
    );
    assert.equal(messageWrites, 0);
  } finally {
    restore();
  }
});

test("after a claim, only the winning assistant and student retain support-chat access", async () => {
  let messageWrites = 0;
  let chatUpdates = 0;
  const messageTransaction: MessageTransaction = {
    supportChat: {
      findUnique: async () => ({ id: "chat-1", labId: "lab-1", studentId: student.id, assignedAssistantId: assistant.id, status: "WAITING" }),
      updateMany: async () => { chatUpdates += 1; return { count: 1 }; },
    },
    supportChatRecipient: { findFirst: async () => ({ id: "recipient-loser" }) },
    supportChatMessage: { create: async () => { messageWrites += 1; throw new Error("Unexpected message write"); } },
  };
  const restores = [
    replaceProperty(prisma.supportChat, "findUnique", async () => chatDetail()),
    replaceProperty(prisma, "$transaction", async (callback: (tx: MessageTransaction) => Promise<unknown>) => callback(messageTransaction)),
  ];

  try {
    await assert.rejects(SupportChatService.getChatById("chat-1", { userId: "other-student", role: "MAHASISWA" }), (error: unknown) => error instanceof SupportChatError && error.code === "NOT_PARTICIPANT");
    await assert.rejects(SupportChatService.getChatById("chat-1", { userId: otherAssistant.id, role: "ASISTEN_LAB" }), (error: unknown) => error instanceof SupportChatError && error.code === "NOT_PARTICIPANT");
    await assert.rejects(SupportChatService.createMessage("chat-1", { userId: otherAssistant.id, role: "ASISTEN_LAB" }, { body: "Menyusup" }, now), (error: unknown) => error instanceof SupportChatError && error.code === "CLAIM_LOST");
    await assert.rejects(SupportChatService.getChatById("chat-1", { userId: "coordinator-1", role: "KOORDINATOR_LAB" }), (error: unknown) => error instanceof SupportChatError && error.code === "NOT_PARTICIPANT");
    assert.equal((await SupportChatService.getChatById("chat-1", { userId: student.id, role: "MAHASISWA" })).id, "chat-1");
    assert.equal((await SupportChatService.getChatById("chat-1", { userId: assistant.id, role: "ASISTEN_LAB" })).id, "chat-1");
    assert.equal(messageWrites, 0);
    assert.equal(chatUpdates, 0);
  } finally {
    restoreAll(restores);
  }
});

test("an unclaimed broadcast recipient cannot use a different active duty from its captured shift", async () => {
  const capturedDuty = {
    id: "schedule-captured",
    userId: assistant.id,
    scheduleDate: new Date("2026-10-13T00:00:00.000Z"),
    shift: { startTime: "08:00", endTime: "09:00" },
  };
  const alternateActiveDuty = {
    id: "schedule-alternate",
    userId: assistant.id,
    scheduleDate: new Date("2026-10-13T00:00:00.000Z"),
    shift: { startTime: "09:00", endTime: "12:00" },
  };
  const unclaimedChat = {
    ...chatDetail(),
    labId: "lab-1",
    assignedAssistantId: null,
    assignedAssistant: null,
    recipients: [{ assistantId: assistant.id, shiftScheduleId: "schedule-1" }],
  };
  let recipientQuery: unknown;
  let alternateDutyLookups = 0;
  const restores = [
    replaceProperty(prisma.supportChat, "findUnique", async () => unclaimedChat),
    replaceProperty(prisma.supportChatRecipient, "findFirst", async (query: unknown) => {
      recipientQuery = query;
      return { shiftSchedule: capturedDuty };
    }),
    replaceProperty(prisma.asLabShiftSchedule, "findFirst", async () => {
      alternateDutyLookups += 1;
      return alternateActiveDuty;
    }),
  ];

  try {
    await assert.rejects(
      SupportChatService.getChatById("chat-1", { userId: assistant.id, role: "ASISTEN_LAB" }, now),
      (error: unknown) => error instanceof SupportChatError && error.code === "NOT_PARTICIPANT",
    );
    assert.equal(alternateDutyLookups, 0);
    assert.deepEqual(recipientQuery, {
      where: {
        chatId: "chat-1",
        assistantId: assistant.id,
        shiftSchedule: {
          is: {
            labId: "lab-1",
            userId: assistant.id,
            scheduleDate: { in: [new Date("2026-10-12T00:00:00.000Z"), new Date("2026-10-13T00:00:00.000Z")] },
            status: "SCHEDULED",
            user: { role: "ASISTEN_LAB", isActive: true },
            shift: { isActive: true },
          },
        },
      },
      select: {
        shiftSchedule: {
          select: {
            id: true,
            userId: true,
            scheduleDate: true,
            shift: { select: { startTime: true, endTime: true } },
          },
        },
      },
    });
  } finally {
    restoreAll(restores);
  }
});

test("chat list is scoped to the authenticated student, assigned assistant, or unclaimed snapshot recipient", async () => {
  const queries: Array<{ where: unknown }> = [];
  const restore = replaceProperty(prisma.supportChat, "findMany", async (query: { where: unknown }) => {
    queries.push(query);
    return [];
  });

  try {
    await SupportChatService.getChatsForUser({ userId: student.id, role: "MAHASISWA" });
    await SupportChatService.getChatsForUser({ userId: assistant.id, role: "ASISTEN_LAB" });
    await assert.rejects(SupportChatService.getChatsForUser({ userId: "coordinator-1", role: "KOORDINATOR_LAB" }), (error: unknown) => error instanceof SupportChatError && error.code === "NOT_PARTICIPANT");
    assert.deepEqual(queries.map((query) => query.where), [
      { studentId: student.id },
      {
        OR: [
          { assignedAssistantId: assistant.id },
          {
            status: "WAITING",
            assignedAssistantId: null,
            recipients: { some: { assistantId: assistant.id } },
          },
        ],
      },
    ]);
  } finally {
    restore();
  }
});

test("chat detail requests durable message history in createdAt and id order", async () => {
  let query: { include: { messages: { orderBy: unknown } } } | undefined;
  const restore = replaceProperty(prisma.supportChat, "findUnique", async (input: { include: { messages: { orderBy: unknown } } }) => {
    query = input;
    return chatDetail();
  });

  try {
    await SupportChatService.getChatById("chat-1", { userId: student.id, role: "MAHASISWA" });
    assert.deepEqual(query?.include.messages.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
  } finally {
    restore();
  }
});
