import { z } from "zod";

export const submitConditionSchema = z.object({
  labId: z.string().min(1, "Lab ID wajib diisi"),
  fotoBukti: z.array(z.string()).min(1, "Minimal 1 foto bukti"),
  kerusakanBaru: z.string().optional(),
  catatanKondisi: z.string().optional(),
});

export type SubmitConditionInput = z.infer<typeof submitConditionSchema>;
