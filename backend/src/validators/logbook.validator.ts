import { z } from "zod";

export const checkinLogbookSchema = z.object({
  labId: z.string().trim().min(1, "Lab ID wajib diisi"),
  scheduleId: z.string().trim().min(1, "Schedule ID wajib diisi"),
  occurrenceDate: z.iso.date("Tanggal pertemuan harus berformat YYYY-MM-DD"),
}).strict();

export type CheckinLogbookInput = z.infer<typeof checkinLogbookSchema>;

export const submitConditionSchema = z.object({
  labId: z.string().min(1, "Lab ID wajib diisi"),
  fotoBukti: z.array(z.string()).min(1, "Minimal 1 foto bukti"),
  kerusakanBaru: z.string().optional(),
  catatanKondisi: z.string().optional(),
});

export type SubmitConditionInput = z.infer<typeof submitConditionSchema>;
