import { appendTicketEvent, TicketEventType } from "./ticket-event.service";
import {
  requireActiveActor,
  requireTicket,
  requireTicketOperator,
  requireTicketViewer,
  runTicketTransaction,
  type TicketActor,
} from "./ticket-workflow.support";
import { TicketConflictError } from "./ticket-workflow.error";

export class TicketOperationHistoryService {
  static async addAction(ticketId: string, note: string, actor: TicketActor) {
    return runTicketTransaction(async (tx) => {
      const persistedActor = await requireActiveActor(tx, actor);
      const currentTicket = await requireTicket(tx, ticketId);
      requireTicketOperator(persistedActor, currentTicket);
      if (currentTicket.status !== "IN_PROGRESS" && currentTicket.status !== "WAITING") {
        throw new TicketConflictError("Catatan perbaikan hanya dapat ditambahkan pada ticket aktif.");
      }
      await appendTicketEvent(tx, {
        ticketId,
        actorId: persistedActor.id,
        eventType: TicketEventType.REPAIR_ACTION,
        fromStatus: currentTicket.status,
        toStatus: currentTicket.status,
        fromAssigneeId: currentTicket.assignedTo,
        toAssigneeId: currentTicket.assignedTo,
        note,
      });
      return tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    });
  }

  static async history(ticketId: string, actor: TicketActor) {
    return runTicketTransaction(async (tx) => {
      const persistedActor = await requireActiveActor(tx, actor);
      const ticket = await requireTicket(tx, ticketId);
      requireTicketViewer(persistedActor, ticket);
      return tx.ticketEvent.findMany({
        where: { ticketId },
        include: { actor: { select: { id: true, name: true, role: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    });
  }
}
