import prisma from "../config/database";

function getPeriodStart(period?: string): Date | undefined {
  const now = new Date();
  if (period === "weekly") { const start = new Date(now); start.setDate(now.getDate() - 7); return start; }
  if (period === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "semester") { const start = new Date(now); start.setMonth(now.getMonth() - 6); return start; }
  return undefined;
}

export class LeaderboardService {
  static async getFullLeaderboard(period?: string) {
    const startDate = getPeriodStart(period);

    const asistens = await prisma.user.findMany({
      where: { role: "ASISTEN_LAB", isActive: true },
      select: { id: true, name: true, avatar: true },
    });

    const aslebIds = asistens.map((a) => a.id);

    const [pointsData, missionsCompleted, scheduledShifts, completedAttendances, dailyTasks, ticketsResolved] = await prisma.$transaction([
      prisma.point.groupBy({
        by: ["userId"],
        where: { userId: { in: aslebIds }, ...(startDate && { createdAt: { gte: startDate } }) },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.missionClaim.groupBy({
        by: ["aslebId"],
        where: { aslebId: { in: aslebIds }, status: "APPROVED", ...(startDate && { verifiedAt: { gte: startDate } }) },
        _count: true,
      }),
      prisma.asLabShiftSchedule.findMany({
        where: { userId: { in: aslebIds }, status: "SCHEDULED", ...(startDate && { scheduleDate: { gte: startDate } }) },
        select: { id: true, userId: true },
      }),
      prisma.attendance.findMany({
        where: { userId: { in: aslebIds }, status: { in: ["CHECKED_OUT", "APPROVED"] }, ...(startDate && { createdAt: { gte: startDate } }) },
        select: { userId: true, shiftScheduleId: true },
      }),
      prisma.dailyTaskLog.groupBy({
        by: ["userId"],
        where: { userId: { in: aslebIds }, ...(startDate && { createdAt: { gte: startDate } }) },
        _count: true,
      }),
      prisma.ticket.groupBy({
        by: ["assignedTo"],
        where: { assignedTo: { in: aslebIds }, status: "RESOLVED", ...(startDate && { resolvedAt: { gte: startDate } }) },
        _count: true,
      }),
    ]);

    const scheduledByUser = new Map<string, number>();
    for (const schedule of scheduledShifts) {
      scheduledByUser.set(schedule.userId, (scheduledByUser.get(schedule.userId) || 0) + 1);
    }
    const scheduledIds = new Set(scheduledShifts.map((schedule) => schedule.id));
    const completedByUser = new Map<string, number>();
    for (const attendance of completedAttendances) {
      if (!attendance.shiftScheduleId || !scheduledIds.has(attendance.shiftScheduleId)) continue;
      completedByUser.set(attendance.userId, (completedByUser.get(attendance.userId) || 0) + 1);
    }

    const leaderboard = asistens.map((user) => {
      const points = pointsData.find((p) => p.userId === user.id);
      const missions = missionsCompleted.find((m) => m.aslebId === user.id);
      const tasks = dailyTasks.find((t) => t.userId === user.id);
      const tickets = ticketsResolved.find((t) => t.assignedTo === user.id);
      const scheduledCount = scheduledByUser.get(user.id) || 0;
      const totalAttendance = completedByUser.get(user.id) || 0;
      const attendanceRate = scheduledCount > 0 ? Math.round((totalAttendance / scheduledCount) * 100) : 0;

      return {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        totalPoints: points?._sum.amount || 0,
        missionsCompleted: missions?._count || 0,
        totalAttendance,
        attendanceRate,
        dailyTasksCompleted: tasks?._count || 0,
        ticketsResolved: tickets?._count || 0,
      };
    });

    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints || b.totalAttendance - a.totalAttendance || b.missionsCompleted - a.missionsCompleted || a.name.localeCompare(b.name, "id"));

    let previousPoints: number | undefined;
    let previousRank = 0;
    return leaderboard.map((entry, index) => {
      const rank = previousPoints === entry.totalPoints ? previousRank : index + 1;
      previousPoints = entry.totalPoints;
      previousRank = rank;
      return { rank, ...entry };
    });
  }

  static async getUserStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true, email: true, role: true },
    });
    if (!user) throw new Error("User tidak ditemukan");

    const [pointsHistory, pointRows] = await prisma.$transaction([
      prisma.point.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.point.findMany({ where: { userId }, select: { amount: true, reason: true } }),
    ]);
    const pointBreakdown = pointRows.reduce((totals, point) => {
      const category = point.reason.startsWith("Kehadiran") || point.reason.startsWith("Bonus datang") ? "attendance"
        : point.reason.startsWith("Misi selesai:") ? "mission" : "other";
      totals[category] += point.amount;
      return totals;
    }, { attendance: 0, mission: 0, other: 0 });

    const totalPoints = await prisma.point.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const missionStats = await prisma.missionClaim.groupBy({
      by: ["status"],
      where: { aslebId: userId },
      _count: true,
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyAttendance = await prisma.attendance.findMany({
      where: { userId, createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const completedSchedules = await prisma.asLabShiftSchedule.findMany({
      where: { userId, status: "SCHEDULED", scheduleDate: { gte: sixtyDaysAgo, lt: today } },
      include: { attendances: { select: { status: true } } },
      orderBy: [{ scheduleDate: "desc" }, { createdAt: "desc" }],
    });

    let streak = 0;
    for (const schedule of completedSchedules) {
      if (schedule.attendances.some((attendance) => ["CHECKED_OUT", "APPROVED"].includes(attendance.status))) streak++;
      else break;
    }

    return {
      user,
      totalPoints: totalPoints._sum.amount || 0,
      pointBreakdown,
      pointsHistory,
      missionStats: {
        completed: missionStats.find((m) => m.status === "APPROVED")?._count || 0,
        inProgress: missionStats.find((m) => m.status === "TAKEN")?._count || 0,
        submitted: missionStats.find((m) => m.status === "SUBMITTED")?._count || 0,
        rejected: missionStats.find((m) => m.status === "REJECTED")?._count || 0,
      },
      monthlyAttendance,
      streak,
    };
  }

  static async getOverallStats(period?: string) {
    const startDate = getPeriodStart(period);
    const totalAsistens = await prisma.user.count({
      where: { role: "ASISTEN_LAB", isActive: true },
    });

    const totalMissionsCompleted = await prisma.missionClaim.count({
      where: { status: "APPROVED", ...(startDate && { verifiedAt: { gte: startDate } }) },
    });

    const totalPointsAwarded = await prisma.point.aggregate({
      where: startDate ? { createdAt: { gte: startDate } } : undefined,
      _sum: { amount: true },
    });

    const totalTicketsResolved = await prisma.ticket.count({
      where: { status: "RESOLVED", ...(startDate && { resolvedAt: { gte: startDate } }) },
    });

    const activeMissions = await prisma.mission.count({
      where: { status: "OPEN" },
    });

    return {
      totalAsistens,
      totalMissionsCompleted,
      totalPointsAwarded: totalPointsAwarded._sum.amount || 0,
      totalTicketsResolved,
      activeMissions,
    };
  }
}
