import { z } from "zod";
import { TicketPriority, TicketStatus } from "@prisma/client";

const ticketCategorySchema = z.enum([
  "MOUSE",
  "KEYBOARD",
  "MONITOR",
  "CPU",
  "JARINGAN",
  "SOFTWARE",
  "KURSI_MEJA",
  "AC_LISTRIK",
  "PROYEKTOR",
  "LAINNYA",
]);

const ticketPrioritySchema = z.enum(TicketPriority);

const ticketTextSchema = z.string().trim().min(1).max(5000);

export const ticketIdParamSchema = z.object({
  id: z.string().trim().min(1, "Ticket ID wajib diisi"),
}).strict();

export const createTicketSchema = z.object({
  pcId: z.string().trim().min(1).optional(),
  labId: z.string().trim().min(1, "Lab ID wajib diisi"),
  category: ticketCategorySchema,
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(200),
  description: z.string().trim().max(5000).optional(),
  photo: z.array(z.string().trim().regex(/^\/uploads\/tickets\/[A-Za-z0-9._-]+$/, "Path foto ticket tidak valid")).max(5).default([]),
  priority: ticketPrioritySchema.default("MEDIUM"),
}).strict();

export const createQrTicketSchema = createTicketSchema
  .omit({ pcId: true, labId: true })
  .extend({ assetCode: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._-]+$/, "Asset code tidak valid") })
  .strict();

export const assignTicketSchema = z.object({
  assignedTo: z.string().trim().min(1, "Assignee wajib diisi"),
}).strict();

export const resolveTicketSchema = z.object({
  resolution: z.string().trim().max(5000).optional(),
  resolutionNotes: z.string().trim().max(5000).optional(),
}).strict().refine(
  (input) => input.resolution === undefined || input.resolutionNotes === undefined,
  { message: "Gunakan resolution atau resolutionNotes, bukan keduanya", path: ["resolutionNotes"] }
);

export const rejectTicketSchema = z.object({
  reason: z.string().trim().max(5000).optional(),
  rejectionReason: z.string().trim().max(5000).optional(),
}).strict().refine(
  (input) => input.reason === undefined || input.rejectionReason === undefined,
  { message: "Gunakan reason atau rejectionReason, bukan keduanya", path: ["rejectionReason"] }
);

export const transitionTicketSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("WAITING"),
    waitingReason: ticketTextSchema,
  }).strict(),
  z.object({
    status: z.literal("IN_PROGRESS"),
  }).strict(),
]);

export const ticketActionSchema = z.object({
  note: ticketTextSchema,
}).strict();

export const updateTicketSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  category: ticketCategorySchema.optional(),
  priority: ticketPrioritySchema.optional(),
}).strict().refine(
  (input) => Object.keys(input).length > 0,
  { message: "Minimal satu field ticket wajib diisi" }
);

export const ticketListQuerySchema = z.object({
  labId: z.string().trim().min(1).optional(),
  status: z.enum(TicketStatus).optional(),
  priority: ticketPrioritySchema.optional(),
  pcId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  reportedBy: z.string().trim().min(1).optional(),
  assignedTo: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>;
export type RejectTicketInput = z.infer<typeof rejectTicketSchema>;
export type TransitionTicketInput = z.infer<typeof transitionTicketSchema>;
export type TicketActionInput = z.infer<typeof ticketActionSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
