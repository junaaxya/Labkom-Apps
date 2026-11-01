import type { Ticket } from "@prisma/client";
import { appendTicketEvent, TicketEventType } from "./ticket-event.service";
import { reconcilePcAfterTicketClosure } from "./ticket-pc-status";
import {
  assignmentUpdate,
  requireActiveActor,
  requireAssistant,
  requireCoordinator,
  requireTicket,
  requireTicketOperator,
  runTicketTransaction,
  terminalWhere,
  transitionWhere,
  type TicketActor,
} from "./ticket-workflow.support";
import { TicketConflictError, TicketValidationError } from "./ticket-workflow.error";
import {
  notifyTicketAssignment,
  notifyTicketRejected,
  notifyTicketResolved,
  notifyTicketResumed,
  notifyTicketWaiting,
} from "./ticket-workflow-notification.service";

export type { TicketActor } from "./ticket-workflow.support";

type TicketMutation = {
  readonly ticket: Ticket;
  readonly eventId: string;
};

export class TicketWorkflowService {
  static async claim(ticketId: string, actor: TicketActor): Promise<Ticket> {
    const result = await runTicketTransaction(async (tx): Promise<TicketMutation> => {
      const persistedActor = await requireActiveActor(tx, actor);
      requireAssistant(persistedActor);
      await requireTicket(tx, ticketId);

      const claimed = await tx.ticket.updateMany({
        where: { id: ticketId, status: "OPEN", assignedTo: null },
        data: { assignedTo: persistedActor.id, status: "IN_PROGRESS" },
      });
      if (claimed.count !== 1) {
        throw new TicketConflictError("Ticket tidak tersedia untuk diambil.");
      }
      const event = await appendTicketEvent(tx, {
        ticketId,
        actorId: persistedActor.id,
        eventType: TicketEventType.CLAIMED,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        fromAssigneeId: null,
        toAssigneeId: persistedActor.id,
        note: null,
      });
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { ticket, eventId: event.id };
    });

    await notifyTicketAssignment(result.ticket, result.eventId);
    return result.ticket;
  }

  static async assign(ticketId: string, assignedTo: string, actor: TicketActor): Promise<Ticket> {
    const result = await runTicketTransaction(async (tx): Promise<TicketMutation> => {
      const persistedActor = await requireActiveActor(tx, actor);
      requireCoordinator(persistedActor);
      const assignee = await tx.user.findUnique({
        where: { id: assignedTo },
        select: { id: true, role: true, isActive: true },
      });
      if (!assignee || !assignee.isActive || assignee.role !== "ASISTEN_LAB") {
        throw new TicketValidationError("Asisten Lab aktif tidak ditemukan.");
      }

      const currentTicket = await requireTicket(tx, ticketId);
      const assignment = assignmentUpdate(currentTicket);
      const updated = await tx.ticket.updateMany({
        where: assignment.where,
        data: { assignedTo: assignee.id, status: assignment.status },
      });
      if (updated.count !== 1) {
        throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
      }
      const event = await appendTicketEvent(tx, {
        ticketId,
        actorId: persistedActor.id,
        eventType: currentTicket.assignedTo && currentTicket.assignedTo !== assignee.id
          ? TicketEventType.REASSIGNED
          : TicketEventType.ASSIGNED,
        fromStatus: currentTicket.status,
        toStatus: assignment.status,
        fromAssigneeId: currentTicket.assignedTo,
        toAssigneeId: assignee.id,
        note: null,
      });
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { ticket, eventId: event.id };
    });

    await notifyTicketAssignment(result.ticket, result.eventId);
    return result.ticket;
  }

