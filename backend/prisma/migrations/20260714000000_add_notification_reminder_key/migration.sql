ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "reminderKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_reminderKey_key"
ON "notifications"("reminderKey");
