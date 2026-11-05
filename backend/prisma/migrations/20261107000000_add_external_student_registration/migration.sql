ALTER TYPE "AccessRequestType" ADD VALUE 'MAHASISWA_EKSTERNAL';
ALTER TABLE "access_requests" ADD COLUMN "applicantNim" TEXT;
ALTER TABLE "users"
  ADD COLUMN "studyProgram" TEXT,
  ADD COLUMN "registrationSource" TEXT,
  ADD COLUMN "academicProfileCompletedAt" TIMESTAMP(3),
  ADD COLUMN "academicProfileTermId" TEXT;

CREATE TABLE "external_student_verifications" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  "accessRequestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_student_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_student_verifications_tokenHash_key" ON "external_student_verifications"("tokenHash");
CREATE UNIQUE INDEX "external_student_verifications_userId_key" ON "external_student_verifications"("userId");
CREATE UNIQUE INDEX "external_student_verifications_accessRequestId_key" ON "external_student_verifications"("accessRequestId");
CREATE INDEX "external_student_verifications_expiresAt_idx" ON "external_student_verifications"("expiresAt");
ALTER TABLE "external_student_verifications" ADD CONSTRAINT "external_student_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_student_verifications" ADD CONSTRAINT "external_student_verifications_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
