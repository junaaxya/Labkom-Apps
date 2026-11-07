CREATE TYPE "AgentRolloutStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ROLLED_BACK');
CREATE TYPE "AgentUpdateStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'VERIFYING', 'INSTALLING', 'AWAITING_HEARTBEAT', 'SUCCEEDED', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK', 'CANCELLED');

CREATE TABLE "agent_releases" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "architecture" TEXT NOT NULL,
  "artifactFilename" TEXT NOT NULL,
  "artifactUrl" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "signature" TEXT NOT NULL,
  "minimumUpdaterVersion" TEXT NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_releases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_releases_version_key" ON "agent_releases"("version");
CREATE UNIQUE INDEX "agent_releases_artifactFilename_key" ON "agent_releases"("artifactFilename");
CREATE UNIQUE INDEX "agent_releases_artifactUrl_key" ON "agent_releases"("artifactUrl");
CREATE INDEX "agent_releases_isPublished_createdAt_idx" ON "agent_releases"("isPublished", "createdAt");

CREATE TABLE "agent_rollouts" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "status" "AgentRolloutStatus" NOT NULL DEFAULT 'DRAFT',
  "scope" TEXT NOT NULL,
  "labId" TEXT,
  "pilotPcIds" JSONB,
  "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
  "checkAfterSeconds" INTEGER NOT NULL DEFAULT 600,
  "rollbackReleaseId" TEXT,
  "createdById" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_rollouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_rollouts_status_createdAt_idx" ON "agent_rollouts"("status", "createdAt");
CREATE INDEX "agent_rollouts_releaseId_status_idx" ON "agent_rollouts"("releaseId", "status");

CREATE TABLE "agent_update_assignments" (
  "id" TEXT NOT NULL,
  "rolloutId" TEXT NOT NULL,
  "pcId" TEXT NOT NULL,
  "status" "AgentUpdateStatus" NOT NULL DEFAULT 'PENDING',
  "currentVersion" TEXT,
  "targetVersion" TEXT NOT NULL,
  "rollbackVersion" TEXT,
  "lastError" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_update_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_update_assignments_rolloutId_pcId_key" ON "agent_update_assignments"("rolloutId", "pcId");
CREATE INDEX "agent_update_assignments_pcId_status_idx" ON "agent_update_assignments"("pcId", "status");
CREATE UNIQUE INDEX "agent_update_assignments_one_active_per_pc" ON "agent_update_assignments"("pcId") WHERE "status" NOT IN ('SUCCEEDED', 'FAILED', 'ROLLED_BACK', 'CANCELLED');

CREATE TABLE "agent_update_attempts" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "pcId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "status" "AgentUpdateStatus" NOT NULL DEFAULT 'PENDING',
  "currentVersion" TEXT,
  "targetVersion" TEXT NOT NULL,
  "rollbackVersion" TEXT,
  "message" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_update_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_update_attempts_assignmentId_targetVersion_key" ON "agent_update_attempts"("assignmentId", "targetVersion");
CREATE INDEX "agent_update_attempts_pcId_updatedAt_idx" ON "agent_update_attempts"("pcId", "updatedAt");

ALTER TABLE "agent_releases" ADD CONSTRAINT "agent_releases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_rollouts" ADD CONSTRAINT "agent_rollouts_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "agent_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_rollouts" ADD CONSTRAINT "agent_rollouts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_update_assignments" ADD CONSTRAINT "agent_update_assignments_rolloutId_fkey" FOREIGN KEY ("rolloutId") REFERENCES "agent_rollouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_update_assignments" ADD CONSTRAINT "agent_update_assignments_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_update_attempts" ADD CONSTRAINT "agent_update_attempts_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "agent_update_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_update_attempts" ADD CONSTRAINT "agent_update_attempts_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_update_attempts" ADD CONSTRAINT "agent_update_attempts_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "agent_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
