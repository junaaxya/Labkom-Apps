import prisma from "../config/database";
import type { CreateLabInput, UpdateLabInput, CreatePCInput, UpdatePCInput } from "../validators/lab.validator";

export class LabService {
  static async getAllLabs(includeInactive = false) {
    return prisma.lab.findMany({
      where: includeInactive ? {} : { status: "ACTIVE" },
      include: {
        _count: { select: { pcs: true, schedules: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getLabById(id: string) {
    const lab = await prisma.lab.findUnique({
      where: { id },
      include: {
        pcs: { orderBy: { pcCode: "asc" } },
        _count: { select: { pcs: true, schedules: true, logbookConditions: true, tickets: true } },
      },
    });

    if (!lab) throw new Error("Lab tidak ditemukan");
    return lab;
  }

  static async createLab(data: CreateLabInput) {
    const existing = await prisma.lab.findUnique({ where: { name: data.name } });
    if (existing) throw new Error("Nama lab sudah digunakan");

    const lab = await prisma.lab.create({ data });

    // Auto-create key for new lab
    const shortName = lab.name.replace(/\s+/g, "").substring(0, 4).toUpperCase();
    const keyCode = `KEY-${shortName}-001`;
    const keyExists = await prisma.key.findUnique({ where: { keyCode } });
    if (!keyExists) {
      await prisma.key.create({
        data: {
          labId: lab.id,
          keyCode,
          qrCode: `${process.env.FRONTEND_URL || "http://localhost:3000"}/scan/key/${keyCode}`,
          status: "AVAILABLE",
        },
      });
    }

    return lab;
  }

  static async updateLab(id: string, data: UpdateLabInput) {
    const lab = await prisma.lab.findUnique({ where: { id } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    if (data.name && data.name !== lab.name) {
      const existing = await prisma.lab.findUnique({ where: { name: data.name } });
      if (existing) throw new Error("Nama lab sudah digunakan");
    }

    return prisma.lab.update({ where: { id }, data });
  }

  static async deleteLab(id: string) {
    const lab = await prisma.lab.findUnique({
      where: { id },
      include: { _count: { select: { pcs: true, schedules: true, shiftSchedules: true } } },
    });

    if (!lab) throw new Error("Lab tidak ditemukan");
    if (lab._count.pcs > 0 || lab._count.schedules > 0 || lab._count.shiftSchedules > 0) {
      throw new Error("Lab masih memiliki PC atau jadwal terkait. Hapus terlebih dahulu.");
    }

    return prisma.lab.delete({ where: { id } });
  }

  static async getPCsByLab(labId: string) {
    return prisma.pC.findMany({
      where: { labId },
      orderBy: { pcCode: "asc" },
    });
  }

  static async getPCById(id: string) {
    const pc = await prisma.pC.findUnique({
      where: { id },
      include: { lab: true },
    });
    if (!pc) throw new Error("PC tidak ditemukan");
    return pc;
  }

  static async createPC(data: CreatePCInput) {
    const lab = await prisma.lab.findUnique({ where: { id: data.labId } });
    if (!lab) throw new Error("Lab tidak ditemukan");

    const existing = await prisma.pC.findUnique({ where: { pcCode: data.pcCode } });
    if (existing) throw new Error("Kode PC sudah digunakan");

    const pc = await prisma.pC.create({ data });

    await prisma.lab.update({
      where: { id: data.labId },
      data: { capacity: { increment: 1 } },
    });

    return pc;
  }

  static async updatePC(id: string, data: UpdatePCInput) {
    const pc = await prisma.pC.findUnique({ where: { id } });
    if (!pc) throw new Error("PC tidak ditemukan");

    if (data.pcCode && data.pcCode !== pc.pcCode) {
      const existing = await prisma.pC.findUnique({ where: { pcCode: data.pcCode } });
      if (existing) throw new Error("Kode PC sudah digunakan");
    }

    return prisma.pC.update({ where: { id }, data });
  }

  static async deletePC(id: string) {
    const pc = await prisma.pC.findUnique({ where: { id } });
    if (!pc) throw new Error("PC tidak ditemukan");

    await prisma.$transaction([
      prisma.pCCommand.deleteMany({ where: { pcId: id } }),
      prisma.pcAgentLog.deleteMany({ where: { pcId: id } }),
      prisma.pcWarning.deleteMany({ where: { pcId: id } }),
      prisma.pCStatusLog.deleteMany({ where: { pcId: id } }),
      prisma.pC.delete({ where: { id } }),
      prisma.lab.update({
        where: { id: pc.labId },
        data: { capacity: { decrement: 1 } },
      }),
    ]);

    return pc;
  }

  static async getLabStats() {
    const [totalLabs, totalPCs, activeLabs] = await Promise.all([
      prisma.lab.count(),
      prisma.pC.count(),
      prisma.lab.count({ where: { status: "ACTIVE" } }),
    ]);

    const pcByStatus = await prisma.pC.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    return { totalLabs, totalPCs, activeLabs, pcByStatus };
  }
}
