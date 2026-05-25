import prisma from "../config/database";
import { notificationService } from "./notification.service";

export class MissionService {
  static async getAllMissions(filters?: { status?: string; createdById?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.createdById) where.createdById = filters.createdById;

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 20;
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.mission.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { claims: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.mission.count({ where }),
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

  static async getMissionById(id: string) {
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        claims: {
          include: {
            asleb: { select: { id: true, name: true } },
            verifiedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!mission) throw new Error("Misi tidak ditemukan");
    return mission;
  }

  static async createMission(data: { title: string; description?: string; points: number; deadline?: string; createdById: string }) {
    if (data.deadline) {
      const deadlineDate = new Date(data.deadline);
      if (Number.isNaN(deadlineDate.getTime())) throw new Error("Format deadline tidak valid");
      if (deadlineDate <= new Date()) throw new Error("Deadline harus di masa depan");
    }

    const mission = await prisma.mission.create({
      data: {
        title: data.title,
        description: data.description,
        points: data.points,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        createdById: data.createdById,
      },
    });

    await notificationService.notifyMissionAvailable(mission.title, mission.id);

    return mission;
  }

  static async claimMission(missionId: string, aslebId: string) {
    const mission = await prisma.mission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("Misi tidak ditemukan");
    if (mission.status !== "OPEN") throw new Error("Misi tidak tersedia");
    if (mission.deadline && mission.deadline < new Date()) throw new Error("Misi sudah kedaluwarsa");

    const existingClaim = await prisma.missionClaim.findFirst({
      where: { missionId, aslebId },
    });
    if (existingClaim) throw new Error("Anda sudah mengklaim misi ini");

    await prisma.mission.update({ where: { id: missionId }, data: { status: "TAKEN" } });

    return prisma.missionClaim.create({
      data: { missionId, aslebId, status: "TAKEN" },
    });
  }

  static async submitMission(claimId: string, aslebId: string, proof: string) {
    if (!proof || !proof.trim()) throw new Error("Bukti wajib diisi");

    const claim = await prisma.missionClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error("Claim tidak ditemukan");
    if (claim.aslebId !== aslebId) throw new Error("Anda tidak memiliki claim ini");
    if (claim.status !== "TAKEN") throw new Error("Claim sudah disubmit atau diverifikasi");

    return prisma.missionClaim.update({
      where: { id: claimId },
      data: { status: "SUBMITTED", proof },
    });
  }

  static async verifyMission(claimId: string, verifiedById: string, approved: boolean, notes?: string) {
    const claim = await prisma.missionClaim.findUnique({
      where: { id: claimId },
      include: { mission: true },
    });
    if (!claim) throw new Error("Claim tidak ditemukan");
    if (claim.status !== "SUBMITTED") throw new Error("Claim belum disubmit atau sudah diverifikasi");

    const status = approved ? "APPROVED" : "REJECTED";

    await prisma.missionClaim.update({
      where: { id: claimId },
      data: {
        status: status as any,
        verifiedById,
        verifiedAt: new Date(),
        proof: notes ? [claim.proof, `Notes: ${notes}`].filter(Boolean).join("\n\n") : claim.proof,
      },
    });

    if (approved) {
      const existingPoint = await prisma.point.findFirst({
        where: { referenceId: claim.missionId, userId: claim.aslebId },
      });
      await prisma.mission.update({ where: { id: claim.missionId }, data: { status: "APPROVED" } });
      if (!existingPoint) {
        await prisma.point.create({
          data: {
            userId: claim.aslebId,
            amount: claim.mission.points,
            reason: `Misi selesai: ${claim.mission.title}`,
            referenceId: claim.missionId,
          },
        });
      }
    } else {
      await prisma.mission.update({ where: { id: claim.missionId }, data: { status: "OPEN" } });
    }

    await notificationService.notifyMissionVerified(
      claim.aslebId,
      claim.mission.title,
      approved,
      claim.mission.points
    );

    return claim;
  }

  static async getMyMissions(userId: string) {
    return prisma.missionClaim.findMany({
      where: { aslebId: userId },
      include: {
        mission: {
          select: {
            id: true,
            title: true,
            description: true,
            points: true,
            deadline: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getMissionStats() {
    const [
      total,
      open,
      taken,
      submitted,
      approved,
      rejected,
      pointsAwarded,
    ] = await prisma.$transaction([
      prisma.mission.count(),
      prisma.mission.count({ where: { status: "OPEN" } }),
      prisma.mission.count({ where: { status: "TAKEN" } }),
      prisma.mission.count({ where: { status: "SUBMITTED" } }),
      prisma.mission.count({ where: { status: "APPROVED" } }),
      prisma.mission.count({ where: { status: "REJECTED" } }),
      prisma.point.aggregate({ _sum: { amount: true } }),
    ]);

    return {
      total,
      open,
      taken,
      submitted,
      approved,
      rejected,
      totalPointsAwarded: pointsAwarded._sum.amount || 0,
    };
  }

  static async expireOverdueMissions() {
    const now = new Date();
    const expired = await prisma.mission.updateMany({
      where: {
        status: "OPEN",
        deadline: { lt: now },
      },
      data: { status: "REJECTED" },
    });

    return { expiredCount: expired.count };
  }

  static async updateMission(
    id: string,
    data: { title?: string; description?: string; points?: number; deadline?: string | null }
  ) {
    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) throw new Error("Misi tidak ditemukan");
    if (mission.status !== "OPEN") throw new Error("Misi hanya bisa diubah saat status OPEN");

    let parsedDeadline: Date | null | undefined;
    if (data.deadline !== undefined) {
      if (data.deadline === null) {
        parsedDeadline = null;
      } else {
        parsedDeadline = new Date(data.deadline);
        if (Number.isNaN(parsedDeadline.getTime())) throw new Error("Format deadline tidak valid");
        if (parsedDeadline <= new Date()) throw new Error("Deadline harus di masa depan");
      }
    }

    return prisma.mission.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        points: data.points,
        deadline: parsedDeadline,
      },
    });
  }

  static async deleteMission(id: string) {
    const mission = await prisma.mission.findUnique({
      where: { id },
      include: { _count: { select: { claims: true } } },
    });

    if (!mission) throw new Error("Misi tidak ditemukan");
    if (mission.status !== "OPEN") throw new Error("Misi hanya bisa dihapus saat status OPEN");
    if (mission._count.claims > 0) throw new Error("Misi tidak bisa dihapus karena sudah memiliki claim");

    await prisma.mission.delete({ where: { id } });
    return { success: true };
  }

  static async getLeaderboard() {
    const points = await prisma.point.groupBy({
      by: ["userId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 20,
    });

    const userIds = points.map((p) => p.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });

    return points.map((p) => ({
      userId: p.userId,
      totalPoints: p._sum.amount || 0,
      user: users.find((u) => u.id === p.userId),
    }));
  }
}
