-- Additive safety constraint: one attendance record per assigned shift.
-- PostgreSQL permits multiple NULL values, so legacy attendance rows without a shift remain untouched.
CREATE UNIQUE INDEX "attendances_shiftScheduleId_key" ON "attendances"("shiftScheduleId");

-- QR enforcement is opt-in until the scanner has been verified in production.
ALTER TABLE "attendance_settings" ADD COLUMN "isQrRequired" BOOLEAN NOT NULL DEFAULT false;
