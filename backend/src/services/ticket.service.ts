import prisma from "../config/database";
import { notificationService } from "./notification.service";

const TICKET_CATEGORIES = [
  "MOUSE",
  "KEYBOARD",
  "MONITOR",
  "CPU",
  "JARINGAN",
  "SOFTWARE",
  "KURSI_MEJA",
  "AC_LISTRIK",
  "PROYEKTOR",
  "LAINNYA",
] as const;

export class TicketService {
  static async getAllTickets(filters?: {
    labId?: string;
    status?: string;
    priority?: string;
    pcId?: string;
    search?: string;
    reportedBy?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (filters?.labId) where.labId = filters.labId;
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.pcId) where.pcId = filters.pcId;
    if (filters?.reportedBy) where.reportedBy = filters.reportedBy;
    if (filters?.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
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
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getTicketById(id: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        pc: true,
        lab: true,
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });
    if (!ticket) throw new Error("Ticket tidak ditemukan");
    return ticket;
  }

  static async createTicket(data: {
    pcId?: string;
    labId: string;
    reportedBy: string;
    category: string;
    title: string;
    description?: string;
    photo?: string[];
    priority?: string;
  }) {
    if (!TICKET_CATEGORIES.includes(data.category as (typeof TICKET_CATEGORIES)[number])) {
      throw new Error("Kategori ticket tidak valid");
    }

    if (data.pcId) {
      const pc = await prisma.pC.findUnique({ where: { id: data.pcId } });
      if (pc) {
        await prisma.pC.update({
          where: { id: data.pcId },
          data: { status: "BROKEN" },
        });
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        pcId: data.pcId,
        labId: data.labId,
        reportedBy: data.reportedBy,
        category: data.category as any,
        title: data.title,
        description: data.description,
        photo: data.photo || [],
        priority: (data.priority as any) || "MEDIUM",
      },
      include: {
        lab: { select: { id: true, name: true } },
        pc: { select: { id: true, pcCode: true } },
      },
    });

    const pointsMap: Record<string, number> = {
      LOW: 10,
      MEDIUM: 20,
      HIGH: 30,
      CRITICAL: 50,
    };
    const missionPoints = pointsMap[ticket.priority] || 20;

    await prisma.mission.create({
      data: {
        title: `[Perbaikan] ${ticket.title}`,
        description: `Laporan kerusakan dari mahasiswa: ${ticket.description || ticket.title}. Lab: ${ticket.lab?.name || "Unknown"}${ticket.pc ? `, PC: ${ticket.pc.pcCode}` : ""}. Kategori: ${ticket.category}.`,
        points: missionPoints,
        status: "OPEN",
        createdById: data.reportedBy,
      },
    }).catch(() => {});

    return ticket;
  }

  static async assignTicket(ticketId: string, assignedTo: string) {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedTo, status: "IN_PROGRESS" },
    });

    await notificationService.notifyTicketAssigned(assignedTo, ticket.title, ticket.id);

    return ticket;
  }

  static async resolveTicket(ticketId: string, resolution?: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error("Ticket tidak ditemukan");

    if (ticket.pcId) {
      const pc = await prisma.pC.findUnique({ where: { id: ticket.pcId } });
      if (pc) {
        await prisma.pC.update({
          where: { id: ticket.pcId },
          data: { status: "AVAILABLE" },
        });
      }
    }

    const resolved = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        description: resolution
          ? [ticket.description, `Resolution: ${resolution}`].filter(Boolean).join("\n\n")
          : ticket.description,
      },
    });

    await notificationService.notifyTicketResolved(ticket.reportedBy, ticket.title, ticket.id);

    return resolved;
  }

  static async rejectTicket(ticketId: string, reason?: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error("Ticket tidak ditemukan");

    if (ticket.pcId) {
      const pc = await prisma.pC.findUnique({ where: { id: ticket.pcId } });
      if (pc) {
        await prisma.pC.update({
          where: { id: ticket.pcId },
          data: { status: "AVAILABLE" },
        });
      }
    }

    return prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: "REJECTED",
        description: reason ? [ticket.description, `Reason: ${reason}`].filter(Boolean).join("\n\n") : ticket.description,
      },
    });
  }

  static async getTicketStats() {
    const [
      total,
      open,
      inProgress,
      resolved,
      rejected,
      byCategoryRaw,
      byPriorityRaw,
    ] = await prisma.$transaction([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "RESOLVED" } }),
      prisma.ticket.count({ where: { status: "REJECTED" } }),
      prisma.ticket.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["priority"], _count: { _all: true } }),
    ]);

    const byCategory = TICKET_CATEGORIES.reduce((acc: Record<string, number>, category) => {
      acc[category] = byCategoryRaw.find((item) => item.category === category)?._count._all || 0;
      return acc;
    }, {});

    const byPriority = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].reduce((acc: Record<string, number>, priority) => {
      acc[priority] = byPriorityRaw.find((item) => item.priority === priority)?._count._all || 0;
      return acc;
    }, {});

    return {
      total,
      open,
      inProgress,
      resolved,
      rejected,
      byCategory,
      byPriority,
    };
  }

  static async getMyTickets(userId: string) {
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

  static async updateTicket(
    id: string,
    data: { title?: string; description?: string; category?: string; priority?: string },
    requesterId: string
  ) {
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new Error("Ticket tidak ditemukan");
    if (ticket.reportedBy !== requesterId) throw new Error("Anda tidak berhak mengubah ticket ini");
    if (ticket.status !== "OPEN") throw new Error("Ticket hanya bisa diubah saat status OPEN");

    if (data.category && !TICKET_CATEGORIES.includes(data.category as (typeof TICKET_CATEGORIES)[number])) {
      throw new Error("Kategori ticket tidak valid");
    }

    return prisma.ticket.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category as any,
        priority: data.priority as any,
      },
    });
  }
}
