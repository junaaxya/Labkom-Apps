CREATE TYPE "SmartAcademicMeetingStatus" AS ENUM ('MASUK', 'KOSONG', 'ONLINE');
CREATE TYPE "SmartAcademicMoveStatus" AS ENUM ('AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "SmartAcademicRiskLevel" AS ENUM ('GREEN', 'YELLOW');

CREATE TABLE "smart_academic_pjs" (
  "id" TEXT NOT NULL, "scheduleId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "assignedById" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "smart_academic_pjs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "smart_academic_occurrence_reports" (
  "id" TEXT NOT NULL, "scheduleId" TEXT NOT NULL, "occurrenceDate" DATE NOT NULL,
  "status" "SmartAcademicMeetingStatus" NOT NULL, "source" TEXT NOT NULL, "notes" TEXT,
  "reportedById" TEXT NOT NULL, "labId" TEXT NOT NULL, "startTime" TEXT NOT NULL, "endTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "smart_academic_occurrence_reports_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "smart_academic_move_requests" (
  "id" TEXT NOT NULL, "sourceReportId" TEXT NOT NULL, "targetScheduleId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL, "reviewedById" TEXT, "occurrenceDate" DATE NOT NULL,
  "labId" TEXT NOT NULL, "startTime" TEXT NOT NULL, "endTime" TEXT NOT NULL,
  "status" "SmartAcademicMoveStatus" NOT NULL, "riskLevel" "SmartAcademicRiskLevel" NOT NULL,
  "riskReasons" JSONB NOT NULL DEFAULT '[]', "reason" TEXT, "rejectionReason" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "smart_academic_move_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "smart_academic_pjs_scheduleId_studentId_key" ON "smart_academic_pjs"("scheduleId", "studentId");
CREATE INDEX "smart_academic_pjs_scheduleId_isActive_idx" ON "smart_academic_pjs"("scheduleId", "isActive");
CREATE INDEX "smart_academic_pjs_studentId_isActive_idx" ON "smart_academic_pjs"("studentId", "isActive");
CREATE UNIQUE INDEX "smart_academic_occurrence_reports_scheduleId_occurrenceDate_key" ON "smart_academic_occurrence_reports"("scheduleId", "occurrenceDate");
CREATE INDEX "smart_academic_occurrence_reports_occurrenceDate_status_idx" ON "smart_academic_occurrence_reports"("occurrenceDate", "status");
CREATE INDEX "smart_academic_occurrence_reports_labId_occurrenceDate_status_idx" ON "smart_academic_occurrence_reports"("labId", "occurrenceDate", "status");
CREATE UNIQUE INDEX "smart_academic_move_requests_sourceReportId_key" ON "smart_academic_move_requests"("sourceReportId");
CREATE INDEX "smart_academic_move_requests_status_occurrenceDate_idx" ON "smart_academic_move_requests"("status", "occurrenceDate");
CREATE INDEX "smart_academic_move_requests_targetScheduleId_occurrenceDate_idx" ON "smart_academic_move_requests"("targetScheduleId", "occurrenceDate");
CREATE INDEX "smart_academic_move_requests_labId_occurrenceDate_status_idx" ON "smart_academic_move_requests"("labId", "occurrenceDate", "status");
ALTER TABLE "smart_academic_pjs" ADD CONSTRAINT "smart_academic_pjs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_pjs" ADD CONSTRAINT "smart_academic_pjs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_pjs" ADD CONSTRAINT "smart_academic_pjs_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_occurrence_reports" ADD CONSTRAINT "smart_academic_occurrence_reports_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_occurrence_reports" ADD CONSTRAINT "smart_academic_occurrence_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_occurrence_reports" ADD CONSTRAINT "smart_academic_occurrence_reports_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_move_requests" ADD CONSTRAINT "smart_academic_move_requests_sourceReportId_fkey" FOREIGN KEY ("sourceReportId") REFERENCES "smart_academic_occurrence_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_move_requests" ADD CONSTRAINT "smart_academic_move_requests_targetScheduleId_fkey" FOREIGN KEY ("targetScheduleId") REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_move_requests" ADD CONSTRAINT "smart_academic_move_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_move_requests" ADD CONSTRAINT "smart_academic_move_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "smart_academic_move_requests" ADD CONSTRAINT "smart_academic_move_requests_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
