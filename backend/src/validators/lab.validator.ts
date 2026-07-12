import { z } from "zod";

export const createLabSchema = z.object({
  name: z.string().min(2, "Nama lab minimal 2 karakter"),
  location: z.string().min(2, "Lokasi minimal 2 karakter"),
  description: z.string().optional(),
  capacity: z.number().int().min(1, "Kapasitas minimal 1").default(0),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).default("ACTIVE"),
  isPicketEnabled: z.boolean().default(false),
  defaultPicketAssistantCount: z.number().int().min(1).max(50).default(2),
});

export const updateLabSchema = createLabSchema.partial();

export const createPCSchema = z.object({
  labId: z.string().min(1, "Lab ID wajib diisi"),
  pcCode: z.string().min(1, "Kode PC wajib diisi"),
  name: z.string().min(1, "Nama PC wajib diisi"),
  positionX: z.number().int().default(0),
  positionY: z.number().int().default(0),
  status: z.enum(["AVAILABLE", "IN_USE", "BROKEN", "MAINTENANCE", "INACTIVE"]).default("AVAILABLE"),
  qrCode: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  specs: z.string().optional(),
});

export const updatePCSchema = createPCSchema.partial().omit({ labId: true });

export type CreateLabInput = z.infer<typeof createLabSchema>;
export type UpdateLabInput = z.infer<typeof updateLabSchema>;
export type CreatePCInput = z.infer<typeof createPCSchema>;
export type UpdatePCInput = z.infer<typeof updatePCSchema>;
