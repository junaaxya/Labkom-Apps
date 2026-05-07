import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { createUserSchema, updateUserSchema, resetPasswordSchema } from "../validators/user.validator";

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

export class UserController {
  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, role, search, isActive } = req.query;

      const result = await UserService.getAllUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        role: role as string | undefined,
        search: search as string | undefined,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data users";
      res.status(500).json({ success: false, message });
    }
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const id = getParam(req, "id");
      const user = await UserService.getUserById(id);
      res.json({ success: true, data: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data user";
      res.status(404).json({ success: false, message });
    }
  }

  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const validated = createUserSchema.parse(req.body);
      const user = await UserService.createUser(validated);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat user";
      res.status(400).json({ success: false, message });
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const id = getParam(req, "id");
      const validated = updateUserSchema.parse(req.body);
      const user = await UserService.updateUser(id, validated);
      res.json({ success: true, data: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengupdate user";
      res.status(400).json({ success: false, message });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const id = getParam(req, "id");
      const validated = resetPasswordSchema.parse(req.body);
      const result = await UserService.resetPassword(id, validated.newPassword);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal reset password";
      res.status(400).json({ success: false, message });
    }
  }

  static async toggleActive(req: Request, res: Response): Promise<void> {
    try {
      const id = getParam(req, "id");
      const user = await UserService.toggleActive(id);
      res.json({ success: true, data: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengubah status user";
      res.status(400).json({ success: false, message });
    }
  }

  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await UserService.getUserStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil statistik user";
      res.status(500).json({ success: false, message });
    }
  }
}
