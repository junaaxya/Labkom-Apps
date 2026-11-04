import type { Prisma } from "@prisma/client";
import prisma from "../config/database";
import type {
  CreateSupportChatInput,
  CreateSupportChatMessageInput,
  RecordSupportChatReceiptInput,
} from "../validators/support-chat.validator";
import { notificationService } from "./notification.service";
import { withSerializableRetry } from "./schedule-availability";
import {
  assertSupportChatParticipant,
  assertSupportChatRole,
} from "./support-chat-access";
import type { SupportChatActor } from "./support-chat-access";
import { SupportChatError } from "./support-chat.error";
import { sseManager } from "./sse.service";

export type { SupportChatActor } from "./support-chat-access";

const participantSelect = {
  id: true,
  name: true,
  role: true,
} satisfies Prisma.UserSelect;

const summaryInclude = {
  pc: { select: { id: true, pcCode: true, name: true } },
  lab: { select: { id: true, name: true } },
  student: { select: participantSelect },
  assignedAssistant: { select: participantSelect },
  messages: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    include: { sender: { select: participantSelect } },
  },
} satisfies Prisma.SupportChatInclude;

const detailInclude = {
  pc: { select: { id: true, pcCode: true, name: true } },
  lab: { select: { id: true, name: true } },
  student: { select: participantSelect },
  assignedAssistant: { select: participantSelect },
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { sender: { select: participantSelect } },
  },
} satisfies Prisma.SupportChatInclude;

type SupportChatSummary = Prisma.SupportChatGetPayload<{ include: typeof summaryInclude }>;
type SupportChatDetail = Prisma.SupportChatGetPayload<{ include: typeof detailInclude }>;

async function notifySupportChatCreated(input: {
  readonly assistantIds: readonly string[];
  readonly chatId: string;
  readonly studentName: string;
  readonly pcCode: string;
  readonly labName: string;
}): Promise<void> {
  await notificationService.notifySupportChatAssigned(input);
}

async function claimSupportChatTransaction(chatId: string, actor: SupportChatActor) {
  return withSerializableRetry(async (transaction) => {
    assertSupportChatRole(actor);
    if (actor.role !== "ASISTEN_LAB") throw new SupportChatError("NOT_PARTICIPANT");

    const chat = await transaction.supportChat.findUnique({
      where: { id: chatId },
      select: { id: true },
    });
    if (!chat) throw new SupportChatError("CHAT_NOT_FOUND");
    const assistant = await transaction.user.findFirst({
      where: { id: actor.userId, role: "ASISTEN_LAB", isActive: true },
      select: { id: true },
    });
    if (!assistant) throw new SupportChatError("NOT_PARTICIPANT");

    const claim = await transaction.supportChat.updateMany({
      where: { id: chat.id, status: "WAITING", assignedAssistantId: null },
      data: { assignedAssistantId: actor.userId, status: "HANDLED" },
    });
    if (claim.count !== 1) throw new SupportChatError("CLAIM_LOST");

    const [claimedChat, recipients] = await Promise.all([
      transaction.supportChat.findUniqueOrThrow({ where: { id: chat.id }, include: detailInclude }),
      transaction.supportChatRecipient.findMany({
        where: { chatId: chat.id },
        select: { assistantId: true },
        orderBy: { assistantId: "asc" },
      }),
    ]);
    return { chat: claimedChat, recipientIds: recipients.map((recipient) => recipient.assistantId) };
  });
}

function toSummary(chat: SupportChatSummary) {
  const [lastMessage] = chat.messages;
  return {
    id: chat.id,
    status: chat.status,
    studentId: chat.studentId,
    assistantId: chat.assignedAssistantId,
    assignedAssistantId: chat.assignedAssistantId,
    lastMessageAt: chat.lastMessageAt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    pc: chat.pc,
    lab: chat.lab,
    student: chat.student,
    assistant: chat.assignedAssistant,
    lastMessage: lastMessage ?? null,
  };
}

function toDetail(chat: SupportChatDetail) {
  const lastMessage = chat.messages[chat.messages.length - 1] ?? null;
  return {
    id: chat.id,
    status: chat.status,
    studentId: chat.studentId,
    assistantId: chat.assignedAssistantId,
    assignedAssistantId: chat.assignedAssistantId,
    lastMessageAt: chat.lastMessageAt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    pc: chat.pc,
    lab: chat.lab,
    student: chat.student,
    assistant: chat.assignedAssistant,
    messages: chat.messages,
    lastMessage,
  };
}

