ALTER TABLE "access_requests"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "magang_email_verifications" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magang_email_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "magang_email_verifications_tokenHash_key" ON "magang_email_verifications"("tokenHash");
CREATE UNIQUE INDEX "magang_email_verifications_userId_key" ON "magang_email_verifications"("userId");
CREATE UNIQUE INDEX "magang_email_verifications_accessRequestId_key" ON "magang_email_verifications"("accessRequestId");
CREATE INDEX "magang_email_verifications_expiresAt_idx" ON "magang_email_verifications"("expiresAt");

ALTER TABLE "magang_email_verifications"
ADD CONSTRAINT "magang_email_verifications_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "magang_email_verifications"
ADD CONSTRAINT "magang_email_verifications_accessRequestId_fkey"
FOREIGN KEY ("accessRequestId") REFERENCES "access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
