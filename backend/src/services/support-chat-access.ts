import type { Prisma } from "@prisma/client";
import { SupportChatError } from "./support-chat.error";

export type SupportChatActor = {
  readonly userId: string;
  readonly role: string;
};

type SupportChatParticipant = {
  readonly id: string;
  readonly studentId: string;
  readonly assignedAssistantId: string | null;
  readonly status: "WAITING" | "HANDLED";
};

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
  input: { readonly chat: SupportChatParticipant; readonly actor: SupportChatActor },
): Promise<void> {
  assertSupportChatRole(input.actor);
  if (input.actor.role === "MAHASISWA" && input.chat.studentId === input.actor.userId) return;
  if (input.actor.role === "ASISTEN_LAB" && input.chat.assignedAssistantId === input.actor.userId) return;
  if (
    input.actor.role === "ASISTEN_LAB" &&
    input.chat.status === "WAITING" &&
    input.chat.assignedAssistantId === null &&
    await isSupportChatCapturedRecipient(client, input.chat.id, input.actor.userId)
  ) return;
  throw new SupportChatError("NOT_PARTICIPANT");
}
