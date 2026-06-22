CREATE TYPE "AsLabPicketDestination" AS ENUM ('RUANGAN_ASLAB', 'LAB_MULTIMEDIA', 'LAB_DASAR');

ALTER TABLE "aslab_shift_schedules"
ADD COLUMN "destination" "AsLabPicketDestination";

UPDATE "aslab_shift_schedules" AS schedule
SET "destination" = CASE
  WHEN LOWER(CONCAT_WS(' ', lab."name", lab."location")) LIKE '%aslab%' THEN 'RUANGAN_ASLAB'::"AsLabPicketDestination"
  WHEN LOWER(CONCAT_WS(' ', lab."name", lab."location")) LIKE '%multimedia%' THEN 'LAB_MULTIMEDIA'::"AsLabPicketDestination"
  WHEN LOWER(CONCAT_WS(' ', lab."name", lab."location")) LIKE '%dasar%' THEN 'LAB_DASAR'::"AsLabPicketDestination"
  ELSE NULL
END
FROM "labs" AS lab
WHERE schedule."labId" = lab."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "aslab_shift_schedules" WHERE "destination" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate aslab_shift_schedules.labId to destination: unknown lab mapping remains';
  END IF;
END $$;

ALTER TABLE "aslab_shift_schedules"
ALTER COLUMN "destination" SET NOT NULL;

ALTER TABLE "aslab_shift_schedules"
DROP CONSTRAINT "aslab_shift_schedules_labId_fkey";

DROP INDEX IF EXISTS "aslab_shift_schedules_labId_idx";

ALTER TABLE "aslab_shift_schedules"
DROP COLUMN "labId";

CREATE INDEX "aslab_shift_schedules_destination_idx" ON "aslab_shift_schedules"("destination");
