import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

export const createAccessRequestSchema = z
  .object({
    type: z.enum(["PEMINJAMAN_LAB", "MAGANG", "AKSES_SEMENTARA"]),
    applicantName: z.string().min(2, "Nama minimal 2 karakter"),
    applicantEmail: z.string().email("Email tidak valid"),
    applicantPhone: z.string().optional(),
    institution: z.string().optional(),
    title: z.string().min(3, "Judul minimal 3 karakter"),
    description: z.string().optional(),
    purpose: z.string().optional(),
    date: z.coerce.date().optional(),
    startTime: z.string().regex(timeRegex, "Format jam mulai harus HH:mm").optional(),
    endTime: z.string().regex(timeRegex, "Format jam selesai harus HH:mm").optional(),
    participants: z.number().int().min(1, "Jumlah peserta minimal 1").optional(),
    requestedRole: z.enum(["MAGANG"]).optional(),
    labId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PEMINJAMAN_LAB") {
      if (!data.labId) ctx.addIssue({ code: "custom", path: ["labId"], message: "Lab wajib dipilih" });
      if (!data.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Tanggal wajib diisi" });
      if (!data.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Jam mulai wajib diisi" });
      if (!data.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai wajib diisi" });
      if (data.startTime && data.endTime && data.endTime <= data.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai harus lebih besar dari jam mulai" });
      }
      if (!data.participants) ctx.addIssue({ code: "custom", path: ["participants"], message: "Jumlah peserta wajib diisi" });
      return;
    }

    if (data.type === "MAGANG" && data.requestedRole !== "MAGANG") {
      ctx.addIssue({ code: "custom", path: ["requestedRole"], message: "Pengajuan magang wajib meminta role MAGANG" });
    }
  });

export const getAccessRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVISION"]).optional(),
  type: z.enum(["PEMINJAMAN_LAB", "MAGANG", "AKSES_SEMENTARA"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const updateAccessRequestStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION"]),
  reviewerNotes: z.string().optional(),
});

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
export type GetAccessRequestsQueryInput = z.infer<typeof getAccessRequestsQuerySchema>;
export type UpdateAccessRequestStatusInput = z.infer<typeof updateAccessRequestStatusSchema>;
