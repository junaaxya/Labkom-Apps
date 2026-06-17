import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import type { AssetListQueryInput, CreateAssetInput, MaintenanceLogInput, UpdateAssetInput } from "../validators/asset.validator";

const assetInclude = {
  lab: { select: { id: true, name: true, location: true } },
  pc: { select: { id: true, pcCode: true, name: true, agentStatus: true, healthStatus: true, qrCode: true } },
} satisfies Prisma.AssetInclude;

const procurementFields = new Set(["purchasePrice", "purchaseSource", "fundingSource", "acquisitionDate", "warrantyUntil"]);

type UserContext = { userId: string; role: string };

function cleanString(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value);
}

function toDecimal(value: number | null | undefined) {
  if (value === undefined || value === null) return null;
  return new Prisma.Decimal(value);
}

function assertCoordinator(user: UserContext) {
  if (user.role !== "KOORDINATOR_LAB") {
    throw new Error("Hanya Koordinator Lab yang dapat mengubah data pengadaan aset");
  }
}

function assertAllowedAssetWrite(user: UserContext, data: UpdateAssetInput | CreateAssetInput) {
  if (user.role === "KOORDINATOR_LAB") return;
  for (const field of Object.keys(data)) {
    if (procurementFields.has(field)) assertCoordinator(user);
  }
}

function normalizeAssetInput(data: CreateAssetInput | UpdateAssetInput) {
  const normalized: Prisma.AssetUncheckedCreateInput | Prisma.AssetUncheckedUpdateInput = {};

  if ("assetCode" in data && data.assetCode !== undefined) normalized.assetCode = data.assetCode.trim();
  if ("name" in data && data.name !== undefined) normalized.name = data.name.trim();
  if ("category" in data && data.category !== undefined) normalized.category = data.category;
  if ("condition" in data && data.condition !== undefined) normalized.condition = data.condition;
  if ("status" in data && data.status !== undefined) normalized.status = data.status;
  if ("type" in data) normalized.type = cleanString(data.type);
  if ("brand" in data) normalized.brand = cleanString(data.brand);
  if ("model" in data) normalized.model = cleanString(data.model);
  if ("serialNumber" in data) normalized.serialNumber = cleanString(data.serialNumber);
  if ("labId" in data) normalized.labId = cleanString(data.labId);
  if ("location" in data) normalized.location = cleanString(data.location);
  if ("pcId" in data) normalized.pcId = cleanString(data.pcId);
  if ("acquisitionDate" in data) normalized.acquisitionDate = toDate(data.acquisitionDate);
  if ("warrantyUntil" in data) normalized.warrantyUntil = toDate(data.warrantyUntil);
  if ("purchaseSource" in data) normalized.purchaseSource = cleanString(data.purchaseSource);
  if ("purchasePrice" in data) normalized.purchasePrice = toDecimal(data.purchasePrice);
  if ("fundingSource" in data) normalized.fundingSource = cleanString(data.fundingSource);
  if ("notes" in data) normalized.notes = cleanString(data.notes);
  if ("metadata" in data && data.metadata !== undefined) {
    normalized.metadata = data.metadata === null ? Prisma.JsonNull : (data.metadata as Prisma.InputJsonObject);
  }

  return normalized;
}

async function validateReferences(data: Prisma.AssetUncheckedCreateInput | Prisma.AssetUncheckedUpdateInput) {
  if (typeof data.labId === "string") {
    const lab = await prisma.lab.findUnique({ where: { id: data.labId }, select: { id: true } });
    if (!lab) throw new Error("Lab tidak ditemukan");
  }

  if (typeof data.pcId === "string") {
    const pc = await prisma.pC.findUnique({ where: { id: data.pcId }, select: { id: true } });
    if (!pc) throw new Error("PC tidak ditemukan");
    if (data.category && data.category !== "PC") throw new Error("Aset yang terhubung ke PC wajib berkategori PC");
  }
}

async function createAuditLog(assetId: string, userId: string | undefined, action: string, before: unknown, after: unknown) {
  await prisma.assetAuditLog.create({
    data: {
      assetId,
      userId,
      action,
      before: before === undefined ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
      after: after === undefined ? Prisma.JsonNull : (after as Prisma.InputJsonValue),
    },
  });
}

