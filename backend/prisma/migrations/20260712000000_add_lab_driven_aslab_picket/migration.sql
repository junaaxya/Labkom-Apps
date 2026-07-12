ALTER TABLE "labs"
ADD COLUMN IF NOT EXISTS "isPicketEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "defaultPicketAssistantCount" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "aslab_shift_schedules"
ADD COLUMN IF NOT EXISTS "labId" TEXT,
ALTER COLUMN "destination" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aslab_shift_schedules_labId_fkey'
  ) THEN
    ALTER TABLE "aslab_shift_schedules"
    ADD CONSTRAINT "aslab_shift_schedules_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "aslab_shift_schedules_labId_scheduleDate_status_idx"
ON "aslab_shift_schedules"("labId", "scheduleDate", "status");
