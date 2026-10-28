CREATE TYPE "AcademicOccurrenceReleaseStatus" AS ENUM ('RELEASED', 'ALLOCATED', 'REVOKED');
CREATE TYPE "AcademicSlotRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "academic_occurrence_releases" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "labId" TEXT NOT NULL,
  "occurrenceDate" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "status" "AcademicOccurrenceReleaseStatus" NOT NULL DEFAULT 'RELEASED',
  "releasedById" TEXT NOT NULL,
  "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_occurrence_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_slot_requests" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "targetOfferingId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "AcademicSlotRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "bookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_slot_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_occurrence_releases_reportId_key" ON "academic_occurrence_releases"("reportId");
CREATE UNIQUE INDEX "academic_occurrence_releases_scheduleId_occurrenceDate_key" ON "academic_occurrence_releases"("scheduleId", "occurrenceDate");
CREATE INDEX "academic_occurrence_releases_labId_occurrenceDate_status_idx" ON "academic_occurrence_releases"("labId", "occurrenceDate", "status");
CREATE INDEX "academic_occurrence_releases_offeringId_occurrenceDate_idx" ON "academic_occurrence_releases"("offeringId", "occurrenceDate");
CREATE UNIQUE INDEX "academic_slot_requests_bookingId_key" ON "academic_slot_requests"("bookingId");
CREATE INDEX "academic_slot_requests_releaseId_status_idx" ON "academic_slot_requests"("releaseId", "status");
CREATE INDEX "academic_slot_requests_targetOfferingId_status_idx" ON "academic_slot_requests"("targetOfferingId", "status");
CREATE INDEX "academic_slot_requests_requestedById_status_idx" ON "academic_slot_requests"("requestedById", "status");

ALTER TABLE "academic_occurrence_releases" ADD CONSTRAINT "academic_occurrence_releases_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_releases" ADD CONSTRAINT "academic_occurrence_releases_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_releases" ADD CONSTRAINT "academic_occurrence_releases_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "academic_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_releases" ADD CONSTRAINT "academic_occurrence_releases_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_releases" ADD CONSTRAINT "academic_occurrence_releases_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_slot_requests" ADD CONSTRAINT "academic_slot_requests_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "academic_occurrence_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_slot_requests" ADD CONSTRAINT "academic_slot_requests_targetOfferingId_fkey" FOREIGN KEY ("targetOfferingId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_slot_requests" ADD CONSTRAINT "academic_slot_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_slot_requests" ADD CONSTRAINT "academic_slot_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_slot_requests" ADD CONSTRAINT "academic_slot_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "lab_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
