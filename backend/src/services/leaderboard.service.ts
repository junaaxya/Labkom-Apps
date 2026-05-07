import prisma from "../config/database";

export class LeaderboardService {
  static async getFullLeaderboard(period?: string) {
    const now = new Date();
    let startDate: Date | undefined;

    if (period === "weekly") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "semester") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
    }

    const asistens = await prisma.user.findMany({
      where: { role: "ASISTEN_LAB", isActive: true },
      select: { id: true, name: true, avatar: true, email: true },
    });

    const aslebIds = asistens.map((a) => a.id);

    const pointsData = await prisma.point.groupBy({
      by: ["userId"],
      where: {
        userId: { in: aslebIds },
        ...(startDate && { createdAt: { gte: startDate } }),
      },
      _sum: { amount: true },
      _count: true,
    });

    const missionsCompleted = await prisma.missionClaim.groupBy({
      by: ["aslebId"],
      where: {
        aslebId: { in: aslebIds },
        status: "APPROVED",
        ...(startDate && { verifiedAt: { gte: startDate } }),
      },
      _count: true,
    });

    const attendanceStats = await prisma.attendance.groupBy({
      by: ["userId"],
      where: {
        userId: { in: aslebIds },
        ...(startDate && { createdAt: { gte: startDate } }),
      },
      _count: true,
    });

    const onTimeAttendance = await prisma.attendance.groupBy({
      by: ["userId"],
      where: {
        userId: { in: aslebIds },
        status: { in: ["CHECKED_IN", "CHECKED_OUT", "APPROVED", "WAITING_VERIFICATION"] },
        ...(startDate && { createdAt: { gte: startDate } }),
      },
      _count: true,
    });

    const dailyTasks = await prisma.dailyTaskLog.groupBy({
      by: ["userId"],
      where: {
        userId: { in: aslebIds },
        ...(startDate && { createdAt: { gte: startDate } }),
      },
      _count: true,
    });

    const ticketsResolved = await prisma.ticket.groupBy({
      by: ["assignedTo"],
      where: {
        assignedTo: { in: aslebIds },
        status: "RESOLVED",
        ...(startDate && { resolvedAt: { gte: startDate } }),
      },
      _count: true,
    });

    const leaderboard = asistens.map((user) => {
      const points = pointsData.find((p) => p.userId === user.id);
      const missions = missionsCompleted.find((m) => m.aslebId === user.id);
      const attendance = attendanceStats.find((a) => a.userId === user.id);
      const onTime = onTimeAttendance.find((a) => a.userId === user.id);
      const tasks = dailyTasks.find((t) => t.userId === user.id);
      const tickets = ticketsResolved.find((t) => t.assignedTo === user.id);

      const totalAttendance = attendance?._count || 0;
      const attendanceRate = totalAttendance > 0 ? Math.round(((onTime?._count || 0) / totalAttendance) * 100) : 0;

      return {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        totalPoints: points?._sum.amount || 0,
        missionsCompleted: missions?._count || 0,
        totalAttendance,
        attendanceRate,
        dailyTasksCompleted: tasks?._count || 0,
        ticketsResolved: tickets?._count || 0,
      };
    });

    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
  }

  static async getUserStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true, email: true, role: true },
    });
    if (!user) throw new Error("User tidak ditemukan");

    const pointsHistory = await prisma.point.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

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

    const allAttendance = await prisma.attendance.findMany({
      where: {
        userId,
        status: {
          in: ["CHECKED_IN", "CHECKED_OUT", "APPROVED", "WAITING_VERIFICATION", "LATE"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dayStr = checkDate.toISOString().split("T")[0];

      const hasAttendance = allAttendance.some((a) => {
        const aDate = new Date(a.createdAt).toISOString().split("T")[0];
        return aDate === dayStr;
      });

      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      if (hasAttendance) {
        streak++;
      } else {
        break;
      }
    }

    return {
      user,
      totalPoints: totalPoints._sum.amount || 0,
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

  static async getOverallStats() {
    const totalAsistens = await prisma.user.count({
      where: { role: "ASISTEN_LAB", isActive: true },
    });

    const totalMissionsCompleted = await prisma.missionClaim.count({
      where: { status: "APPROVED" },
    });

    const totalPointsAwarded = await prisma.point.aggregate({
      _sum: { amount: true },
    });

    const totalTicketsResolved = await prisma.ticket.count({
      where: { status: "RESOLVED" },
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
