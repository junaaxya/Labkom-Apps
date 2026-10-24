import { z } from "zod";

const idSchema = z.string().cuid("ID tidak valid");
const codeSchema = z.string().trim().min(2, "Kode minimal 2 karakter").max(64, "Kode maksimal 64 karakter");
const nameSchema = z.string().trim().min(2, "Nama minimal 2 karakter").max(160, "Nama maksimal 160 karakter");
const optionalTextSchema = z.string().trim().max(2_000, "Teks maksimal 2000 karakter").nullable().optional();
const optionalDateSchema = z.coerce.date().nullable().optional();
const reportStatusSchema = z.enum(["TATAP_MUKA", "ONLINE", "TIDAK_MASUK", "PINDAH_JADWAL", "BELUM_PASTI"]);

const optionalBooleanQuerySchema = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
]).optional();

function hasFields(value: object): boolean {
  return Object.keys(value).length > 0;
}

function hasValidDateRange(value: { startDate?: Date | null; endDate?: Date | null }): boolean {
  return !value.startDate || !value.endDate || value.startDate <= value.endDate;
}

export const createAcademicDosenSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").max(128, "Password maksimal 128 karakter"),
  name: nameSchema,
  nip: z.string().trim().min(2, "NIP minimal 2 karakter").max(64, "NIP maksimal 64 karakter").optional(),
  phone: z.string().trim().max(32, "Nomor telepon maksimal 32 karakter").optional(),
});

export const updateAcademicDosenSchema = z.object({
  email: z.string().trim().email("Email tidak valid").optional(),
  name: nameSchema.optional(),
  nip: z.string().trim().min(2, "NIP minimal 2 karakter").max(64, "NIP maksimal 64 karakter").nullable().optional(),
  phone: z.string().trim().max(32, "Nomor telepon maksimal 32 karakter").nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(hasFields, "Data perubahan wajib diisi");

const academicTermSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  isActive: z.boolean().optional(),
});

export const createAcademicTermSchema = academicTermSchema.refine(hasValidDateRange, {
  message: "Tanggal mulai harus sebelum atau sama dengan tanggal selesai",
  path: ["endDate"],
});

export const updateAcademicTermSchema = academicTermSchema.partial().refine(hasFields, "Data perubahan wajib diisi");

export const createAcademicCourseSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  isActive: z.boolean().optional(),
});

export const updateAcademicCourseSchema = createAcademicCourseSchema.partial().refine(hasFields, "Data perubahan wajib diisi");

export const createAcademicClassSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  isActive: z.boolean().optional(),
});

export const updateAcademicClassSchema = createAcademicClassSchema.partial().refine(hasFields, "Data perubahan wajib diisi");

export const academicMembershipQuerySchema = z.object({
  termId: idSchema.optional(),
  classId: idSchema.optional(),
  userId: idSchema.optional(),
  isActive: optionalBooleanQuerySchema,
});

export const createAcademicMembershipSchema = z.object({
  termId: idSchema,
  classId: idSchema,
  userId: idSchema,
  isActive: z.boolean().optional(),
});

export const updateAcademicMembershipSchema = z.object({
  isActive: z.boolean(),
});

export const academicLeaderQuerySchema = z.object({
  termId: idSchema.optional(),
  classId: idSchema.optional(),
  isActive: optionalBooleanQuerySchema,
});

export const assignAcademicLeaderSchema = z.object({
  termId: idSchema,
  classId: idSchema,
  membershipId: idSchema,
});

export const updateAcademicLeaderSchema = z.object({
  isActive: z.boolean(),
});

export const academicOfferingQuerySchema = z.object({
  termId: idSchema.optional(),
  courseId: idSchema.optional(),
  classId: idSchema.optional(),
  dosenId: idSchema.optional(),
  isActive: optionalBooleanQuerySchema,
});

export const createAcademicOfferingSchema = z.object({
  termId: idSchema,
  courseId: idSchema,
  classId: idSchema,
  dosenId: idSchema,
  isActive: z.boolean().optional(),
});

export const updateAcademicOfferingSchema = z.object({
  dosenId: idSchema.optional(),
  isActive: z.boolean().optional(),
}).refine(hasFields, "Data perubahan wajib diisi");

