ALTER TYPE "MagangApprovalEmailStatus" ADD VALUE IF NOT EXISTS 'SENT';

ALTER TABLE "magang_approval_email_deliveries"
ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "magang_approval_email_deliveries_status_nextAttemptAt_idx"
ON "magang_approval_email_deliveries"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "magang_approval_email_deliveries_status_leaseExpiresAt_idx"
ON "magang_approval_email_deliveries"("status", "leaseExpiresAt");
