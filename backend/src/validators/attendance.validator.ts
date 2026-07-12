import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD").refine(
  (value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  "Tanggal tidak valid",
);

const mondaySchema = isoDateSchema.refine(
  (value) => new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1,
  "weekStart harus hari Senin",
);

const requiredAssistantCountSchema = z.number().int().min(1).max(50);

const weeklyRoomSchema = z.object({
  labId: z.string().min(1, "labId wajib diisi"),
  requiredAssistantCount: requiredAssistantCountSchema.optional(),
}).strict();

const weeklyAssignmentSchema = z.object({
  date: isoDateSchema,
  labId: z.string().min(1, "labId wajib diisi"),
  requiredAssistantCount: requiredAssistantCountSchema,
  userIds: z.array(z.string().min(1)).min(1).refine((userIds) => new Set(userIds).size === userIds.length, "Aslab dalam satu lab harus berbeda"),
}).strict();

function hasUniqueGroups(assignments: Array<{ date: string; labId: string }>): boolean {
  return new Set(assignments.map(({ date, labId }) => `${date}:${labId}`)).size === assignments.length;
}

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

export const weeklyShiftPreviewSchema = z.object({
  weekStart: mondaySchema,
  shiftId: z.string().min(1, "shiftId wajib diisi"),
  rooms: z.array(weeklyRoomSchema).min(1, "rooms wajib memuat minimal satu lab").refine(
    (rooms) => new Set(rooms.map(({ labId }) => labId)).size === rooms.length,
    "rooms tidak boleh memuat lab yang sama lebih dari sekali",
  ),
}).strict();

export const weeklyShiftPlanSchema = z.object({
  weekStart: mondaySchema,
  shiftId: z.string().min(1, "shiftId wajib diisi"),
  notes: z.string().max(1000).optional(),
  assignments: z.array(weeklyAssignmentSchema).min(1).refine(
    hasUniqueGroups,
    "assignments tidak boleh memuat tanggal dan lab yang sama lebih dari sekali",
  ),
}).strict();

export const recurringShiftPlanSchema = z.object({
  effectiveFrom: mondaySchema,
  shiftId: z.string().min(1, "shiftId wajib diisi"),
  notes: z.string().max(1000).optional(),
  assignments: z.array(weeklyAssignmentSchema).min(1).refine(
    hasUniqueGroups,
    "assignments tidak boleh memuat tanggal dan lab yang sama lebih dari sekali",
  ),
}).strict();

export type CheckinAttendanceInput = z.infer<typeof checkinAttendanceSchema>;
export type AddDailyTaskInput = z.infer<typeof addDailyTaskSchema>;
export type WeeklyShiftPreviewInput = z.infer<typeof weeklyShiftPreviewSchema>;
export type WeeklyShiftPlanInput = z.infer<typeof weeklyShiftPlanSchema>;
export type RecurringShiftPlanInput = z.infer<typeof recurringShiftPlanSchema>;