export const bindAcademicScheduleSchema = z.object({ scheduleId: idSchema }).strict();

export const academicPjQuerySchema = z.object({
  offeringId: idSchema.optional(),
  membershipId: idSchema.optional(),
  isActive: optionalBooleanQuerySchema,
});

export const assignAcademicPjSchema = z.object({
  membershipId: idSchema,
});

export const updateAcademicPjSchema = z.object({
  isActive: z.boolean(),
});

export const academicReportQuerySchema = z.object({
  offeringId: idSchema.optional(),
  termId: idSchema.optional(),
  classId: idSchema.optional(),
  reportDate: z.coerce.date().optional(),
  status: reportStatusSchema.optional(),
});

export const createAcademicReportSchema = z.object({
  offeringId: idSchema,
  reportDate: z.coerce.date(),
  status: reportStatusSchema,
  notes: optionalTextSchema,
});

export const updateAcademicReportSchema = z.object({
  expectedRevision: z.coerce.number().int().positive("Revisi yang diharapkan wajib positif"),
  status: reportStatusSchema,
  notes: optionalTextSchema,
});

export const createAcademicOccurrenceReleaseSchema = z.object({ reportId: idSchema }).strict();
export const createAcademicSlotRequestSchema = z.object({
  releaseId: idSchema,
  targetOfferingId: idSchema,
  reason: optionalTextSchema,
}).strict();
export const reviewAcademicSlotRequestSchema = z.object({
  approved: z.boolean(),
  rejectionReason: optionalTextSchema,
}).superRefine((value, ctx) => {
  if (!value.approved && !value.rejectionReason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Alasan penolakan wajib diisi" });
  }
});

export type CreateAcademicDosenInput = z.infer<typeof createAcademicDosenSchema>;
export type UpdateAcademicDosenInput = z.infer<typeof updateAcademicDosenSchema>;
export type CreateAcademicTermInput = z.infer<typeof createAcademicTermSchema>;
export type UpdateAcademicTermInput = z.infer<typeof updateAcademicTermSchema>;
export type CreateAcademicCourseInput = z.infer<typeof createAcademicCourseSchema>;
export type UpdateAcademicCourseInput = z.infer<typeof updateAcademicCourseSchema>;
export type CreateAcademicClassInput = z.infer<typeof createAcademicClassSchema>;
export type UpdateAcademicClassInput = z.infer<typeof updateAcademicClassSchema>;
export type AcademicMembershipQueryInput = z.infer<typeof academicMembershipQuerySchema>;
export type CreateAcademicMembershipInput = z.infer<typeof createAcademicMembershipSchema>;
export type UpdateAcademicMembershipInput = z.infer<typeof updateAcademicMembershipSchema>;
export type AcademicLeaderQueryInput = z.infer<typeof academicLeaderQuerySchema>;
export type AssignAcademicLeaderInput = z.infer<typeof assignAcademicLeaderSchema>;
export type UpdateAcademicLeaderInput = z.infer<typeof updateAcademicLeaderSchema>;
export type AcademicOfferingQueryInput = z.infer<typeof academicOfferingQuerySchema>;
export type CreateAcademicOfferingInput = z.infer<typeof createAcademicOfferingSchema>;
export type UpdateAcademicOfferingInput = z.infer<typeof updateAcademicOfferingSchema>;
export type AcademicPjQueryInput = z.infer<typeof academicPjQuerySchema>;
export type AssignAcademicPjInput = z.infer<typeof assignAcademicPjSchema>;
export type UpdateAcademicPjInput = z.infer<typeof updateAcademicPjSchema>;
export type AcademicReportQueryInput = z.infer<typeof academicReportQuerySchema>;
export type CreateAcademicReportInput = z.infer<typeof createAcademicReportSchema>;
export type UpdateAcademicReportInput = z.infer<typeof updateAcademicReportSchema>;
export type CreateAcademicOccurrenceReleaseInput = z.infer<typeof createAcademicOccurrenceReleaseSchema>;
export type CreateAcademicSlotRequestInput = z.infer<typeof createAcademicSlotRequestSchema>;
export type ReviewAcademicSlotRequestInput = z.infer<typeof reviewAcademicSlotRequestSchema>;
