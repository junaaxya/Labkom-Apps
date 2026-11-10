-- Schedule is the Smart Academic occurrence identity. Preserve the nullable legacy offering link.
ALTER TABLE "logbooks" DROP CONSTRAINT "logbooks_occurrence_identity_check";
ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_occurrence_identity_check" CHECK (
  ("labId" IS NULL AND "scheduleId" IS NULL AND "academicOfferingId" IS NULL AND "occurrenceDate" IS NULL)
  OR
  ("labId" IS NOT NULL AND "scheduleId" IS NOT NULL AND "occurrenceDate" IS NOT NULL AND "occurrenceDate" = "date")
);
