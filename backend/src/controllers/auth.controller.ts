import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import { z } from "zod";

const avatarSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (!value) return false;

      if (value.startsWith("/uploads/avatars/")) {
        return value.split("/").filter(Boolean).length === 3;
      }

      return z.string().url().safeParse(value).success;
    },
    { message: "Avatar harus berupa URL valid atau path /uploads/avatars/..." }
  );

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar: avatarSchema.optional(),
  semester: z.string().optional(),
  className: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password lama wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
});

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await AuthService.register(validated);

      res.status(201).json({
        success: true,
        message: "Registrasi berhasil",
        data: result,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({
          success: false,
          message: "Validasi gagal",
          errors: error.errors,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message || "Registrasi gagal",
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await AuthService.login(validated);

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: result,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({
          success: false,
          message: "Validasi gagal",
          errors: error.errors,
        });
        return;
      }

      res.status(401).json({
        success: false,
        message: error.message || "Login gagal",
      });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Tidak terautentikasi" });
        return;
      }

      const user = await AuthService.getProfile(req.user.userId);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || "User tidak ditemukan",
      });
    }
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Tidak terautentikasi" });
        return;
      }

      const validated = updateProfileSchema.parse(req.body);
      const user = await AuthService.updateProfile(req.user.userId, validated);

      res.status(200).json({
        success: true,
        message: "Profil berhasil diperbarui",
        data: user,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message || "Gagal update profil" });
    }
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Tidak terautentikasi" });
        return;
      }

      const validated = changePasswordSchema.parse(req.body);
      const result = await AuthService.changePassword(req.user.userId, validated.currentPassword, validated.newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message || "Gagal ubah password" });
    }
  }
}
