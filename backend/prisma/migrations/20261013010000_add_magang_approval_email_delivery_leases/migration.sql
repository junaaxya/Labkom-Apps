ALTER TYPE "MagangApprovalEmailStatus" ADD VALUE 'SENT';

ALTER TABLE "magang_approval_email_deliveries"
ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "magang_approval_email_deliveries_status_nextAttemptAt_idx"
ON "magang_approval_email_deliveries"("status", "nextAttemptAt");

CREATE INDEX "magang_approval_email_deliveries_status_leaseExpiresAt_idx"
ON "magang_approval_email_deliveries"("status", "leaseExpiresAt");
