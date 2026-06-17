import { z } from "zod";

export const assetCategorySchema = z.enum([
  "PC",
  "MONITOR",
  "KEYBOARD",
  "MOUSE",
  "PROJECTOR",
  "NETWORKING",
  "FURNITURE",
  "AC",
  "ELECTRICAL",
  "TOOL",
  "CONSUMABLE",
  "OTHER",
]);

export const assetConditionSchema = z.enum(["GOOD", "NEEDS_REPAIR", "BROKEN", "LOST", "RETIRED"]);
export const assetStatusSchema = z.enum(["ACTIVE", "IN_MAINTENANCE", "BORROWED", "STORED", "DISPOSED"]);

const optionalNullableString = z.string().trim().optional().nullable();
const optionalDateString = z.string().datetime().optional().nullable();
const optionalMoney = z.coerce.number().nonnegative().optional().nullable();

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  category: assetCategorySchema.optional(),
  condition: assetConditionSchema.optional(),
  status: assetStatusSchema.optional(),
  labId: z.string().optional(),
});

export const createAssetSchema = z.object({
  assetCode: z.string().trim().min(2, "Kode aset minimal 2 karakter"),
  name: z.string().trim().min(2, "Nama aset minimal 2 karakter"),
  category: assetCategorySchema,
  type: optionalNullableString,
  brand: optionalNullableString,
  model: optionalNullableString,
  serialNumber: optionalNullableString,
  condition: assetConditionSchema.optional(),
  status: assetStatusSchema.optional(),
  labId: optionalNullableString,
  location: optionalNullableString,
  pcId: optionalNullableString,
  acquisitionDate: optionalDateString,
  warrantyUntil: optionalDateString,
  purchaseSource: optionalNullableString,
  purchasePrice: optionalMoney,
  fundingSource: optionalNullableString,
  notes: optionalNullableString,
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const maintenanceLogSchema = z.object({
  title: z.string().trim().min(2, "Judul maintenance minimal 2 karakter"),
  description: optionalNullableString,
  status: z.string().trim().min(2, "Status maintenance wajib diisi"),
  cost: optionalMoney,
  performedBy: optionalNullableString,
  performedAt: optionalDateString,
});

export type AssetListQueryInput = z.infer<typeof assetListQuerySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type MaintenanceLogInput = z.infer<typeof maintenanceLogSchema>;
