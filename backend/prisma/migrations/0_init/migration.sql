-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('KOORDINATOR_LAB', 'ASISTEN_LAB', 'MAHASISWA');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "PCStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'BROKEN', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('NORMAL', 'BROKEN', 'MAINTENANCE', 'NEEDS_CHECK');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('PRAKTIKUM', 'PEMINJAMAN', 'KEGIATAN');

-- CreateEnum
CREATE TYPE "ScheduleChangeType" AS ENUM ('RESCHEDULE', 'CANCEL_SESSION', 'EXTRA_SLOT');

-- CreateEnum
CREATE TYPE "ScheduleChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU');

-- CreateEnum
CREATE TYPE "LogbookStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'IN_USE', 'CONDITION_SUBMITTED', 'WAITING_VERIFICATION', 'COMPLETED', 'PROBLEM', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogbookSessionType" AS ENUM ('PRAKTIKUM', 'PEMINJAMAN');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'MISSING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "KeyAction" AS ENUM ('TAKEN', 'RETURNED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('MOUSE', 'KEYBOARD', 'MONITOR', 'CPU', 'JARINGAN', 'SOFTWARE', 'KURSI_MEJA', 'AC_LISTRIK', 'PROYEKTOR', 'LAINNYA');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('OPEN', 'TAKEN', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('CHECKED_IN', 'LATE', 'CHECKED_OUT', 'WAITING_VERIFICATION', 'APPROVED', 'REJECTED', 'FORGOT_CHECKOUT', 'ABSENT', 'SICK', 'PERMISSION');

-- CreateEnum
CREATE TYPE "DailyTaskStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'NEED_REVISION');

-- CreateEnum
CREATE TYPE "CorrectionRequestType" AS ENUM ('CHECKIN_TIME', 'CHECKOUT_TIME', 'FORGOT_CHECKOUT', 'LOCATION_ERROR', 'STATUS_CORRECTION');

-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ShiftScheduleStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PCCommandType" AS ENUM ('SHUTDOWN', 'RESTART', 'WAKE_ON_LAN', 'SLEEP', 'LOCK', 'MESSAGE');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'SENT', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('SICK', 'PERMISSION');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('PIKET_BERSIH', 'MAINTENANCE_PC', 'INVENTARIS', 'INSTALASI', 'PENDAMPINGAN', 'ADMINISTRASI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('MONTHLY_BEST', 'SEMESTER_COMPLETION', 'MISSION_MASTER', 'ATTENDANCE_PERFECT', 'SKILL_MASTER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_REMINDER', 'KEY_NOT_RETURNED', 'ATTENDANCE_REMINDER', 'TICKET_ASSIGNED', 'TICKET_RESOLVED', 'MISSION_AVAILABLE', 'MISSION_VERIFIED', 'LOGBOOK_VERIFIED', 'CERTIFICATE_ISSUED', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nim" TEXT,
    "nip" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MAHASISWA',
    "semester" TEXT,
    "className" TEXT,
    "isKetuaKelas" BOOLEAN NOT NULL DEFAULT false,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "waNotify" BOOLEAN NOT NULL DEFAULT true,
    "googleCalendarToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "status" "LabStatus" NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pcs" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "pcCode" TEXT NOT NULL,
    "assetCode" TEXT,
    "name" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "status" "PCStatus" NOT NULL DEFAULT 'AVAILABLE',
    "qrCode" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "specs" TEXT,
    "lastSeen" TIMESTAMP(3),
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "uptimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "powerWatt" INTEGER NOT NULL DEFAULT 150,
    "agentTokenHash" TEXT,
    "agentStatus" "AgentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "healthStatus" "HealthStatus" NOT NULL DEFAULT 'NORMAL',
    "hostname" TEXT,
    "os" TEXT,
    "architecture" TEXT,
    "cpuModel" TEXT,
    "cpuUsage" DOUBLE PRECISION,
    "ramUsage" DOUBLE PRECISION,
    "ramTotalGb" DOUBLE PRECISION,
    "storageUsage" DOUBLE PRECISION,
    "storageTotalGb" DOUBLE PRECISION,
    "uptimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "agentVersion" TEXT,
    "isAgentInstalled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pc_status_logs" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "fromStatus" "PCStatus",
    "toStatus" "PCStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pc_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pc_commands" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "command" "PCCommandType" NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "result" TEXT,
    "issuedBy" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pc_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pc_agent_logs" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pc_agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pc_warnings" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "warningType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pc_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "semester" TEXT,
    "className" TEXT,
    "lecturerName" TEXT,
    "assistantId" TEXT,
    "day" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "type" "ScheduleType" NOT NULL DEFAULT 'PRAKTIKUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_change_requests" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "requestType" "ScheduleChangeType" NOT NULL,
    "status" "ScheduleChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "newDay" "DayOfWeek",
    "newStartTime" TEXT,
    "newEndTime" TEXT,
    "newLabId" TEXT,
    "cancelDate" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "labId" TEXT NOT NULL,
    "aslebId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "checkoutGraceMinutes" INTEGER NOT NULL DEFAULT 30,
    "isTaskRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_bookings" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logbooks" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "officialCheckinById" TEXT,
    "officialCheckinAt" TIMESTAMP(3),
    "officialCheckoutById" TEXT,
    "officialCheckoutAt" TIMESTAMP(3),
    "status" "LogbookStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logbook_conditions" (
    "id" TEXT NOT NULL,
    "logbookId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "submittedById" TEXT,
    "kerusakanBaru" TEXT,
    "catatanKondisi" TEXT,
    "fotoBukti" TEXT[],
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logbook_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keys" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "keyCode" TEXT NOT NULL,
    "qrCode" TEXT,
    "status" "KeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentHolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_logs" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "KeyAction" NOT NULL,
    "takenAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "pcId" TEXT,
    "labId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "category" "TicketCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photo" TEXT[],
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "status" "MissionStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_claims" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "aslebId" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'TAKEN',
    "proof" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mission_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftScheduleId" TEXT,
    "checkinAt" TIMESTAMP(3),
    "checkoutAt" TIMESTAMP(3),
    "checkinLatitude" DOUBLE PRECISION,
    "checkinLongitude" DOUBLE PRECISION,
    "checkoutLatitude" DOUBLE PRECISION,
    "checkoutLongitude" DOUBLE PRECISION,
    "checkinLocationId" TEXT,
    "checkoutLocationId" TEXT,
    "workDurationMinutes" INTEGER,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "notes" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_task_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT,
    "task" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'LAINNYA',
    "categoryConfigId" TEXT,
    "photoUrl" TEXT,
    "duration" INTEGER,
    "labId" TEXT,
    "relatedTicketId" TEXT,
    "relatedMissionId" TEXT,
    "relatedScheduleId" TEXT,
    "status" "DailyTaskStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL,
    "isGeofencingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultRadiusMeter" INTEGER NOT NULL DEFAULT 100,
    "lateToleranceMinutes" INTEGER NOT NULL DEFAULT 15,
    "checkoutGraceMinutes" INTEGER NOT NULL DEFAULT 30,
    "forgotCheckoutAfterMinutes" INTEGER NOT NULL DEFAULT 120,
    "isTaskRequired" BOOLEAN NOT NULL DEFAULT true,
    "isVerificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusMeter" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aslab_shift_schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "scheduleDate" DATE NOT NULL,
    "status" "ShiftScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "assignedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aslab_shift_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_category_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPoints" INTEGER NOT NULL DEFAULT 0,
    "isEvidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_category_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_correction_requests" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "CorrectionRequestType" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "description" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "semester" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "missionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "skillsEarned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "pdfUrl" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_nim_key" ON "users"("nim");

-- CreateIndex
CREATE UNIQUE INDEX "users_nip_key" ON "users"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "labs_name_key" ON "labs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pcs_pcCode_key" ON "pcs"("pcCode");

-- CreateIndex
CREATE UNIQUE INDEX "pcs_assetCode_key" ON "pcs"("assetCode");

-- CreateIndex
CREATE INDEX "pc_status_logs_pcId_createdAt_idx" ON "pc_status_logs"("pcId", "createdAt");

-- CreateIndex
CREATE INDEX "pc_commands_pcId_status_idx" ON "pc_commands"("pcId", "status");

-- CreateIndex
CREATE INDEX "pc_commands_status_createdAt_idx" ON "pc_commands"("status", "createdAt");

-- CreateIndex
CREATE INDEX "pc_agent_logs_pcId_createdAt_idx" ON "pc_agent_logs"("pcId", "createdAt");

-- CreateIndex
CREATE INDEX "pc_warnings_pcId_isResolved_idx" ON "pc_warnings"("pcId", "isResolved");

-- CreateIndex
CREATE INDEX "schedules_labId_startTime_idx" ON "schedules"("labId", "startTime");

-- CreateIndex
CREATE INDEX "schedules_status_startTime_idx" ON "schedules"("status", "startTime");

-- CreateIndex
CREATE INDEX "schedules_assistantId_idx" ON "schedules"("assistantId");

-- CreateIndex
CREATE UNIQUE INDEX "logbooks_officialCheckinById_date_key" ON "logbooks"("officialCheckinById", "date");

-- CreateIndex
CREATE UNIQUE INDEX "logbook_conditions_logbookId_labId_key" ON "logbook_conditions"("logbookId", "labId");

-- CreateIndex
CREATE UNIQUE INDEX "keys_keyCode_key" ON "keys"("keyCode");

-- CreateIndex
CREATE INDEX "tickets_labId_status_idx" ON "tickets"("labId", "status");

-- CreateIndex
CREATE INDEX "tickets_status_createdAt_idx" ON "tickets"("status", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_reportedBy_idx" ON "tickets"("reportedBy");

-- CreateIndex
CREATE INDEX "tickets_assignedTo_idx" ON "tickets"("assignedTo");

-- CreateIndex
CREATE INDEX "missions_status_createdAt_idx" ON "missions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "missions_createdById_idx" ON "missions"("createdById");

-- CreateIndex
CREATE INDEX "mission_claims_aslebId_status_idx" ON "mission_claims"("aslebId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mission_claims_missionId_aslebId_key" ON "mission_claims"("missionId", "aslebId");

-- CreateIndex
CREATE INDEX "attendances_userId_createdAt_idx" ON "attendances"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "attendances_status_createdAt_idx" ON "attendances"("status", "createdAt");

-- CreateIndex
CREATE INDEX "leave_requests_userId_status_idx" ON "leave_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_status_date_idx" ON "leave_requests"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_userId_date_key" ON "leave_requests"("userId", "date");

-- CreateIndex
CREATE INDEX "daily_task_logs_userId_createdAt_idx" ON "daily_task_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "daily_task_logs_status_createdAt_idx" ON "daily_task_logs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "daily_task_logs_labId_date_idx" ON "daily_task_logs"("labId", "date");

-- CreateIndex
CREATE INDEX "aslab_shift_schedules_scheduleDate_status_idx" ON "aslab_shift_schedules"("scheduleDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "aslab_shift_schedules_userId_shiftId_scheduleDate_key" ON "aslab_shift_schedules"("userId", "shiftId", "scheduleDate");

-- CreateIndex
CREATE UNIQUE INDEX "task_category_configs_name_key" ON "task_category_configs"("name");

-- CreateIndex
CREATE INDEX "attendance_correction_requests_userId_status_idx" ON "attendance_correction_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "attendance_correction_requests_status_createdAt_idx" ON "attendance_correction_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "pcs" ADD CONSTRAINT "pcs_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_status_logs" ADD CONSTRAINT "pc_status_logs_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_commands" ADD CONSTRAINT "pc_commands_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_agent_logs" ADD CONSTRAINT "pc_agent_logs_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_warnings" ADD CONSTRAINT "pc_warnings_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_aslebId_fkey" FOREIGN KEY ("aslebId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_bookings" ADD CONSTRAINT "lab_bookings_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_bookings" ADD CONSTRAINT "lab_bookings_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_bookings" ADD CONSTRAINT "lab_bookings_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_officialCheckinById_fkey" FOREIGN KEY ("officialCheckinById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbooks" ADD CONSTRAINT "logbooks_officialCheckoutById_fkey" FOREIGN KEY ("officialCheckoutById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbook_conditions" ADD CONSTRAINT "logbook_conditions_logbookId_fkey" FOREIGN KEY ("logbookId") REFERENCES "logbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbook_conditions" ADD CONSTRAINT "logbook_conditions_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbook_conditions" ADD CONSTRAINT "logbook_conditions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logbook_conditions" ADD CONSTRAINT "logbook_conditions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keys" ADD CONSTRAINT "keys_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keys" ADD CONSTRAINT "keys_currentHolderId_fkey" FOREIGN KEY ("currentHolderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_logs" ADD CONSTRAINT "key_logs_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_logs" ADD CONSTRAINT "key_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_claims" ADD CONSTRAINT "mission_claims_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_claims" ADD CONSTRAINT "mission_claims_aslebId_fkey" FOREIGN KEY ("aslebId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_claims" ADD CONSTRAINT "mission_claims_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shiftScheduleId_fkey" FOREIGN KEY ("shiftScheduleId") REFERENCES "aslab_shift_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_checkinLocationId_fkey" FOREIGN KEY ("checkinLocationId") REFERENCES "attendance_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_checkoutLocationId_fkey" FOREIGN KEY ("checkoutLocationId") REFERENCES "attendance_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_categoryConfigId_fkey" FOREIGN KEY ("categoryConfigId") REFERENCES "task_category_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_relatedTicketId_fkey" FOREIGN KEY ("relatedTicketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_relatedMissionId_fkey" FOREIGN KEY ("relatedMissionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_task_logs" ADD CONSTRAINT "daily_task_logs_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aslab_shift_schedules" ADD CONSTRAINT "aslab_shift_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aslab_shift_schedules" ADD CONSTRAINT "aslab_shift_schedules_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aslab_shift_schedules" ADD CONSTRAINT "aslab_shift_schedules_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aslab_shift_schedules" ADD CONSTRAINT "aslab_shift_schedules_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points" ADD CONSTRAINT "points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

