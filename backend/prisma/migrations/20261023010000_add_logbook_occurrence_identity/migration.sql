ALTER TABLE "logbooks"
  ADD COLUMN "labId" TEXT,
  ADD COLUMN "scheduleId" TEXT,
  ADD COLUMN "academicOfferingId" TEXT,
  ADD COLUMN "occurrenceDate" DATE;

ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_occurrence_identity_check" CHECK (
  ("labId" IS NULL AND "scheduleId" IS NULL AND "academicOfferingId" IS NULL AND "occurrenceDate" IS NULL)
  OR
  ("labId" IS NOT NULL AND "scheduleId" IS NOT NULL AND "academicOfferingId" IS NOT NULL AND "occurrenceDate" IS NOT NULL AND "occurrenceDate" = "date")
);

CREATE INDEX "logbooks_scheduleId_occurrenceDate_idx" ON "logbooks"("scheduleId", "occurrenceDate");
CREATE INDEX "logbooks_academicOfferingId_occurrenceDate_idx" ON "logbooks"("academicOfferingId", "occurrenceDate");

ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_labId_fkey"
  FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_academicOfferingId_fkey"
  FOREIGN KEY ("academicOfferingId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
