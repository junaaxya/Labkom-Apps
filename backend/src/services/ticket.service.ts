import { TicketOperationHistoryService } from "./ticket-operation-history.service";
import { TicketQueryService, type TicketFilters } from "./ticket-query.service";
import {
  TicketReporterService,
  type TicketCreateInput,
  type TicketUpdateInput,
} from "./ticket-reporter.service";
import { TicketWorkflowService, type TicketActor } from "./ticket-workflow.service";

export type { TicketCreateInput, TicketUpdateInput } from "./ticket-reporter.service";

export class TicketService {
  static getAllTickets(filters?: TicketFilters) {
    return TicketQueryService.list(filters);
  }

  static getTicketById(id: string, actor: TicketActor) {
    return TicketQueryService.detail(id, actor);
  }

  static createTicket(data: TicketCreateInput) {
    return TicketReporterService.create(data);
  }

  static claimTicket(ticketId: string, actor: TicketActor) {
    return TicketWorkflowService.claim(ticketId, actor);
  }

  static assignTicket(ticketId: string, assignedTo: string, actor: TicketActor) {
    return TicketWorkflowService.assign(ticketId, assignedTo, actor);
  }

  static transitionTicket(
    ticketId: string,
    targetStatus: "IN_PROGRESS" | "WAITING",
    actor: TicketActor,
    waitingReason?: string
  ) {
    return TicketWorkflowService.transition(ticketId, targetStatus, actor, waitingReason);
  }

  static addTicketAction(ticketId: string, note: string, actor: TicketActor) {
    return TicketOperationHistoryService.addAction(ticketId, note, actor);
  }

  static resolveTicket(ticketId: string, actor: TicketActor, resolution?: string) {
    return TicketWorkflowService.resolve(ticketId, actor, resolution);
  }

  static rejectTicket(ticketId: string, actor: TicketActor, reason?: string) {
    return TicketWorkflowService.reject(ticketId, actor, reason);
  }

  static getTicketHistory(ticketId: string, actor: TicketActor) {
    return TicketOperationHistoryService.history(ticketId, actor);
  }

  static getTicketStats() {
    return TicketQueryService.stats();
  }

  static getMyTickets(userId: string) {
    return TicketQueryService.mine(userId);
  }

  static updateTicket(id: string, data: TicketUpdateInput, requesterId: string) {
    return TicketReporterService.update(id, data, requesterId);
  }
}
