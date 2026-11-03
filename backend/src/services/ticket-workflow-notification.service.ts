import type { Ticket } from "@prisma/client";
import { notificationService } from "./notification.service";

async function notifyPostCommit(
  message: string,
  notifications: readonly Promise<unknown>[]
): Promise<void> {
  const results = await Promise.allSettled(notifications);
  for (const result of results) {
    if (result.status === "rejected") console.error(message, result.reason);
  }
}

export async function notifyTicketAssignment(ticket: Ticket, eventId: string): Promise<void> {
  const notifications: Promise<unknown>[] = [
    notificationService.notifyTicketReporterInProgress(ticket.reportedBy, ticket.title, ticket.id, eventId),
  ];
  if (ticket.assignedTo) {
    notifications.push(notificationService.notifyTicketAssigned(ticket.assignedTo, ticket.title, ticket.id, eventId));
  }
  await notifyPostCommit("Ticket assignment notification failed", notifications);
}

export async function notifyTicketWaiting(ticket: Ticket, eventId: string): Promise<void> {
  await notifyPostCommit("Ticket waiting notification failed", [
    notificationService.notifyTicketWaiting(ticket.reportedBy, ticket.title, ticket.id, eventId),
  ]);
}

export async function notifyTicketResumed(ticket: Ticket, eventId: string): Promise<void> {
  await notifyPostCommit("Ticket resume notification failed", [
    notificationService.notifyTicketResumed(ticket.reportedBy, ticket.title, ticket.id, eventId),
  ]);
}

export async function notifyTicketResolved(ticket: Ticket, eventId: string): Promise<void> {
  await notifyPostCommit("Ticket resolution notification failed", [
    notificationService.notifyTicketResolved(ticket.reportedBy, ticket.title, ticket.id, eventId),
  ]);
}

export async function notifyTicketRejected(ticket: Ticket, eventId: string): Promise<void> {
  await notifyPostCommit("Ticket rejection notification failed", [
    notificationService.notifyTicketRejected(ticket.reportedBy, ticket.title, ticket.id, eventId),
  ]);
}
