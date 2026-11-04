import { z } from "zod";

const messageBody = z.string().trim().min(1, "Pesan wajib diisi").max(5000, "Pesan maksimal 5000 karakter");

export const createSupportChatSchema = z.object({
  pcId: z.string().trim().min(1, "PC wajib diisi"),
  body: messageBody,
}).strict();

export const createSupportChatMessageSchema = z.object({
  body: z.string().trim().max(5000, "Pesan maksimal 5000 karakter").default(""),
}).strict();

export const recordSupportChatReceiptSchema = z.object({
  status: z.enum(["DELIVERED", "READ"]),
}).strict();

export type CreateSupportChatInput = z.infer<typeof createSupportChatSchema>;
export type CreateSupportChatMessageInput = z.infer<typeof createSupportChatMessageSchema>;
export type RecordSupportChatReceiptInput = z.infer<typeof recordSupportChatReceiptSchema>;
