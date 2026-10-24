CREATE TYPE "AcademicOccurrenceSwapStatus" AS ENUM ('PENDING_CONFIRMATION', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "academic_occurrence_swaps" (
  "id" TEXT NOT NULL,
  "sourceOfferingId" TEXT NOT NULL,
  "targetOfferingId" TEXT NOT NULL,
  "sourceScheduleId" TEXT NOT NULL,
  "targetScheduleId" TEXT NOT NULL,
  "occurrenceDate" DATE NOT NULL,
  "sourceLabId" TEXT NOT NULL,
  "targetLabId" TEXT NOT NULL,
  "sourceStartTime" TEXT NOT NULL,
  "sourceEndTime" TEXT NOT NULL,
  "targetStartTime" TEXT NOT NULL,
  "targetEndTime" TEXT NOT NULL,
  "status" "AcademicOccurrenceSwapStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "reason" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_occurrence_swaps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_occurrence_swap_confirmations" (
  "id" TEXT NOT NULL,
  "swapId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "confirmedById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "academic_occurrence_swap_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_occurrence_swap_reservations" (
  "id" TEXT NOT NULL,
  "swapId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "occurrenceDate" DATE NOT NULL,
  "status" "AcademicOccurrenceSwapStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_occurrence_swap_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_occurrence_swap_confirmations_swapId_offeringId_key" ON "academic_occurrence_swap_confirmations"("swapId", "offeringId");
CREATE UNIQUE INDEX "academic_occurrence_swap_reservations_swapId_scheduleId_key" ON "academic_occurrence_swap_reservations"("swapId", "scheduleId");
CREATE UNIQUE INDEX "academic_occurrence_swap_reservations_active_occurrence_key" ON "academic_occurrence_swap_reservations"("scheduleId", "occurrenceDate") WHERE "status" IN ('PENDING_CONFIRMATION', 'PENDING_APPROVAL', 'APPROVED');
CREATE INDEX "academic_occurrence_swaps_sourceScheduleId_occurrenceDate_status_idx" ON "academic_occurrence_swaps"("sourceScheduleId", "occurrenceDate", "status");
CREATE INDEX "academic_occurrence_swaps_targetScheduleId_occurrenceDate_status_idx" ON "academic_occurrence_swaps"("targetScheduleId", "occurrenceDate", "status");
CREATE INDEX "academic_occurrence_swaps_sourceOfferingId_occurrenceDate_idx" ON "academic_occurrence_swaps"("sourceOfferingId", "occurrenceDate");
CREATE INDEX "academic_occurrence_swaps_targetOfferingId_occurrenceDate_idx" ON "academic_occurrence_swaps"("targetOfferingId", "occurrenceDate");
CREATE INDEX "academic_occurrence_swap_confirmations_confirmedById_idx" ON "academic_occurrence_swap_confirmations"("confirmedById");
CREATE INDEX "academic_occurrence_swap_reservations_scheduleId_occurrenceDate_status_idx" ON "academic_occurrence_swap_reservations"("scheduleId", "occurrenceDate", "status");

ALTER TABLE "academic_occurrence_swaps" ADD CONSTRAINT "academic_occurrence_swaps_sourceOfferingId_fkey" FOREIGN KEY ("sourceOfferingId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swaps" ADD CONSTRAINT "academic_occurrence_swaps_targetOfferingId_fkey" FOREIGN KEY ("targetOfferingId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swaps" ADD CONSTRAINT "academic_occurrence_swaps_sourceScheduleId_fkey" FOREIGN KEY ("sourceScheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swaps" ADD CONSTRAINT "academic_occurrence_swaps_targetScheduleId_fkey" FOREIGN KEY ("targetScheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swaps" ADD CONSTRAINT "academic_occurrence_swaps_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swaps" ADD CONSTRAINT "academic_occurrence_swaps_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swap_confirmations" ADD CONSTRAINT "academic_occurrence_swap_confirmations_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "academic_occurrence_swaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swap_confirmations" ADD CONSTRAINT "academic_occurrence_swap_confirmations_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swap_confirmations" ADD CONSTRAINT "academic_occurrence_swap_confirmations_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swap_reservations" ADD CONSTRAINT "academic_occurrence_swap_reservations_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "academic_occurrence_swaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic_occurrence_swap_reservations" ADD CONSTRAINT "academic_occurrence_swap_reservations_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
