-- Make Shift a reusable picket time template.
-- Aslab assignment lives in Jadwal Piket (AsLabShiftSchedule), not on Shift itself.
ALTER TABLE "shifts" ALTER COLUMN "labId" DROP NOT NULL;
ALTER TABLE "shifts" ALTER COLUMN "aslebId" DROP NOT NULL;
ALTER TABLE "shifts" ALTER COLUMN "day" DROP NOT NULL;
