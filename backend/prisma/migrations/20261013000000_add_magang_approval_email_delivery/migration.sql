CREATE TYPE "MagangApprovalEmailStatus" AS ENUM ('QUEUED', 'PROCESSING', 'QA_CAPTURED', 'FAILED');

CREATE TABLE "magang_approval_email_deliveries" (
    "id" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" "MagangApprovalEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magang_approval_email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "magang_approval_email_deliveries_accessRequestId_key" ON "magang_approval_email_deliveries"("accessRequestId");

ALTER TABLE "magang_approval_email_deliveries"
ADD CONSTRAINT "magang_approval_email_deliveries_accessRequestId_fkey"
FOREIGN KEY ("accessRequestId") REFERENCES "access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
