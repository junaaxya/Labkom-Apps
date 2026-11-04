type CohortIdentity = {
  className?: string | null;
  semester?: string | null;
};

function compact(value?: string | null): string {
  return (value || "").trim().toLocaleLowerCase("id-ID").replace(/[\s._-]+/g, "");
}

export function canonicalSemester(value?: string | null): string | null {
  const match = compact(value).match(/^(?:semester|s)?0*(\d+)$/);
  return match?.[1] || null;
}

export function semesterFromGenericClass(value?: string | null): string | null {
  const normalized = compact(value);
  if (!/^(?:semester|s)0*\d+$/.test(normalized)) return null;
  return canonicalSemester(normalized);
}

export function matchesAcademicCohort(user: CohortIdentity, schedule: CohortIdentity): boolean {
  const userSemester = canonicalSemester(user.semester) || semesterFromGenericClass(user.className);
  const scheduleSemester = canonicalSemester(schedule.semester) || semesterFromGenericClass(schedule.className);
  if (!userSemester || !scheduleSemester || userSemester !== scheduleSemester) return false;

  if (semesterFromGenericClass(schedule.className)) return true;
  const userClass = compact(user.className);
  const scheduleClass = compact(schedule.className);
  return Boolean(userClass && scheduleClass && userClass === scheduleClass);
}

export function academicCohortsOverlap(left: CohortIdentity, right: CohortIdentity): boolean {
  const leftSemester = canonicalSemester(left.semester) || semesterFromGenericClass(left.className);
  const rightSemester = canonicalSemester(right.semester) || semesterFromGenericClass(right.className);
  if (!leftSemester || !rightSemester || leftSemester !== rightSemester) return false;
  if (semesterFromGenericClass(left.className) || semesterFromGenericClass(right.className)) return true;
  return Boolean(compact(left.className) && compact(left.className) === compact(right.className));
}
