import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  nim: z.string().optional(),
  nip: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"]),
  semester: z.string().optional(),
  className: z.string().optional(),
  isKetuaKelas: z.boolean().optional().default(false),
  waNotify: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  email: z.string().email("Email tidak valid").optional(),
  name: z.string().min(2, "Nama minimal 2 karakter").optional(),
  nim: z.string().nullable().optional(),
  nip: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"]).optional(),
  semester: z.string().nullable().optional(),
  className: z.string().nullable().optional(),
  isKetuaKelas: z.boolean().optional(),
  isActive: z.boolean().optional(),
  waNotify: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password minimal 6 karakter"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
