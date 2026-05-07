import { z } from "zod";

export const createTicketSchema = z.object({
  pcId: z.string().optional(),
  labId: z.string().min(1, "Lab ID wajib diisi"),
  category: z.enum(["MOUSE", "KEYBOARD", "MONITOR", "CPU", "JARINGAN", "SOFTWARE", "KURSI_MEJA", "AC_LISTRIK", "PROYEKTOR", "LAINNYA"]),
  title: z.string().min(3, "Judul minimal 3 karakter").max(200),
  description: z.string().optional(),
  photo: z.array(z.string()).default([]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export const assignTicketSchema = z.object({
  assignedTo: z.string().min(1, "Assignee wajib diisi"),
});

export const resolveTicketSchema = z.object({
  notes: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>;
