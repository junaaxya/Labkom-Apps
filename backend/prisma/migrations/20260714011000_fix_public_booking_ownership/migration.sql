ALTER TABLE "schedules"
ADD COLUMN IF NOT EXISTS "specificDate" DATE;

ALTER TABLE "lab_bookings"
ALTER COLUMN "requestedBy" DROP NOT NULL;

ALTER TABLE "lab_bookings"
ADD COLUMN IF NOT EXISTS "externalRequesterName" TEXT,
ADD COLUMN IF NOT EXISTS "externalRequesterEmail" TEXT,
ADD COLUMN IF NOT EXISTS "externalRequesterPhone" TEXT,
ADD COLUMN IF NOT EXISTS "externalInstitution" TEXT;
