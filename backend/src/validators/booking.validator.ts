import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

const baseBookingSchema = z
  .object({
    labId: z.string().min(1, "Lab wajib dipilih"),
    title: z.string().min(2, "Nama kegiatan minimal 2 karakter"),
    description: z.string().optional(),
    purpose: z.enum(["UKM", "Lomba", "Kerja Kelompok", "Riset", "Pelatihan", "Lainnya"]),
    date: z.coerce.date(),
    startTime: z.string().regex(timeRegex, "Format jam mulai harus HH:mm"),
    endTime: z.string().regex(timeRegex, "Format jam selesai harus HH:mm"),
    participants: z.number().int().min(1, "Jumlah peserta minimal 1").default(1),
    notes: z.string().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "Jam selesai harus lebih besar dari jam mulai",
    path: ["endTime"],
  });

export const createBookingSchema = baseBookingSchema;

export const getAllBookingsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  labId: z.string().optional(),
  date: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const rejectBookingSchema = z.object({
  reason: z.string().min(3, "Alasan penolakan minimal 3 karakter"),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type GetAllBookingsQueryInput = z.infer<typeof getAllBookingsQuerySchema>;
export type RejectBookingInput = z.infer<typeof rejectBookingSchema>;
