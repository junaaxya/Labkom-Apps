import type { Prisma } from "@prisma/client";
import { evaluateShiftWindow } from "./attendance-security";
import { getJakartaClock } from "./jakarta-time";
import { SupportChatError } from "./support-chat.error";

export type SupportChatActor = {
  readonly userId: string;
  readonly role: string;
};

type SupportChatParticipant = {
  readonly id: string;
  readonly labId: string;
  readonly studentId: string;
  readonly assignedAssistantId: string | null;
  readonly status: "WAITING" | "HANDLED";
};

type ActiveRecipientDutyInput = {
  readonly chatId: string;
  readonly labId: string;
  readonly assistantId: string;
  readonly now: Date;
};

export function supportChatDutyDates(now: Date): Date[] {
  const clock = getJakartaClock(now);
  const previousDate = new Date(clock.date);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  return [previousDate, clock.date];
}

export function isActiveSupportChatDuty(now: Date, duty: {
  readonly scheduleDate: Date;
  readonly shift: { readonly startTime: string; readonly endTime: string };
}): boolean {
  const window = evaluateShiftWindow(now, duty.shift.startTime, duty.shift.endTime, 0, duty.scheduleDate);
  return now >= window.startsAt && now <= window.endsAt;
}

export async function findActiveSupportChatRecipientDuty(
  client: Prisma.TransactionClient,
  input: ActiveRecipientDutyInput,
) {
  const recipient = await client.supportChatRecipient.findFirst({
    where: {
      chatId: input.chatId,
      assistantId: input.assistantId,
      shiftSchedule: {
        is: {
          labId: input.labId,
          userId: input.assistantId,
          scheduleDate: { in: supportChatDutyDates(input.now) },
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

  const duty = recipient?.shiftSchedule;
  return duty && isActiveSupportChatDuty(input.now, duty) ? duty : null;
}

export async function isSupportChatCapturedRecipient(
  client: Prisma.TransactionClient,
  chatId: string,
  assistantId: string,
): Promise<boolean> {
  return Boolean(await client.supportChatRecipient.findFirst({
    where: { chatId, assistantId },
    select: { id: true },
  }));
}

export function assertSupportChatRole(actor: SupportChatActor): void {
  if (actor.role !== "MAHASISWA" && actor.role !== "ASISTEN_LAB") {
    throw new SupportChatError("NOT_PARTICIPANT");
  }
}

export async function assertSupportChatParticipant(
  client: Prisma.TransactionClient,
  input: { readonly chat: SupportChatParticipant; readonly actor: SupportChatActor; readonly now: Date },
): Promise<void> {
  assertSupportChatRole(input.actor);
  if (input.actor.role === "MAHASISWA" && input.chat.studentId === input.actor.userId) return;
  if (input.actor.role === "ASISTEN_LAB" && input.chat.assignedAssistantId === input.actor.userId) return;
  if (
    input.actor.role === "ASISTEN_LAB" &&
    input.chat.status === "WAITING" &&
    input.chat.assignedAssistantId === null &&
    await findActiveSupportChatRecipientDuty(client, {
      chatId: input.chat.id,
      labId: input.chat.labId,
      assistantId: input.actor.userId,
      now: input.now,
    })
  ) return;
  throw new SupportChatError("NOT_PARTICIPANT");
}
