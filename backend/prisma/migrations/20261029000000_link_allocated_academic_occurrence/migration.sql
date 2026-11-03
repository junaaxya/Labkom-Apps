ALTER TABLE "academic_slot_requests" ADD COLUMN "allocatedScheduleId" TEXT;

CREATE UNIQUE INDEX "academic_slot_requests_allocatedScheduleId_key"
  ON "academic_slot_requests"("allocatedScheduleId");

ALTER TABLE "academic_slot_requests"
  ADD CONSTRAINT "academic_slot_requests_allocatedScheduleId_fkey"
  FOREIGN KEY ("allocatedScheduleId") REFERENCES "schedules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
