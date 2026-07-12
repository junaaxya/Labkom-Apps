ALTER TABLE "attendance_settings"
ADD COLUMN IF NOT EXISTS "activePicketWeekdays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb;
