import { z } from "zod";

export const takeKeySchema = z.object({
  notes: z.string().optional(),
});

export const returnKeySchema = z.object({
  notes: z.string().optional(),
});

export type TakeKeyInput = z.infer<typeof takeKeySchema>;
export type ReturnKeyInput = z.infer<typeof returnKeySchema>;
