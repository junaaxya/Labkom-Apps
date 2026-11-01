import type { Prisma, TicketEvent, TicketStatus } from "@prisma/client";

export const TicketEventType = {
  CREATED: "CREATED",
  REPORTER_EDITED: "REPORTER_EDITED",
  CLAIMED: "CLAIMED",
  ASSIGNED: "ASSIGNED",
  REASSIGNED: "REASSIGNED",
  WAITING: "WAITING",
  RESUMED: "RESUMED",
  REPAIR_ACTION: "REPAIR_ACTION",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
} as const;

export type TicketEventType = (typeof TicketEventType)[keyof typeof TicketEventType];

export type TicketEventInput = {
  readonly ticketId: string;
  readonly actorId: string;
  readonly eventType: TicketEventType;
  readonly fromStatus: TicketStatus | null;
  readonly toStatus: TicketStatus | null;
  readonly fromAssigneeId: string | null;
  readonly toAssigneeId: string | null;
  readonly note: string | null;
};

export function appendTicketEvent(
  tx: Prisma.TransactionClient,
  input: TicketEventInput
): Promise<TicketEvent> {
  return tx.ticketEvent.create({ data: input });
}
