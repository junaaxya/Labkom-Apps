import { z } from "zod";

export const createHostingTransactionSchema = z.object({
  planId: z.string().min(1, "Paket wajib dipilih"),
  customer: z.object({
    fullName: z.string().trim().min(2, "Nama lengkap wajib diisi"),
    email: z.string().trim().email("Format email tidak valid"),
    whatsapp: z
      .string()
      .trim()
      .min(8, "Nomor WhatsApp wajib diisi")
      .regex(/^\+?[\d\s-]+$/, "Format nomor WhatsApp tidak valid"),
    notes: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
  }),
});

export type CreateHostingTransactionInput = z.infer<typeof createHostingTransactionSchema>;
