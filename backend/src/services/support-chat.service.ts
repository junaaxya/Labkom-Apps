import type { Prisma } from "@prisma/client";
import prisma from "../config/database";
import type { CreateSupportChatInput, CreateSupportChatMessageInput } from "../validators/support-chat.validator";
import { notificationService } from "./notification.service";
import { withSerializableRetry } from "./schedule-availability";
import {
  assertSupportChatParticipant,
  assertSupportChatRole,
  findActiveSupportChatRecipientDuty,
  isActiveSupportChatDuty,
  isSupportChatCapturedRecipient,
  supportChatDutyDates,
} from "./support-chat-access";
import type { SupportChatActor } from "./support-chat-access";
import { SupportChatError } from "./support-chat.error";

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

function toSummary(chat: SupportChatSummary) {
  const [lastMessage] = chat.messages;
  return {
    id: chat.id,
    status: chat.status,
    studentId: chat.studentId,
    assistantId: chat.assignedAssistantId,
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

      const duties = await transaction.asLabShiftSchedule.findMany({
        where: {
          labId: pc.labId,
          scheduleDate: { in: supportChatDutyDates(now) },
          status: "SCHEDULED",
          user: { role: "ASISTEN_LAB", isActive: true },
          shift: { isActive: true },
        },
        select: {
          id: true,
          userId: true,
          scheduleDate: true,
          shift: { select: { startTime: true, endTime: true } },
        },
        orderBy: [{ shift: { startTime: "asc" } }, { id: "asc" }],
      });
      const recipients = new Map<string, { assistantId: string; shiftScheduleId: string }>();
      for (const duty of duties) {
        if (isActiveSupportChatDuty(now, duty) && !recipients.has(duty.userId)) {
          recipients.set(duty.userId, { assistantId: duty.userId, shiftScheduleId: duty.id });
        }
      }
      const recipientSnapshots = [...recipients.values()];
      if (recipientSnapshots.length === 0) throw new SupportChatError("NO_CURRENT_DUTY");

      const chat = await transaction.supportChat.create({
        data: {
          pcId: pc.id,
          labId: pc.labId,
          studentId,
          assignedAssistantId: null,
          status: "WAITING",
          lastMessageAt: now,
          recipients: { create: recipientSnapshots },
          messages: { create: { senderId: studentId, body: input.body } },
        },
        include: detailInclude,
      });

      return { chat, pc, recipientIds: recipientSnapshots.map((recipient) => recipient.assistantId) };
    });

    await notificationService.notifySupportChatAssigned({
      assistantIds: created.recipientIds,
      chatId: created.chat.id,
      studentName: created.chat.student.name,
      pcCode: created.pc.pcCode,
      labName: created.pc.lab.name,
    });

    return toDetail(created.chat);
  }

  static async getChatsForUser(actor: SupportChatActor, now = new Date()) {
    assertSupportChatRole(actor);
    const where: Prisma.SupportChatWhereInput = actor.role === "MAHASISWA"
      ? { studentId: actor.userId }
      : {
          OR: [
            { assignedAssistantId: actor.userId },
            {
              status: "WAITING",
              assignedAssistantId: null,
              recipients: { some: { assistantId: actor.userId } },
            },
          ],
        };
    const chats = await prisma.supportChat.findMany({
      where,
      include: summaryInclude,
      orderBy: { lastMessageAt: "desc" },
    });
    if (actor.role === "MAHASISWA") return chats.map(toSummary);

    const accessibleChats = await Promise.all(chats.map(async (chat) => {
      if (chat.assignedAssistantId === actor.userId) return chat;
      if (chat.status !== "WAITING" || chat.assignedAssistantId !== null) return null;
      const duty = await findActiveSupportChatRecipientDuty(prisma, {
        chatId: chat.id,
        labId: chat.labId,
        assistantId: actor.userId,
        now,
      });
      return duty ? chat : null;
    }));
    return accessibleChats.filter((chat): chat is SupportChatSummary => chat !== null).map(toSummary);
  }

  static async getChatById(chatId: string, actor: SupportChatActor, now = new Date()) {
    const chat = await prisma.supportChat.findUnique({
      where: { id: chatId },
      include: detailInclude,
    });
    if (!chat) throw new SupportChatError("CHAT_NOT_FOUND");
    await assertSupportChatParticipant(prisma, { chat, actor, now });
    return toDetail(chat);
  }

  static async createMessage(chatId: string, actor: SupportChatActor, input: CreateSupportChatMessageInput, now = new Date()) {
    let attemptedClaim = false;
    return withSerializableRetry(async (transaction) => {
      const chat = await transaction.supportChat.findUnique({
        where: { id: chatId },
        select: { id: true, labId: true, studentId: true, assignedAssistantId: true, status: true },
      });
      if (!chat) throw new SupportChatError("CHAT_NOT_FOUND");
      assertSupportChatRole(actor);

      if (actor.role === "ASISTEN_LAB" && chat.status === "WAITING" && chat.assignedAssistantId === null) {
        const duty = await findActiveSupportChatRecipientDuty(transaction, {
          chatId: chat.id,
          labId: chat.labId,
          assistantId: actor.userId,
          now,
        });
        if (!duty) throw new SupportChatError("NOT_PARTICIPANT");

        attemptedClaim = true;
        const claim = await transaction.supportChat.updateMany({
          where: { id: chat.id, status: "WAITING", assignedAssistantId: null },
          data: { assignedAssistantId: actor.userId, status: "HANDLED", lastMessageAt: now },
        });
        if (claim.count !== 1) throw new SupportChatError("CLAIM_LOST");

        const message = await transaction.supportChatMessage.create({
          data: { chatId: chat.id, senderId: actor.userId, body: input.body, createdAt: now },
          include: { sender: { select: participantSelect } },
        });
        return { ...message, chatStatus: "HANDLED" as const };
      }

      if (
        actor.role === "ASISTEN_LAB" &&
        chat.assignedAssistantId !== actor.userId &&
        (attemptedClaim || await isSupportChatCapturedRecipient(transaction, chat.id, actor.userId))
      ) {
        throw new SupportChatError("CLAIM_LOST");
      }

      await assertSupportChatParticipant(transaction, { chat, actor, now });
      const message = await transaction.supportChatMessage.create({
        data: { chatId: chat.id, senderId: actor.userId, body: input.body, createdAt: now },
        include: { sender: { select: participantSelect } },
      });
      await transaction.supportChat.update({
        where: { id: chat.id },
        data: { lastMessageAt: now },
      });

      return { ...message, chatStatus: chat.status };
    });
  }
}
