import { z } from "zod";

export const checkinAttendanceSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const addDailyTaskSchema = z.object({
  task: z.string().min(3, "Tugas minimal 3 karakter").max(200),
  description: z.string().optional(),
  category: z.enum(["PIKET_BERSIH", "MAINTENANCE_PC", "INVENTARIS", "INSTALASI", "PENDAMPINGAN", "ADMINISTRASI", "LAINNYA"]).default("LAINNYA"),
  photoUrl: z.string().url().optional().or(z.literal("")),
  duration: z.number().int().min(1).max(480).optional(),
  labId: z.string().optional(),
});

export type CheckinAttendanceInput = z.infer<typeof checkinAttendanceSchema>;
export type AddDailyTaskInput = z.infer<typeof addDailyTaskSchema>;
