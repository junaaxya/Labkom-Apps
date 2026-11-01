import type { Prisma } from "@prisma/client";

const ACTIVE_TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING"] as const;

type TicketPcClosure = {
  readonly ticketId: string;
  readonly pcId: string;
  readonly actorId: string;
};

export async function reconcilePcAfterTicketClosure(
  tx: Prisma.TransactionClient,
  closure: TicketPcClosure
): Promise<void> {
  const remainingActiveTickets = await tx.ticket.count({
    where: {
      pcId: closure.pcId,
      id: { not: closure.ticketId },
      status: { in: [...ACTIVE_TICKET_STATUSES] },
    },
  });
  if (remainingActiveTickets > 0) return;

  const pc = await tx.pC.findUnique({
    where: { id: closure.pcId },
    select: { id: true, status: true },
  });
  if (!pc || pc.status !== "BROKEN") return;

  const restored = await tx.pC.updateMany({
    where: { id: pc.id, status: "BROKEN" },
    data: { status: "AVAILABLE" },
  });
  if (restored.count !== 1) return;

  await tx.pCStatusLog.create({
    data: {
      pcId: pc.id,
      fromStatus: "BROKEN",
      toStatus: "AVAILABLE",
      reason: "Semua ticket aktif pada PC telah ditutup",
      changedBy: closure.actorId,
    },
  });
}
