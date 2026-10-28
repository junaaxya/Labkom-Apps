ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DOSEN';

CREATE TYPE "AcademicReportStatus" AS ENUM ('TATAP_MUKA', 'ONLINE', 'TIDAK_MASUK', 'PINDAH_JADWAL', 'BELUM_PASTI');

CREATE TABLE "academic_terms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_courses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_classes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_classes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_class_memberships" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_class_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_class_leaders" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_class_leaders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_offerings" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "dosenId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_offerings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_offering_pjs" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_offering_pjs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_reports" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "status" "AcademicReportStatus" NOT NULL,
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_report_revisions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "AcademicReportStatus" NOT NULL,
    "notes" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_report_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_terms_code_key" ON "academic_terms"("code");
CREATE UNIQUE INDEX "academic_courses_code_key" ON "academic_courses"("code");
CREATE UNIQUE INDEX "academic_classes_code_key" ON "academic_classes"("code");
CREATE UNIQUE INDEX "academic_class_memberships_termId_classId_userId_key" ON "academic_class_memberships"("termId", "classId", "userId");
CREATE UNIQUE INDEX "academic_class_leaders_membershipId_key" ON "academic_class_leaders"("membershipId");
CREATE UNIQUE INDEX "academic_offerings_termId_courseId_classId_key" ON "academic_offerings"("termId", "courseId", "classId");
CREATE UNIQUE INDEX "academic_offering_pjs_offeringId_membershipId_key" ON "academic_offering_pjs"("offeringId", "membershipId");
CREATE UNIQUE INDEX "academic_reports_offeringId_reportDate_key" ON "academic_reports"("offeringId", "reportDate");
CREATE UNIQUE INDEX "academic_report_revisions_reportId_revision_key" ON "academic_report_revisions"("reportId", "revision");
CREATE UNIQUE INDEX "academic_class_leaders_one_active_per_scope_key" ON "academic_class_leaders"("termId", "classId") WHERE "isActive";
CREATE UNIQUE INDEX "academic_offering_pjs_one_active_per_offering_key" ON "academic_offering_pjs"("offeringId") WHERE "isActive";

CREATE INDEX "academic_terms_isActive_idx" ON "academic_terms"("isActive");
CREATE INDEX "academic_courses_isActive_idx" ON "academic_courses"("isActive");
CREATE INDEX "academic_classes_isActive_idx" ON "academic_classes"("isActive");
CREATE INDEX "academic_class_memberships_userId_isActive_idx" ON "academic_class_memberships"("userId", "isActive");
CREATE INDEX "academic_class_memberships_termId_classId_isActive_idx" ON "academic_class_memberships"("termId", "classId", "isActive");
CREATE INDEX "academic_class_leaders_termId_classId_isActive_idx" ON "academic_class_leaders"("termId", "classId", "isActive");
CREATE INDEX "academic_offerings_dosenId_isActive_idx" ON "academic_offerings"("dosenId", "isActive");
CREATE INDEX "academic_offerings_termId_classId_isActive_idx" ON "academic_offerings"("termId", "classId", "isActive");
CREATE INDEX "academic_offering_pjs_offeringId_isActive_idx" ON "academic_offering_pjs"("offeringId", "isActive");
CREATE INDEX "academic_offering_pjs_membershipId_isActive_idx" ON "academic_offering_pjs"("membershipId", "isActive");
CREATE INDEX "academic_reports_offeringId_reportDate_idx" ON "academic_reports"("offeringId", "reportDate");
CREATE INDEX "academic_report_revisions_reportId_createdAt_idx" ON "academic_report_revisions"("reportId", "createdAt");

ALTER TABLE "academic_class_memberships" ADD CONSTRAINT "academic_class_memberships_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_class_memberships" ADD CONSTRAINT "academic_class_memberships_classId_fkey" FOREIGN KEY ("classId") REFERENCES "academic_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_class_memberships" ADD CONSTRAINT "academic_class_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_class_leaders" ADD CONSTRAINT "academic_class_leaders_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_class_leaders" ADD CONSTRAINT "academic_class_leaders_classId_fkey" FOREIGN KEY ("classId") REFERENCES "academic_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_class_leaders" ADD CONSTRAINT "academic_class_leaders_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "academic_class_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_offerings" ADD CONSTRAINT "academic_offerings_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_offerings" ADD CONSTRAINT "academic_offerings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "academic_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_offerings" ADD CONSTRAINT "academic_offerings_classId_fkey" FOREIGN KEY ("classId") REFERENCES "academic_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_offerings" ADD CONSTRAINT "academic_offerings_dosenId_fkey" FOREIGN KEY ("dosenId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_offering_pjs" ADD CONSTRAINT "academic_offering_pjs_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_offering_pjs" ADD CONSTRAINT "academic_offering_pjs_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "academic_class_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_reports" ADD CONSTRAINT "academic_reports_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "academic_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_reports" ADD CONSTRAINT "academic_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_reports" ADD CONSTRAINT "academic_reports_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_report_revisions" ADD CONSTRAINT "academic_report_revisions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "academic_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_report_revisions" ADD CONSTRAINT "academic_report_revisions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
