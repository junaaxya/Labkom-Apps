import { z } from "zod";

export const createScheduleSchema = z.object({
  labId: z.string().min(1, "Lab ID wajib diisi"),
  title: z.string().min(2, "Judul minimal 2 karakter"),
  semester: z.string().optional(),
  className: z.string().optional(),
  lecturerName: z.string().optional(),
  assistantId: z.string().optional(),
  day: z.enum(["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format waktu harus HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format waktu harus HH:mm"),
  type: z.enum(["PRAKTIKUM", "PEMINJAMAN", "KEGIATAN"]).default("PRAKTIKUM"),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
