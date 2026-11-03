CREATE TYPE "KeyBorrowCycleStatus" AS ENUM ('ACTIVE', 'RETURNED', 'FORCE_RETURNED', 'CANCELLED');

ALTER TYPE "KeyAction" ADD VALUE 'FORCE_RETURNED';

CREATE TABLE "key_borrow_cycles" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "occurrenceDate" DATE NOT NULL,
    "bookingId" TEXT,
    "borrowerId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnConditionId" TEXT,
    "status" "KeyBorrowCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "takenByRole" "Role" NOT NULL,
    "returnedById" TEXT,
    "forceReturnedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_borrow_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "key_borrow_evidence" (
    "id" TEXT NOT NULL,
    "keyBorrowCycleId" TEXT NOT NULL,
    "logbookConditionId" TEXT,
    "submittedById" TEXT NOT NULL,
    "fotoBukti" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_borrow_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "condition_photo_uploads" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "keyBorrowCycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condition_photo_uploads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "key_logs" ADD COLUMN "borrowCycleId" TEXT;

CREATE UNIQUE INDEX "key_borrow_cycles_keyId_scheduleId_occurrenceDate_key" ON "key_borrow_cycles"("keyId", "scheduleId", "occurrenceDate");
CREATE UNIQUE INDEX "key_borrow_evidence_keyBorrowCycleId_key" ON "key_borrow_evidence"("keyBorrowCycleId");
CREATE UNIQUE INDEX "condition_photo_uploads_url_key" ON "condition_photo_uploads"("url");
CREATE INDEX "key_borrow_cycles_keyId_status_idx" ON "key_borrow_cycles"("keyId", "status");
CREATE INDEX "key_borrow_cycles_borrowerId_status_idx" ON "key_borrow_cycles"("borrowerId", "status");
CREATE INDEX "key_borrow_cycles_scheduleId_occurrenceDate_idx" ON "key_borrow_cycles"("scheduleId", "occurrenceDate");
CREATE INDEX "key_borrow_cycles_returnConditionId_idx" ON "key_borrow_cycles"("returnConditionId");
CREATE INDEX "key_borrow_evidence_logbookConditionId_idx" ON "key_borrow_evidence"("logbookConditionId");
CREATE INDEX "condition_photo_uploads_ownerId_createdAt_idx" ON "condition_photo_uploads"("ownerId", "createdAt");
CREATE INDEX "condition_photo_uploads_keyBorrowCycleId_idx" ON "condition_photo_uploads"("keyBorrowCycleId");
CREATE INDEX "key_logs_borrowCycleId_idx" ON "key_logs"("borrowCycleId");
CREATE INDEX "key_logs_keyId_createdAt_idx" ON "key_logs"("keyId", "createdAt");

ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "lab_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_forceReturnedById_fkey" FOREIGN KEY ("forceReturnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_borrow_cycles" ADD CONSTRAINT "key_borrow_cycles_returnConditionId_fkey" FOREIGN KEY ("returnConditionId") REFERENCES "logbook_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_borrow_evidence" ADD CONSTRAINT "key_borrow_evidence_keyBorrowCycleId_fkey" FOREIGN KEY ("keyBorrowCycleId") REFERENCES "key_borrow_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_borrow_evidence" ADD CONSTRAINT "key_borrow_evidence_logbookConditionId_fkey" FOREIGN KEY ("logbookConditionId") REFERENCES "logbook_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_borrow_evidence" ADD CONSTRAINT "key_borrow_evidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "condition_photo_uploads" ADD CONSTRAINT "condition_photo_uploads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "condition_photo_uploads" ADD CONSTRAINT "condition_photo_uploads_keyBorrowCycleId_fkey" FOREIGN KEY ("keyBorrowCycleId") REFERENCES "key_borrow_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_logs" ADD CONSTRAINT "key_logs_borrowCycleId_fkey" FOREIGN KEY ("borrowCycleId") REFERENCES "key_borrow_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
