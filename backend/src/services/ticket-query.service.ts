import { Prisma, TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import prisma from "../config/database";
import {
  requireActiveActor,
  requireTicketViewer,
  runTicketTransaction,
  type TicketActor,
} from "./ticket-workflow.support";
import { TicketNotFoundError } from "./ticket-workflow.error";

export type TicketFilters = {
  readonly labId?: string;
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  readonly pcId?: string;
  readonly search?: string;
  readonly reportedBy?: string;
  readonly assignedTo?: string;
  readonly page?: number;
  readonly limit?: number;
};

export class TicketQueryService {
  static async list(filters?: TicketFilters) {
    const where: Prisma.TicketWhereInput = {};
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.pcId) where.pcId = filters.pcId;
    if (filters?.reportedBy) where.reportedBy = filters.reportedBy;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters?.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;
    const [items, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        include: {
          pc: { select: { id: true, pcCode: true, name: true } },
          lab: { select: { id: true, name: true } },
          reporter: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async detail(id: string, actor: TicketActor) {
    return runTicketTransaction(async (tx) => {
      const persistedActor = await requireActiveActor(tx, actor);
      const ticket = await tx.ticket.findUnique({
        where: { id },
        include: {
          pc: true,
          lab: true,
          reporter: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });
      if (!ticket) throw new TicketNotFoundError("Ticket tidak ditemukan");
      requireTicketViewer(persistedActor, ticket);
      return ticket;
    });
  }

  static async stats() {
    const [
      total,
      open,
      inProgress,
      waiting,
      resolved,
      rejected,
      byCategoryRaw,
      byPriorityRaw,
    ] = await prisma.$transaction([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "WAITING" } }),
      prisma.ticket.count({ where: { status: "RESOLVED" } }),
      prisma.ticket.count({ where: { status: "REJECTED" } }),
      prisma.ticket.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["priority"], _count: { _all: true } }),
    ]);

    const byCategory: Record<TicketCategory, number> = {
      MOUSE: 0,
      KEYBOARD: 0,
      MONITOR: 0,
      CPU: 0,
      JARINGAN: 0,
      SOFTWARE: 0,
      KURSI_MEJA: 0,
      AC_LISTRIK: 0,
      PROYEKTOR: 0,
      LAINNYA: 0,
    };
    for (const category of Object.values(TicketCategory)) {
      byCategory[category] = byCategoryRaw.find((item) => item.category === category)?._count._all ?? 0;
    }

    const byPriority: Record<TicketPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const priority of Object.values(TicketPriority)) {
      byPriority[priority] = byPriorityRaw.find((item) => item.priority === priority)?._count._all ?? 0;
    }

    return { total, open, inProgress, waiting, resolved, rejected, byCategory, byPriority };
  }

  static async mine(userId: string) {
    return prisma.ticket.findMany({
      where: { reportedBy: userId },
      include: {
        pc: { select: { id: true, pcCode: true, name: true } },
        lab: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
