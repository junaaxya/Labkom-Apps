import { z } from "zod";

const schedulingDays = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;

export const smartSchedulingSuggestionQuerySchema = z.object({
  duration: z.coerce
    .number()
    .int("Durasi harus berupa angka bulat")
    .min(30, "Durasi minimal 30 menit")
    .max(810, "Durasi maksimal 810 menit")
    .refine((duration) => duration % 30 === 0, "Durasi harus kelipatan 30 menit")
    .default(120),
  day: z.enum(schedulingDays).optional(),
  labId: z.string().cuid("Lab ID tidak valid").optional(),
});

export type SmartSchedulingSuggestionQuery = z.infer<typeof smartSchedulingSuggestionQuerySchema>;
