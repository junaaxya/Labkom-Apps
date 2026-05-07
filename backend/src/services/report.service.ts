import prisma from "../config/database";

export class ReportService {
  static async getMonthlyReport(month: string) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    const [
      totalLogbooks,
      completedLogbooks,
      totalTickets,
      resolvedTickets,
      totalAttendance,
      lateAttendance,
      totalMissions,
      approvedMissions,
    ] = await Promise.all([
      prisma.logbook.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.logbook.count({ where: { createdAt: { gte: start, lte: end }, status: "COMPLETED" } }),
      prisma.ticket.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.ticket.count({ where: { createdAt: { gte: start, lte: end }, status: "RESOLVED" } }),
      prisma.attendance.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.attendance.count({ where: { createdAt: { gte: start, lte: end }, status: "LATE" } }),
      prisma.mission.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.mission.count({ where: { createdAt: { gte: start, lte: end }, status: "APPROVED" } }),
    ]);

    const labUsage = await prisma.logbookCondition.groupBy({
      by: ["labId"],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    });

    const labs = await prisma.lab.findMany({
      select: { id: true, name: true },
    });

    const labUsageWithNames = labUsage.map((l) => ({
      labId: l.labId,
      labName: labs.find((lab) => lab.id === l.labId)?.name || "Unknown",
      count: l._count._all,
    }));

    const ticketsByCategory = await prisma.ticket.groupBy({
      by: ["category"],
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
    });

    const topAssistants = await prisma.point.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    });

    const assistantIds = topAssistants.map((a) => a.userId);
    const assistants = await prisma.user.findMany({
      where: { id: { in: assistantIds } },
      select: { id: true, name: true },
    });

    const topAssistantsWithNames = topAssistants.map((a) => ({
      userId: a.userId,
      name: assistants.find((u) => u.id === a.userId)?.name || "Unknown",
      points: a._sum.amount || 0,
    }));

    return {
      period: { year, month: m, start, end },
      summary: {
        logbooks: { total: totalLogbooks, completed: completedLogbooks },
        tickets: { total: totalTickets, resolved: resolvedTickets },
        attendance: { total: totalAttendance, late: lateAttendance },
        missions: { total: totalMissions, approved: approvedMissions },
      },
      labUsage: labUsageWithNames,
      ticketsByCategory: ticketsByCategory.map((t) => ({
        category: t.category,
        count: t._count.id,
      })),
      topAssistants: topAssistantsWithNames,
    };
  }
}
