import assert from "node:assert/strict";
import test from "node:test";
import { academicCohortsOverlap, canonicalSemester, matchesAcademicCohort, semesterFromGenericClass } from "./academic-cohort";

test("semester aliases normalize consistently", () => {
  for (const value of ["5", "S5", "s 5", "Semester 5", "semester-05"]) {
    assert.equal(canonicalSemester(value), "5");
  }
});

test("generic schedule class grants the whole matching semester", () => {
  for (const className of ["S5", "Semester 5"]) {
    assert.equal(matchesAcademicCohort(
      { className: "5A", semester: "5" },
      { className, semester: "Semester 5" },
    ), true);
  }
  assert.equal(matchesAcademicCohort(
    { className: "5A", semester: "5" },
    { className: "S3", semester: "3" },
  ), false);
});

test("explicit schedule class remains restricted to that class", () => {
  assert.equal(matchesAcademicCohort(
    { className: "5A", semester: "Semester 5" },
    { className: "5A", semester: "5" },
  ), true);
  assert.equal(matchesAcademicCohort(
    { className: "5B", semester: "5" },
    { className: "5A", semester: "5" },
  ), false);
  assert.equal(semesterFromGenericClass("5A"), null);
});

test("semester-wide and explicit classes overlap symmetrically", () => {
  assert.equal(academicCohortsOverlap(
    { className: "S5", semester: "5" },
    { className: "5A", semester: "Semester 5" },
  ), true);
  assert.equal(academicCohortsOverlap(
    { className: "5A", semester: "5" },
    { className: "S5", semester: "5" },
  ), true);
  assert.equal(academicCohortsOverlap(
    { className: "5A", semester: "5" },
    { className: "5B", semester: "5" },
  ), false);
});
