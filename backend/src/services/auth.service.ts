import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/database";
import { config } from "../config";
import { safeDeleteUpload } from "../config/upload";
import type { LoginInput, RegisterInput } from "../validators/auth.validator";

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("Email sudah terdaftar");
    }

    if (data.nim) {
      const existingNim = await prisma.user.findUnique({
        where: { nim: data.nim },
      });
      if (existingNim) throw new Error("NIM sudah terdaftar");
    }

    if (data.nip) {
      const existingNip = await prisma.user.findUnique({
        where: { nip: data.nip },
      });
      if (existingNip) throw new Error("NIP sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
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
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const token = this.generateToken(user.id, user.role);

    return { user, token };
  }

  static async login(data: LoginInput) {
    const identifier = (data.identifier ?? data.email ?? "").trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { email: identifier.toLowerCase() }, { nim: identifier }],
      },
    });

    if (!user) {
      throw new Error("NIM/email atau password salah");
    }

    if (!user.isActive) {
      throw new Error("Akun tidak aktif. Hubungi administrator.");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new Error("NIM/email atau password salah");
    }

    const token = this.generateToken(user.id, user.role);

    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
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
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new Error("User tidak ditemukan");

    return user;
  }

  static async updateProfile(userId: string, data: { name?: string; phone?: string; avatar?: string; semester?: string; className?: string }) {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
    if (!existing) throw new Error("User tidak ditemukan");

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
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
        phone: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (data.avatar && existing.avatar && existing.avatar !== data.avatar) {
      safeDeleteUpload(existing.avatar, ["avatars"]);
    }

    return user;
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User tidak ditemukan");

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new Error("Password lama salah");

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    return { message: "Password berhasil diubah", mustChangePassword: false };
  }

  private static generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as string,
    } as jwt.SignOptions);
  }
}
