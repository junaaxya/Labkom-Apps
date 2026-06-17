import bcrypt from "bcryptjs";
import prisma from "../config/database";
import type { CreateUserInput, UpdateUserInput } from "../validators/user.validator";

const userSelect = {
  id: true,
  email: true,
  name: true,
  nim: true,
  nip: true,
  role: true,
  semester: true,
  className: true,
  isKetuaKelas: true,
  avatar: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function normalizeKetuaKelasCapability<T extends { role?: string; isKetuaKelas?: boolean }>(data: T): T {
  if (data.role === "KOORDINATOR_LAB") {
    return { ...data, isKetuaKelas: false };
  }

  return data;
}

export class UserService {
  static async getAllUsers(params: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, role, search, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { nim: { contains: search, mode: "insensitive" } },
        { nip: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        schedulesAsLecturer: { select: { id: true, title: true } },
        schedulesAsAssistant: { select: { id: true, title: true } },
      },
    });

    if (!user) throw new Error("User tidak ditemukan");
    return user;
  }

  static async createUser(data: CreateUserInput) {
    const normalizedData = normalizeKetuaKelasCapability(data);

    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedData.email },
    });
    if (existingEmail) throw new Error("Email sudah terdaftar");

    if (normalizedData.nim) {
      const existingNim = await prisma.user.findUnique({
        where: { nim: normalizedData.nim },
      });
      if (existingNim) throw new Error("NIM sudah terdaftar");
    }

    if (normalizedData.nip) {
      const existingNip = await prisma.user.findUnique({
        where: { nip: normalizedData.nip },
      });
      if (existingNip) throw new Error("NIP sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(normalizedData.password, 12);

    const user = await prisma.user.create({
      data: {
        ...normalizedData,
        password: hashedPassword,
      },
      select: userSelect,
    });

    return user;
  }

  static async updateUser(id: string, data: UpdateUserInput) {
    const normalizedData = normalizeKetuaKelasCapability(data);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User tidak ditemukan");

    if (normalizedData.email && normalizedData.email !== existing.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedData.email },
      });
      if (existingEmail) throw new Error("Email sudah digunakan user lain");
    }

    if (normalizedData.nim && normalizedData.nim !== existing.nim) {
      const existingNim = await prisma.user.findUnique({
        where: { nim: normalizedData.nim },
      });
      if (existingNim) throw new Error("NIM sudah digunakan user lain");
    }

    if (normalizedData.nip && normalizedData.nip !== existing.nip) {
      const existingNip = await prisma.user.findUnique({
        where: { nip: normalizedData.nip },
      });
      if (existingNip) throw new Error("NIP sudah digunakan user lain");
    }

    const user = await prisma.user.update({
      where: { id },
      data: normalizedData,
      select: userSelect,
    });

    return user;
  }

  static async resetPassword(id: string, newPassword: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User tidak ditemukan");

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: "Password berhasil direset" };
  }

  static async toggleActive(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User tidak ditemukan");

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: userSelect,
    });

    return user;
  }

  static async getUserStats() {
    const [total, byRole, active, inactive] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: { id: true },
      }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
    ]);

    return {
      total,
      active,
      inactive,
      byRole: byRole.map((r) => ({ role: r.role, count: r._count.id })),
    };
  }
}
