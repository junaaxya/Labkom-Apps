import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format waktu harus HH:mm valid");

const timeToMinutes = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const scheduleFieldsSchema = z.object({
  labId: z.string().min(1, "Lab ID wajib diisi"),
  title: z.string().min(2, "Judul minimal 2 karakter"),
  semester: z.string().optional(),
  className: z.string().optional(),
  lecturerName: z.string().optional(),
  assistantId: z.string().optional(),
  day: z.enum(["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"]),
  startTime: timeSchema,
  endTime: timeSchema,
  type: z.enum(["PRAKTIKUM", "PEMINJAMAN", "KEGIATAN"]).default("PRAKTIKUM"),
});

export const createScheduleSchema = scheduleFieldsSchema.refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
  message: "Jam selesai harus lebih besar dari jam mulai",
  path: ["endTime"],
});

export const updateScheduleSchema = scheduleFieldsSchema.partial().superRefine((data, ctx) => {
  if (!data.startTime || !data.endTime) return;
  if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
    ctx.addIssue({
      code: "custom",
      message: "Jam selesai harus lebih besar dari jam mulai",
      path: ["endTime"],
    });
  }
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
