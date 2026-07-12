CREATE TABLE IF NOT EXISTS "aslab_picket_patterns" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "horizonStart" DATE NOT NULL,
    "horizonEnd" DATE NOT NULL,
    "activePicketWeekdays" JSONB NOT NULL,
    "shiftId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aslab_picket_patterns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "aslab_picket_pattern_assignments" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "labId" TEXT NOT NULL,
    "requiredAssistantCount" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "aslab_picket_pattern_assignments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "aslab_shift_schedules" ADD COLUMN IF NOT EXISTS "patternId" TEXT;

CREATE INDEX IF NOT EXISTS "aslab_picket_patterns_effectiveFrom_createdAt_idx" ON "aslab_picket_patterns"("effectiveFrom", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "aslab_picket_pattern_assignments_patternId_weekday_labId_userId_key" ON "aslab_picket_pattern_assignments"("patternId", "weekday", "labId", "userId");
CREATE INDEX IF NOT EXISTS "aslab_picket_pattern_assignments_patternId_weekday_labId_idx" ON "aslab_picket_pattern_assignments"("patternId", "weekday", "labId");
CREATE INDEX IF NOT EXISTS "aslab_shift_schedules_patternId_scheduleDate_status_idx" ON "aslab_shift_schedules"("patternId", "scheduleDate", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aslab_picket_patterns_shiftId_fkey') THEN ALTER TABLE "aslab_picket_patterns" ADD CONSTRAINT "aslab_picket_patterns_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aslab_picket_patterns_createdBy_fkey') THEN ALTER TABLE "aslab_picket_patterns" ADD CONSTRAINT "aslab_picket_patterns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aslab_picket_pattern_assignments_patternId_fkey') THEN ALTER TABLE "aslab_picket_pattern_assignments" ADD CONSTRAINT "aslab_picket_pattern_assignments_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "aslab_picket_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aslab_picket_pattern_assignments_labId_fkey') THEN ALTER TABLE "aslab_picket_pattern_assignments" ADD CONSTRAINT "aslab_picket_pattern_assignments_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aslab_picket_pattern_assignments_userId_fkey') THEN ALTER TABLE "aslab_picket_pattern_assignments" ADD CONSTRAINT "aslab_picket_pattern_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aslab_shift_schedules_patternId_fkey') THEN ALTER TABLE "aslab_shift_schedules" ADD CONSTRAINT "aslab_shift_schedules_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "aslab_picket_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
END $$;
