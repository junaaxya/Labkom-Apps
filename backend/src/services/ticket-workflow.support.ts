import { Prisma } from "@prisma/client";
import type { Ticket, TicketStatus } from "@prisma/client";
import {
  TicketAuthorizationError,
  TicketConflictError,
  TicketNotFoundError,
} from "./ticket-workflow.error";
import { withSerializableRetry } from "./schedule-availability";

export type TicketActor = {
  readonly userId: string;
};

type TicketAssignmentUpdate = {
  readonly where: Prisma.TicketWhereInput;
  readonly status: "IN_PROGRESS" | "WAITING";
};

type PersistedTicketActor = {
  readonly id: string;
  readonly role: string;
  readonly isActive: boolean;
};

export async function runTicketTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    return await withSerializableRetry(operation);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
    }
    throw error;
  }
}

export async function requireActiveActor(
  tx: Prisma.TransactionClient,
  actor: TicketActor
): Promise<PersistedTicketActor> {
  const persistedActor = await tx.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!persistedActor || !persistedActor.isActive) {
    throw new TicketAuthorizationError("Akun aktif diperlukan untuk mengelola ticket.");
  }
  return persistedActor;
}

export async function requireTicket(
  tx: Prisma.TransactionClient,
  ticketId: string
): Promise<Ticket> {
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new TicketNotFoundError("Ticket tidak ditemukan");
  return ticket;
}

export function requireAssistant(actor: { readonly role: string }): void {
  if (actor.role !== "ASISTEN_LAB") {
    throw new TicketAuthorizationError("Hanya Asisten Lab aktif yang dapat mengambil ticket.");
  }
}

export function requireCoordinator(actor: { readonly role: string }): void {
  if (actor.role !== "KOORDINATOR_LAB") {
    throw new TicketAuthorizationError("Hanya Koordinator Lab aktif yang dapat mengatur assignment ticket.");
  }
}

export function requireTicketOperator(
  actor: { readonly id: string; readonly role: string },
  ticket: Pick<Ticket, "assignedTo">
): void {
  if (actor.role === "KOORDINATOR_LAB") return;
  if (actor.role === "ASISTEN_LAB" && ticket.assignedTo === actor.id) return;
  if (actor.role === "ASISTEN_LAB") {
    throw new TicketAuthorizationError("Ticket hanya dapat dikelola oleh Asisten Lab yang ditugaskan.");
  }
  throw new TicketAuthorizationError("Anda tidak memiliki akses untuk mengelola ticket ini.");
}

export function requireTicketViewer(
  actor: { readonly id: string; readonly role: string },
  ticket: Pick<Ticket, "reportedBy">
): void {
  if (actor.role === "KOORDINATOR_LAB" || actor.role === "ASISTEN_LAB") return;
  if (ticket.reportedBy === actor.id) return;
  throw new TicketAuthorizationError("Anda tidak memiliki akses ke ticket ini.");
}

export function assignmentUpdate(
  ticket: Pick<Ticket, "id" | "status" | "assignedTo">
): TicketAssignmentUpdate {
  switch (ticket.status) {
    case "OPEN":
      if (ticket.assignedTo !== null) {
        throw new TicketConflictError("Ticket OPEN memiliki assignment tidak valid.");
      }
      return {
        where: { id: ticket.id, status: "OPEN", assignedTo: null },
        status: "IN_PROGRESS",
      };
    case "IN_PROGRESS":
    case "WAITING":
      if (ticket.assignedTo === null) {
        throw new TicketConflictError("Ticket aktif belum memiliki Asisten Lab.");
      }
      return {
        where: { id: ticket.id, status: ticket.status, assignedTo: ticket.assignedTo },
        status: ticket.status,
      };
    case "RESOLVED":
    case "REJECTED":
      throw new TicketConflictError("Ticket terminal tidak dapat di-assign ulang.");
  }
}

export function transitionWhere(
  ticket: Pick<Ticket, "id" | "status" | "assignedTo">,
  targetStatus: "IN_PROGRESS" | "WAITING"
): Prisma.TicketWhereInput {
  switch (ticket.status) {
    case "IN_PROGRESS":
      if (targetStatus === "WAITING") {
        return { id: ticket.id, status: "IN_PROGRESS", assignedTo: ticket.assignedTo };
      }
      throw new TicketConflictError("Ticket sudah dalam status IN_PROGRESS.");
    case "WAITING":
      if (targetStatus === "IN_PROGRESS") {
        return { id: ticket.id, status: "WAITING", assignedTo: ticket.assignedTo };
      }
      throw new TicketConflictError("Ticket sudah dalam status WAITING.");
    case "OPEN":
    case "RESOLVED":
    case "REJECTED":
      throw new TicketConflictError("Transisi status ticket tidak valid.");
  }
}

export function terminalWhere(
  ticket: Pick<Ticket, "id" | "status" | "assignedTo">,
  requiredStatus: TicketStatus
): Prisma.TicketWhereInput {
  if (ticket.status !== requiredStatus) {
    throw new TicketConflictError(`Ticket harus berstatus ${requiredStatus}.`);
  }
  return { id: ticket.id, status: requiredStatus, assignedTo: ticket.assignedTo };
}
