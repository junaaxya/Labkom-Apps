import { z } from "zod";

export const createTicketSchema = z.object({
  pcId: z.string().trim().min(1).optional(),
  labId: z.string().trim().min(1, "Lab ID wajib diisi"),
  category: z.enum(["MOUSE", "KEYBOARD", "MONITOR", "CPU", "JARINGAN", "SOFTWARE", "KURSI_MEJA", "AC_LISTRIK", "PROYEKTOR", "LAINNYA"]),
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(200),
  description: z.string().trim().max(5000).optional(),
  photo: z.array(z.string().trim().regex(/^\/uploads\/tickets\/[A-Za-z0-9._-]+$/, "Path foto ticket tidak valid")).max(5).default([]),
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
