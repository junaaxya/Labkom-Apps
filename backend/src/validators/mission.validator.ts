import { z } from "zod";

export const createMissionSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter").max(200),
  description: z.string().optional(),
  points: z.number().int().min(1, "Poin minimal 1").max(1000),
  deadline: z.string().datetime().optional(),
});

export const submitMissionSchema = z.object({
  proof: z.string().min(1, "Bukti wajib diisi"),
});

export const verifyMissionSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type SubmitMissionInput = z.infer<typeof submitMissionSchema>;
export type VerifyMissionInput = z.infer<typeof verifyMissionSchema>;