  static async transition(
    ticketId: string,
    targetStatus: "IN_PROGRESS" | "WAITING",
    actor: TicketActor,
    waitingReason?: string
  ): Promise<Ticket> {
    const normalizedWaitingReason = targetStatus === "WAITING"
      ? waitingReason?.trim() ?? null
      : null;
    if (targetStatus === "WAITING" && !normalizedWaitingReason) {
      throw new TicketValidationError("Alasan menunggu wajib diisi.");
    }

    const result = await runTicketTransaction(async (tx): Promise<TicketMutation> => {
      const persistedActor = await requireActiveActor(tx, actor);
      const currentTicket = await requireTicket(tx, ticketId);
      requireTicketOperator(persistedActor, currentTicket);
      const where = transitionWhere(currentTicket, targetStatus);
      const updated = await tx.ticket.updateMany({
        where,
        data: {
          status: targetStatus,
          waitingReason: targetStatus === "WAITING" ? normalizedWaitingReason : null,
        },
      });
      if (updated.count !== 1) {
        throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
      }
      const event = await appendTicketEvent(tx, {
        ticketId,
        actorId: persistedActor.id,
        eventType: targetStatus === "WAITING" ? TicketEventType.WAITING : TicketEventType.RESUMED,
        fromStatus: currentTicket.status,
        toStatus: targetStatus,
        fromAssigneeId: currentTicket.assignedTo,
        toAssigneeId: currentTicket.assignedTo,
        note: targetStatus === "WAITING" ? normalizedWaitingReason : currentTicket.waitingReason,
      });
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { ticket, eventId: event.id };
    });

    if (targetStatus === "WAITING") {
      await notifyTicketWaiting(result.ticket, result.eventId);
    } else {
      await notifyTicketResumed(result.ticket, result.eventId);
    }
    return result.ticket;
  }

  static async resolve(ticketId: string, actor: TicketActor, resolution?: string): Promise<Ticket> {
    const resolutionNotes = resolution?.trim() || null;
    const result = await runTicketTransaction(async (tx): Promise<TicketMutation> => {
      const persistedActor = await requireActiveActor(tx, actor);
      const currentTicket = await requireTicket(tx, ticketId);
      requireTicketOperator(persistedActor, currentTicket);
      const updated = await tx.ticket.updateMany({
        where: terminalWhere(currentTicket, "IN_PROGRESS"),
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolutionNotes,
          waitingReason: null,
          activeDuplicateKey: null,
        },
      });
      if (updated.count !== 1) {
        throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
      }
      const event = await appendTicketEvent(tx, {
        ticketId,
        actorId: persistedActor.id,
        eventType: TicketEventType.RESOLVED,
        fromStatus: currentTicket.status,
        toStatus: "RESOLVED",
        fromAssigneeId: currentTicket.assignedTo,
        toAssigneeId: currentTicket.assignedTo,
        note: resolutionNotes,
      });
      if (currentTicket.pcId) {
        await reconcilePcAfterTicketClosure(tx, {
          ticketId: currentTicket.id,
          pcId: currentTicket.pcId,
          actorId: persistedActor.id,
        });
      }
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { ticket, eventId: event.id };
    });

    await notifyTicketResolved(result.ticket, result.eventId);
    return result.ticket;
  }

  static async reject(ticketId: string, actor: TicketActor, reason?: string): Promise<Ticket> {
    const rejectionReason = reason?.trim() || null;
    const result = await runTicketTransaction(async (tx): Promise<TicketMutation> => {
      const persistedActor = await requireActiveActor(tx, actor);
      requireCoordinator(persistedActor);
      const currentTicket = await requireTicket(tx, ticketId);
      const updated = await tx.ticket.updateMany({
        where: terminalWhere(currentTicket, "OPEN"),
        data: { status: "REJECTED", rejectionReason, activeDuplicateKey: null },
      });
      if (updated.count !== 1) {
        throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
      }
      const event = await appendTicketEvent(tx, {
        ticketId,
        actorId: persistedActor.id,
        eventType: TicketEventType.REJECTED,
        fromStatus: currentTicket.status,
        toStatus: "REJECTED",
        fromAssigneeId: currentTicket.assignedTo,
        toAssigneeId: currentTicket.assignedTo,
        note: rejectionReason,
      });
      if (currentTicket.pcId) {
        await reconcilePcAfterTicketClosure(tx, {
          ticketId: currentTicket.id,
          pcId: currentTicket.pcId,
          actorId: persistedActor.id,
        });
      }
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      return { ticket, eventId: event.id };
    });

    await notifyTicketRejected(result.ticket, result.eventId);
    return result.ticket;
  }

}
