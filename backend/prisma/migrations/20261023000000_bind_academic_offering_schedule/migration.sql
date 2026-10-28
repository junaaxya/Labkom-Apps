ALTER TABLE "academic_offerings" ADD COLUMN "scheduleId" TEXT;

CREATE UNIQUE INDEX "academic_offerings_scheduleId_key" ON "academic_offerings"("scheduleId");

ALTER TABLE "academic_offerings" ADD CONSTRAINT "academic_offerings_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
