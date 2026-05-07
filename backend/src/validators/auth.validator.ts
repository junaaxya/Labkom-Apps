import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const registerSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  nim: z.string().optional(),
  nip: z.string().optional(),
  role: z.enum(["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"]).default("MAHASISWA"),
  semester: z.string().optional(),
  className: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
