import { z } from "zod";

const id = z.string().cuid("ID tidak valid");

export const assignSmartAcademicPjSchema = z.object({ studentId: id }).strict();
export const reportSmartAcademicOccurrenceSchema = z.object({
  scheduleId: id,
  occurrenceDate: z.coerce.date(),
  status: z.enum(["MASUK", "KOSONG", "ONLINE"]),
  source: z.string().trim().min(2, "Sumber informasi wajib diisi").max(160),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();
export const requestSmartAcademicMoveSchema = z.object({
  sourceReportId: id,
  targetScheduleId: id,
  reason: z.string().trim().max(2000).nullable().optional(),
}).strict();
export const reviewSmartAcademicMoveSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().trim().max(2000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (!value.approved && (!value.rejectionReason || value.rejectionReason.length < 3)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Alasan penolakan minimal 3 karakter" });
  }
});
