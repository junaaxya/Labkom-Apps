CREATE TYPE "AssetCategory" AS ENUM ('PC', 'MONITOR', 'KEYBOARD', 'MOUSE', 'PROJECTOR', 'NETWORKING', 'FURNITURE', 'AC', 'ELECTRICAL', 'TOOL', 'CONSUMABLE', 'OTHER');

CREATE TYPE "AssetCondition" AS ENUM ('GOOD', 'NEEDS_REPAIR', 'BROKEN', 'LOST', 'RETIRED');

CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'IN_MAINTENANCE', 'BORROWED', 'STORED', 'DISPOSED');

CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "type" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "labId" TEXT,
    "pcId" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "purchaseSource" TEXT,
    "purchasePrice" DECIMAL(14,2),
    "fundingSource" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_maintenance_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "cost" DECIMAL(14,2),
    "performedBy" TEXT,
    "performedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_maintenance_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_audit_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assets_assetCode_key" ON "assets"("assetCode");

CREATE UNIQUE INDEX "assets_serialNumber_key" ON "assets"("serialNumber");

CREATE UNIQUE INDEX "assets_pcId_key" ON "assets"("pcId");

CREATE INDEX "assets_labId_idx" ON "assets"("labId");

CREATE INDEX "assets_category_idx" ON "assets"("category");

CREATE INDEX "assets_condition_idx" ON "assets"("condition");

CREATE INDEX "assets_status_idx" ON "assets"("status");

CREATE INDEX "assets_pcId_idx" ON "assets"("pcId");

CREATE INDEX "asset_maintenance_logs_assetId_createdAt_idx" ON "asset_maintenance_logs"("assetId", "createdAt");

CREATE INDEX "asset_audit_logs_assetId_createdAt_idx" ON "asset_audit_logs"("assetId", "createdAt");

CREATE INDEX "asset_audit_logs_userId_createdAt_idx" ON "asset_audit_logs"("userId", "createdAt");

ALTER TABLE "assets" ADD CONSTRAINT "assets_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets" ADD CONSTRAINT "assets_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_maintenance_logs" ADD CONSTRAINT "asset_maintenance_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_audit_logs" ADD CONSTRAINT "asset_audit_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_audit_logs" ADD CONSTRAINT "asset_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
