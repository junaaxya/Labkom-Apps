import assert from "node:assert/strict";
import test from "node:test";
import {
  academicOfferingQuerySchema,
  createAcademicReportSchema,
  updateAcademicReportSchema,
} from "./academic.validator";

const offeringId = "cmoseuhxj0001ofz5r10a18l1";

test("academic reports accept exactly Stage 2 statuses", () => {
  const statuses = ["TATAP_MUKA", "ONLINE", "TIDAK_MASUK", "PINDAH_JADWAL", "BELUM_PASTI"];

  for (const status of statuses) {
    assert.equal(
      createAcademicReportSchema.safeParse({ offeringId, reportDate: "2026-10-22", status }).success,
      true,
      status,
    );
  }

  for (const status of ["PENDING", "APPROVED", "SELESAI"]) {
    assert.equal(
      createAcademicReportSchema.safeParse({ offeringId, reportDate: "2026-10-22", status }).success,
      false,
      status,
    );
  }
});

test("academic report updates require optimistic revision", () => {
  assert.equal(
    updateAcademicReportSchema.safeParse({ status: "ONLINE" }).success,
    false,
  );
  assert.equal(
    updateAcademicReportSchema.safeParse({ expectedRevision: 0, status: "ONLINE" }).success,
    false,
  );
  assert.deepEqual(
    updateAcademicReportSchema.parse({ expectedRevision: "2", status: "ONLINE", notes: "Kuliah daring" }),
    { expectedRevision: 2, status: "ONLINE", notes: "Kuliah daring" },
  );
});

test("academic list filters accept an omitted optional boolean", () => {
  assert.deepEqual(academicOfferingQuerySchema.parse({}), {});
  assert.deepEqual(academicOfferingQuerySchema.parse({ isActive: "true" }), { isActive: true });
  assert.deepEqual(academicOfferingQuerySchema.parse({ isActive: "false" }), { isActive: false });
  assert.equal(academicOfferingQuerySchema.safeParse({ isActive: "yes" }).success, false);
});
