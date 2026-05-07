import { DayOfWeek, ScheduleChangeType } from "@prisma/client";
import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

export const createScheduleChangeSchema = z
  .object({
    requestType: z.nativeEnum(ScheduleChangeType),
    scheduleId: z.string().optional(),
    reason: z.string().min(10, "Alasan minimal 10 karakter"),
    newDay: z.nativeEnum(DayOfWeek).optional(),
    newStartTime: z.string().regex(timeRegex, "Format jam mulai harus HH:mm").optional(),
    newEndTime: z.string().regex(timeRegex, "Format jam selesai harus HH:mm").optional(),
    newLabId: z.string().optional(),
    cancelDate: z.string().date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newStartTime && data.newEndTime && data.newEndTime <= data.newStartTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Jam selesai harus lebih besar dari jam mulai",
        path: ["newEndTime"],
      });
    }

    if (data.requestType === "RESCHEDULE") {
      if (!data.scheduleId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scheduleId wajib diisi untuk RESCHEDULE",
          path: ["scheduleId"],
        });
      }
      if (!data.newDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newDay wajib diisi untuk RESCHEDULE",
          path: ["newDay"],
        });
      }
      if (!data.newStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newStartTime wajib diisi untuk RESCHEDULE",
          path: ["newStartTime"],
        });
      }
      if (!data.newEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newEndTime wajib diisi untuk RESCHEDULE",
          path: ["newEndTime"],
        });
      }
    }

    if (data.requestType === "CANCEL_SESSION") {
      if (!data.scheduleId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "scheduleId wajib diisi untuk CANCEL_SESSION",
          path: ["scheduleId"],
        });
      }
      if (!data.cancelDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "cancelDate wajib diisi untuk CANCEL_SESSION",
          path: ["cancelDate"],
        });
      }
    }

    if (data.requestType === "EXTRA_SLOT") {
      if (!data.newDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newDay wajib diisi untuk EXTRA_SLOT",
          path: ["newDay"],
        });
      }
      if (!data.newStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newStartTime wajib diisi untuk EXTRA_SLOT",
          path: ["newStartTime"],
        });
      }
      if (!data.newEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newEndTime wajib diisi untuk EXTRA_SLOT",
          path: ["newEndTime"],
        });
      }
      if (!data.newLabId && !data.scheduleId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "newLabId wajib diisi jika scheduleId tidak diberikan untuk EXTRA_SLOT",
          path: ["newLabId"],
        });
      }
    }
  });

export const approveScheduleChangeSchema = z.object({
  adminNotes: z.string().optional(),
});

export const rejectScheduleChangeSchema = z.object({
  rejectionReason: z.string().min(5, "Alasan penolakan minimal 5 karakter"),
});

export type CreateScheduleChangeInput = z.infer<typeof createScheduleChangeSchema>;
export type ApproveScheduleChangeInput = z.infer<typeof approveScheduleChangeSchema>;
export type RejectScheduleChangeInput = z.infer<typeof rejectScheduleChangeSchema>;