export class SupportChatService {
  static async createChat(studentId: string, input: CreateSupportChatInput, now = new Date()) {
    const created = await withSerializableRetry(async (transaction) => {
      const pc = await transaction.pC.findUnique({
        where: { id: input.pcId },
        select: {
          id: true,
          labId: true,
          pcCode: true,
          lab: { select: { id: true, name: true } },
        },
      });
      if (!pc) throw new SupportChatError("PC_NOT_FOUND");

      const assistants = await transaction.user.findMany({
        where: { role: "ASISTEN_LAB", isActive: true },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (assistants.length === 0) throw new SupportChatError("NO_ACTIVE_ASSISTANT");

      const { id: pcId, labId, pcCode, lab } = pc;

      const chat = await transaction.supportChat.create({
        data: {
          pcId,
          labId,
          studentId,
          assignedAssistantId: null,
          status: "WAITING",
          lastMessageAt: now,
          recipients: { create: assistants.map((assistant) => ({ assistantId: assistant.id })) },
          messages: { create: { senderId: studentId, body: input.body, createdAt: now } },
        },
        include: detailInclude,
      });

      return { chat, pcCode, labName: lab.name, recipientIds: assistants.map((assistant) => assistant.id) };
    });

    for (const assistantId of created.recipientIds) {
      sseManager.sendToUser(assistantId, "support-chat.created", { chatId: created.chat.id });
    }
    void notifySupportChatCreated({
      assistantIds: created.recipientIds,
      chatId: created.chat.id,
      studentName: created.chat.student.name,
      pcCode: created.pcCode,
      labName: created.labName,
    }).catch(() => {});

    return toDetail(created.chat);
  }

  static async getChatsForUser(actor: SupportChatActor) {
    assertSupportChatRole(actor);
    const where: Prisma.SupportChatWhereInput = actor.role === "MAHASISWA"
      ? { studentId: actor.userId }
      : {
          OR: [
            { assignedAssistantId: actor.userId },
            { status: "WAITING", assignedAssistantId: null },
          ],
        };
    const chats = await prisma.supportChat.findMany({
      where,
      include: summaryInclude,
      orderBy: { lastMessageAt: "desc" },
    });
    if (actor.role === "MAHASISWA") return chats.map(toSummary);

    return chats.map(toSummary);
  }

  static async getChatById(chatId: string, actor: SupportChatActor) {
    const chat = await prisma.supportChat.findUnique({
      where: { id: chatId },
      include: detailInclude,
    });
    if (!chat) throw new SupportChatError("CHAT_NOT_FOUND");
    await assertSupportChatParticipant(prisma, { chat, actor });
    return toDetail(chat);
  }

  static async claimChat(chatId: string, actor: SupportChatActor, now = new Date()) {
    const claimed = await claimSupportChatTransaction(chatId, actor);
    for (const userId of new Set([claimed.chat.studentId, ...claimed.recipientIds])) {
      sseManager.sendToUser(userId, "support-chat.claimed", { chatId, assistantId: actor.userId });
    }
    return toDetail(claimed.chat);
  }

  static async recordReceipt(chatId: string, messageId: string, actor: SupportChatActor, input: RecordSupportChatReceiptInput, now = new Date()) {
    const { chat, message, changed } = await withSerializableRetry(async (transaction) => {
      const chat = await transaction.supportChat.findUnique({
        where: { id: chatId },
        select: { id: true, studentId: true, assignedAssistantId: true },
      });
      if (!chat) throw new SupportChatError("CHAT_NOT_FOUND");
      assertSupportChatRole(actor);

      const isStudent = actor.role === "MAHASISWA" && chat.studentId === actor.userId;
      const isAssistant = actor.role === "ASISTEN_LAB" && chat.assignedAssistantId === actor.userId;
      if (!isStudent && !isAssistant) {
        throw new SupportChatError("NOT_PARTICIPANT");
      }

      const message = await transaction.supportChatMessage.findFirst({
        where: {
          id: messageId,
          chatId,
          senderId: { not: actor.userId },
        },
        include: { sender: { select: participantSelect } },
      });
      if (!message) throw new SupportChatError("NOT_PARTICIPANT");

      if (input.status === "DELIVERED") {
        const updated = await transaction.supportChatMessage.updateMany({
          where: { id: messageId, chatId, deliveredAt: null },
          data: { deliveredAt: now },
        });
        if (updated.count === 0) return { chat, message, changed: false };
      } else if (input.status === "READ") {
        const delivered = await transaction.supportChatMessage.updateMany({
          where: { id: messageId, chatId, deliveredAt: null },
          data: { deliveredAt: now },
        });
        const updated = await transaction.supportChatMessage.updateMany({
          where: { id: messageId, chatId, readAt: null },
          data: { readAt: now },
        });
        if (updated.count === 0 && delivered.count === 0) return { chat, message, changed: false };
      }

      const updatedMessage = await transaction.supportChatMessage.findUniqueOrThrow({
        where: { id: messageId },
        include: { sender: { select: participantSelect } },
      });
      return { chat, message: updatedMessage, changed: true };
    });

    if (changed) {
      sseManager.sendToUser(message.senderId, "support-chat.message", { chatId, messageId, state: input.status });
    }
    return message;
  }

  static async createMessage(chatId: string, actor: SupportChatActor, input: CreateSupportChatMessageInput, now = new Date()) {
    const result = await withSerializableRetry(async (transaction) => {
      const chat = await transaction.supportChat.findUnique({
        where: { id: chatId },
        select: { id: true, studentId: true, assignedAssistantId: true, status: true },
      });
      if (!chat) throw new SupportChatError("CHAT_NOT_FOUND");
      assertSupportChatRole(actor);

      if (actor.role === "ASISTEN_LAB" && chat.status === "WAITING" && chat.assignedAssistantId === null) {
        throw new SupportChatError("CLAIM_REQUIRED");
      }
      if (actor.role === "ASISTEN_LAB" && chat.assignedAssistantId !== actor.userId) {
        throw new SupportChatError("NOT_PARTICIPANT");
      }

      await assertSupportChatParticipant(transaction, { chat, actor });
      const message = await transaction.supportChatMessage.create({
        data: { chatId: chat.id, senderId: actor.userId, body: input.body, createdAt: now },
        include: { sender: { select: participantSelect } },
      });
      await transaction.supportChat.update({
        where: { id: chat.id },
        data: { lastMessageAt: now },
      });

      const recipientIds = actor.role === "MAHASISWA"
        ? chat.assignedAssistantId
          ? [chat.assignedAssistantId]
          : (await transaction.supportChatRecipient.findMany({
              where: { chatId: chat.id },
              select: { assistantId: true },
            })).map((recipient) => recipient.assistantId)
        : [chat.studentId];

      return {
        message: { ...message, chatStatus: chat.status },
        recipientIds,
      };
    });

    for (const recipientId of result.recipientIds) {
      sseManager.sendToUser(recipientId, "support-chat.message", { chatId, messageId: result.message.id });
    }
    return result.message;
  }
}
