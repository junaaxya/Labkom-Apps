import prisma from "../config/database";
import { DayOfWeek } from "@prisma/client";
import { TicketService } from "./ticket.service";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const LOGBOOK_INCLUDE = {
  officialCheckinBy: { select: { id: true, name: true } },
  officialCheckoutBy: { select: { id: true, name: true } },
  conditions: {
    include: {
      lab: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

export class LogbookService {
  static async getAllLogbooks(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.officialCheckinById = filters.userId;

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters?.startDate) where.date.gte = new Date(filters.startDate);
      if (filters?.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.logbook.findMany({
        where,
        include: LOGBOOK_INCLUDE,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.logbook.count({ where }),
    ]);

    return {
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getLogbookById(id: string) {
    const logbook = await prisma.logbook.findUnique({
      where: { id },
      include: LOGBOOK_INCLUDE,
    });
    if (!logbook) throw new Error("Logbook tidak ditemukan");

    const labIds = (logbook.conditions || []).map((c) => c.labId);
    if (labIds.length === 0) return logbook;

    const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const logbookDate = new Date(logbook.date);
    const logbookDay = dayNames[logbookDate.getDay()];

    const [schedules, keyLogs] = await Promise.all([
      prisma.schedule.findMany({
        where: { labId: { in: labIds }, day: logbookDay as DayOfWeek, isActive: true },
        select: {
          id: true, labId: true, title: true, lecturerName: true,
          className: true, semester: true, startTime: true, endTime: true, type: true,
        },
      }),
      prisma.keyLog.findMany({
        where: {
          key: { labId: { in: labIds } },
          createdAt: { gte: logbookDate },
        },
        include: {
          user: { select: { id: true, name: true } },
          key: { select: { labId: true, keyCode: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const schedulesByLab: Record<string, typeof schedules> = {};
    for (const s of schedules) {
      if (!schedulesByLab[s.labId]) schedulesByLab[s.labId] = [];
      schedulesByLab[s.labId].push(s);
    }

    const enrichedConditions = (logbook.conditions || []).map((c) => ({
      ...c,
      schedules: schedulesByLab[c.labId] || [],
      keyLogs: keyLogs
        .filter((kl) => kl.key.labId === c.labId)
        .map((kl) => ({
          id: kl.id, action: kl.action, user: kl.user,
          keyCode: kl.key.keyCode, createdAt: kl.createdAt, notes: kl.notes,
        })),
    }));

    return { ...logbook, conditions: enrichedConditions };
  }

  static async checkin(userId: string) {
    const date = todayDate();

    const existing = await prisma.logbook.findFirst({
      where: { officialCheckinById: userId, date },
    });
    if (existing) throw new Error("Anda sudah check-in hari ini.");

    return prisma.logbook.create({
      data: {
        date,
        officialCheckinById: userId,
        officialCheckinAt: new Date(),
        status: "CHECKED_IN",
      },
      include: LOGBOOK_INCLUDE,
    });
  }

  static async getTodayLogbook(userId: string) {
    const date = todayDate();
    const logbook = await prisma.logbook.findFirst({
      where: { officialCheckinById: userId, date },
      include: LOGBOOK_INCLUDE,
    });
    if (!logbook) return null;

    const labIds = (logbook.conditions || []).map((c) => c.labId);
    const allLabIds = await prisma.lab.findMany({ select: { id: true } });
    const relevantLabIds = labIds.length > 0 ? labIds : allLabIds.map((l) => l.id);

    const now = new Date();
    const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    const todayDay = dayNames[now.getDay()];

    const [todaySchedules, todayKeyLogs] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          labId: { in: relevantLabIds },
          day: todayDay as DayOfWeek,
          isActive: true,
        },
        select: {
          id: true,
          labId: true,
          title: true,
          lecturerName: true,
          className: true,
          semester: true,
          startTime: true,
          endTime: true,
          type: true,
        },
      }),
      prisma.keyLog.findMany({
        where: {
          key: { labId: { in: relevantLabIds } },
          createdAt: { gte: date },
        },
        include: {
          user: { select: { id: true, name: true } },
          key: { select: { labId: true, keyCode: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const schedulesByLab: Record<string, typeof todaySchedules> = {};
    for (const s of todaySchedules) {
      if (!schedulesByLab[s.labId]) schedulesByLab[s.labId] = [];
      schedulesByLab[s.labId].push(s);
    }

    const keyLogsByLab: Record<string, typeof todayKeyLogs> = {};
    for (const log of todayKeyLogs) {
      const labId = log.key.labId;
      if (!keyLogsByLab[labId]) keyLogsByLab[labId] = [];
      keyLogsByLab[labId].push(log);
    }

    const enrichedConditions = (logbook.conditions || []).map((c) => ({
      ...c,
      schedules: schedulesByLab[c.labId] || [],
      keyLogs: (keyLogsByLab[c.labId] || []).map((kl) => ({
        id: kl.id,
        action: kl.action,
        user: kl.user,
        keyCode: kl.key.keyCode,
        createdAt: kl.createdAt,
        notes: kl.notes,
      })),
    }));

    return {
      ...logbook,
      conditions: enrichedConditions,
      schedulesByLab,
      keyLogsByLab: Object.fromEntries(
        Object.entries(keyLogsByLab).map(([labId, logs]) => [
          labId,
          logs.map((kl) => ({
            id: kl.id,
            action: kl.action,
            user: kl.user,
            keyCode: kl.key.keyCode,
            createdAt: kl.createdAt,
            notes: kl.notes,
          })),
        ])
      ),
    };
  }

  static async submitCondition(
    logbookId: string,
    labId: string,
    userId: string,
    userRole: string,
    conditionData: { fotoBukti: string[]; kerusakanBaru?: string; catatanKondisi?: string }
  ) {
    const logbook = await prisma.logbook.findUnique({ where: { id: logbookId } });
    if (!logbook) throw new Error("Logbook tidak ditemukan");
    if (logbook.status === "COMPLETED") throw new Error("Sesi sudah selesai");

    const lab = await prisma.lab.findUnique({ where: { id: labId } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    if (!["KOORDINATOR_LAB", "ASISTEN_LAB"].includes(userRole)) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.isKetuaKelas) {
        const key = await prisma.key.findFirst({
          where: { labId, currentHolderId: userId, status: "BORROWED" },
        });
        if (!key) throw new Error("Hanya ketua kelas atau pemegang kunci lab ini yang dapat mengisi kondisi.");
      }
    }

    const condition = await prisma.logbookCondition.upsert({
      where: { logbookId_labId: { logbookId, labId } },
      update: {
        submittedById: userId,
        fotoBukti: conditionData.fotoBukti,
        kerusakanBaru: conditionData.kerusakanBaru || null,
        catatanKondisi: conditionData.catatanKondisi || null,
      },
      create: {
        logbookId,
        labId,
        submittedById: userId,
        fotoBukti: conditionData.fotoBukti,
        kerusakanBaru: conditionData.kerusakanBaru || null,
        catatanKondisi: conditionData.catatanKondisi || null,
      },
    });

    if (conditionData.kerusakanBaru && conditionData.kerusakanBaru.trim().length > 0) {
      try {
        await TicketService.createTicket({
          labId,
          reportedBy: userId,
          category: "LAINNYA",
          title: `[Logbook] Kerusakan: ${conditionData.kerusakanBaru.substring(0, 80)}`,
          description: `Kerusakan dilaporkan via logbook.\n\nDetail: ${conditionData.kerusakanBaru}\n\nLogbook: ${logbookId}`,
          priority: "MEDIUM",
        });
      } catch {
        // fire-and-forget
      }
    }

    return condition;
  }

  static async verifyCondition(conditionId: string, userId: string) {
    const condition = await prisma.logbookCondition.findUnique({
      where: { id: conditionId },
      include: { logbook: true },
    });
    if (!condition) throw new Error("Kondisi tidak ditemukan");
    if (condition.verified) throw new Error("Kondisi sudah diverifikasi");

    return prisma.logbookCondition.update({
      where: { id: conditionId },
      data: { verified: true, verifiedById: userId, verifiedAt: new Date() },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  static async checkout(logbookId: string, userId: string) {
    const logbook = await prisma.logbook.findUnique({
      where: { id: logbookId },
      include: { conditions: true },
    });
    if (!logbook) throw new Error("Logbook tidak ditemukan");
    if (logbook.status === "COMPLETED") throw new Error("Sesi sudah selesai");

    const borrowedKeys = await prisma.key.findMany({
      where: { status: "BORROWED" },
      include: { lab: { select: { name: true } } },
    });
    if (borrowedKeys.length > 0) {
      const labNames = borrowedKeys.map((k) => k.lab.name).join(", ");
      throw new Error(`Masih ada kunci yang belum dikembalikan: ${labNames}. Semua kunci harus dikembalikan sebelum checkout.`);
    }

    const unverified = logbook.conditions.filter((c) => !c.verified);
    if (unverified.length > 0) {
      const unverifiedLabs = await prisma.lab.findMany({
        where: { id: { in: unverified.map((c) => c.labId) } },
        select: { name: true },
      });
      const names = unverifiedLabs.map((l) => l.name).join(", ");
      throw new Error(`Masih ada kondisi lab yang belum diverifikasi: ${names}. Verifikasi semua kondisi sebelum checkout.`);
    }

    return prisma.logbook.update({
      where: { id: logbookId },
      data: {
        officialCheckoutById: userId,
        officialCheckoutAt: new Date(),
        status: "COMPLETED",
      },
      include: LOGBOOK_INCLUDE,
    });
  }

  static async getActiveLogbooks() {
    return prisma.logbook.findMany({
      where: { status: { in: ["CHECKED_IN"] } },
      include: LOGBOOK_INCLUDE,
    });
  }

  static async getStats() {
    const { start, end } = todayRange();

    const [statusGroups, todaySessions, activeSessions, total] = await Promise.all([
      prisma.logbook.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.logbook.count({ where: { date: { gte: start, lte: end } } }),
      prisma.logbook.count({ where: { status: { in: ["CHECKED_IN"] } } }),
      prisma.logbook.count(),
    ]);

    const byStatus = statusGroups.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = item._count._all;
      return acc;
    }, {});

    return { total, todaySessions, activeSessions, byStatus };
  }
}
