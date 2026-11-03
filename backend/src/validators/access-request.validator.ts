import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

const accessRequestBaseSchema = z.object({
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
});

const magangPasswordSchema = z
  .string()
  .min(12, "Password minimal 12 karakter")
  .max(128, "Password maksimal 128 karakter")
  .regex(/[a-z]/, "Password harus mengandung huruf kecil")
  .regex(/[A-Z]/, "Password harus mengandung huruf besar")
  .regex(/\d/, "Password harus mengandung angka")
  .regex(/[^A-Za-z0-9]/, "Password harus mengandung simbol");

const publicBorrowingRequestSchema = accessRequestBaseSchema
  .extend({ type: z.literal("PEMINJAMAN_LAB") })
  .superRefine((data, ctx) => {
    if (!data.labId) ctx.addIssue({ code: "custom", path: ["labId"], message: "Lab wajib dipilih" });
    if (!data.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Tanggal wajib diisi" });
    if (!data.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Jam mulai wajib diisi" });
    if (!data.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai wajib diisi" });
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Jam selesai harus lebih besar dari jam mulai" });
    }
    if (!data.participants) ctx.addIssue({ code: "custom", path: ["participants"], message: "Jumlah peserta wajib diisi" });
  });

const publicTemporaryRequestSchema = accessRequestBaseSchema.extend({ type: z.literal("AKSES_SEMENTARA") });

const publicMagangRequestSchema = accessRequestBaseSchema
  .extend({
    type: z.literal("MAGANG"),
    password: magangPasswordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .superRefine((data, ctx) => {
    if (data.requestedRole !== "MAGANG") {
      ctx.addIssue({ code: "custom", path: ["requestedRole"], message: "Pengajuan magang wajib meminta role MAGANG" });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Konfirmasi password tidak sama" });
    }
  });

export const createAccessRequestSchema = z.discriminatedUnion("type", [
  publicBorrowingRequestSchema,
  publicTemporaryRequestSchema,
  publicMagangRequestSchema,
]);

export const verifyMagangEmailSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Token verifikasi tidak valid"),
});

export const resendMagangVerificationSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

export const getAccessRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REVISION"]).optional(),
  type: z.enum(["PEMINJAMAN_LAB", "MAGANG", "AKSES_SEMENTARA"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const updateAccessRequestStatusSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    reviewerNotes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "REJECTED") {
      const trimmed = data.reviewerNotes?.trim();
      if (!trimmed) {
        ctx.addIssue({ code: "custom", path: ["reviewerNotes"], message: "Catatan reviewer wajib diisi untuk penolakan" });
      }
    }
  });

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
export type GetAccessRequestsQueryInput = z.infer<typeof getAccessRequestsQuerySchema>;
export type UpdateAccessRequestStatusInput = z.infer<typeof updateAccessRequestStatusSchema>;
export type VerifyMagangEmailInput = z.infer<typeof verifyMagangEmailSchema>;
export type ResendMagangVerificationInput = z.infer<typeof resendMagangVerificationSchema>;
