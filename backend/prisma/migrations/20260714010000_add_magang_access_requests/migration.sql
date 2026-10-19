ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MAGANG';

CREATE TYPE "AccessRequestType" AS ENUM ('PEMINJAMAN_LAB', 'MAGANG', 'AKSES_SEMENTARA');
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION');

CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "type" "AccessRequestType" NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "institution" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT,
    "date" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "participants" INTEGER,
    "requestedRole" "Role",
    "reviewerNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "labId" TEXT,
    "bookingId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_requests_requestCode_key" ON "access_requests"("requestCode");
CREATE UNIQUE INDEX "access_requests_bookingId_key" ON "access_requests"("bookingId");
CREATE INDEX "access_requests_status_createdAt_idx" ON "access_requests"("status", "createdAt");
CREATE INDEX "access_requests_type_status_idx" ON "access_requests"("type", "status");
CREATE INDEX "access_requests_labId_date_idx" ON "access_requests"("labId", "date");

ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "lab_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