export class AssetService {
  static async list(params: AssetListQueryInput) {
    const { page = 1, limit = 20, search, category, condition, status, labId } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.AssetWhereInput = { deletedAt: null };

    if (category) where.category = category;
    if (condition) where.condition = condition;
    if (status) where.status = status;
    if (labId) where.labId = labId;
    if (search) {
      where.OR = [
        { assetCode: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
        { lab: { name: { contains: search, mode: "insensitive" } } },
        { pc: { pcCode: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({ where, include: assetInclude, skip, take: limit, orderBy: { updatedAt: "desc" } }),
      prisma.asset.count({ where }),
    ]);

    return { assets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  static async getSummary() {
    const where = { deletedAt: null };
    const [total, byCategory, byCondition, byStatus, warrantyExpiringSoon, pcLinked] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.groupBy({ by: ["category"], where, _count: { _all: true } }),
      prisma.asset.groupBy({ by: ["condition"], where, _count: { _all: true } }),
      prisma.asset.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.asset.count({
        where: {
          deletedAt: null,
          warrantyUntil: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.asset.count({ where: { deletedAt: null, pcId: { not: null } } }),
    ]);

    return {
      total,
      byCategory: Object.fromEntries(byCategory.map((item) => [item.category, item._count._all])),
      byCondition: Object.fromEntries(byCondition.map((item) => [item.condition, item._count._all])),
      byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count._all])),
      warrantyExpiringSoon,
      pcLinked,
    };
  }

  static async getById(id: string) {
    const asset = await prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: { ...assetInclude, maintenanceLogs: { orderBy: { createdAt: "desc" } }, auditLogs: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { id: true, name: true, role: true } } } } },
    });
    if (!asset) throw new Error("Aset tidak ditemukan");
    return asset;
  }

  static async create(data: CreateAssetInput, user: UserContext) {
    assertAllowedAssetWrite(user, data);
    const normalized = normalizeAssetInput(data) as Prisma.AssetUncheckedCreateInput;
    await validateReferences(normalized);

    const asset = await prisma.asset.create({ data: normalized, include: assetInclude });
    await createAuditLog(asset.id, user.userId, "CREATE", undefined, asset);
    return asset;
  }

  static async update(id: string, data: UpdateAssetInput, user: UserContext) {
    assertAllowedAssetWrite(user, data);
    const existing = await prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error("Aset tidak ditemukan");

    const normalized = normalizeAssetInput(data) as Prisma.AssetUncheckedUpdateInput;
    await validateReferences(normalized);

    const asset = await prisma.asset.update({ where: { id }, data: normalized, include: assetInclude });
    await createAuditLog(asset.id, user.userId, "UPDATE", existing, asset);
    return asset;
  }

  static async softDelete(id: string, user: UserContext) {
    assertCoordinator(user);
    const existing = await prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error("Aset tidak ditemukan");

    const asset = await prisma.asset.update({ where: { id }, data: { deletedAt: new Date(), status: "DISPOSED" }, include: assetInclude });
    await createAuditLog(asset.id, user.userId, "DELETE", existing, asset);
    return asset;
  }

  static async addMaintenanceLog(assetId: string, data: MaintenanceLogInput, user: UserContext) {
    const asset = await prisma.asset.findFirst({ where: { id: assetId, deletedAt: null } });
    if (!asset) throw new Error("Aset tidak ditemukan");

    const log = await prisma.assetMaintenanceLog.create({
      data: {
        assetId,
        title: data.title.trim(),
        description: cleanString(data.description),
        status: data.status.trim(),
        cost: user.role === "KOORDINATOR_LAB" ? toDecimal(data.cost) : null,
        performedBy: cleanString(data.performedBy),
        performedAt: toDate(data.performedAt),
      },
    });
    await createAuditLog(assetId, user.userId, "MAINTENANCE", undefined, log);
    return log;
  }

  static async getAuditLogs(assetId: string) {
    return prisma.assetAuditLog.findMany({
      where: { assetId },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async backfillFromPCs(user: UserContext) {
    assertCoordinator(user);
    const pcs = await prisma.pC.findMany({ include: { asset: true } });
    let created = 0;
    let skipped = 0;

    for (const pc of pcs) {
      if (pc.asset) {
        skipped++;
        continue;
      }

      let specsSnapshot: unknown = null;
      try {
        specsSnapshot = pc.specs ? JSON.parse(pc.specs) : null;
      } catch {
        specsSnapshot = { raw: pc.specs };
      }

      const asset = await prisma.asset.create({
        data: {
          assetCode: pc.assetCode || pc.pcCode,
          name: pc.name || pc.pcCode,
          category: "PC",
          labId: pc.labId,
          pcId: pc.id,
          status: pc.status === "BROKEN" ? "IN_MAINTENANCE" : "ACTIVE",
          condition: pc.status === "BROKEN" ? "BROKEN" : pc.status === "MAINTENANCE" ? "NEEDS_REPAIR" : "GOOD",
          metadata: specsSnapshot === null ? Prisma.JsonNull : { pcSpecsSnapshot: specsSnapshot },
        },
      });
      await createAuditLog(asset.id, user.userId, "BACKFILL_PC", undefined, asset);
      created++;
    }

    return { created, skipped, totalPCs: pcs.length };
  }
}
