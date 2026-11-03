import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import prisma from "../config/database";
import { AcademicAuthorizationError, AcademicConflictError, AcademicService } from "./academic.service";

type Restore = () => void;

const ids = {
  offering: "cmoseuhxj0001ofz5r10a18l1",
  report: "cmoseuhxj0002ofz5r10a18l2",
  dosen: "cmoseuhxj0003ofz5r10a18l3",
  otherDosen: "cmoseuhxj0004ofz5r10a18l4",
  course: "cmoseuhxj0004ofz5r10a18m4",
  student: "cmoseuhxj0005ofz5r10a18l5",
  term: "cmoseuhxj0006ofz5r10a18l6",
  academicClass: "cmoseuhxj0007ofz5r10a18l7",
  leader: "cmoseuhxj0008ofz5r10a18l8",
  otherLeader: "cmoseuhxj0009ofz5r10a18l9",
  ordinaryStudent: "cmoseuhxj0010ofz5r10a18m0",
  coordinator: "cmoseuhxj0011ofz5r10a18m1",
  otherTerm: "cmoseuhxj0012ofz5r10a18m2",
  otherClass: "cmoseuhxj0013ofz5r10a18m3",
};

const reportDate = new Date("2026-10-26T00:00:00.000Z");

function legalOccurrenceSchedule() {
  return {
    id: "schedule-report",
    labId: "lab-report",
    title: "Praktikum Terstruktur",
    lecturerName: null,
    className: null,
    semester: null,
    startTime: "08:00",
    endTime: "10:00",
    specificDate: null,
    day: "SENIN",
    type: "PRAKTIKUM",
    status: "SCHEDULED",
    isActive: true,
    academicOffering: {
      id: ids.offering,
      termId: ids.term,
      classId: ids.academicClass,
      dosenId: ids.dosen,
      isActive: true,
    },
    allocatedSlotRequest: null,
    occurrenceReleases: [],
    lab: { id: "lab-report", name: "Lab Report", location: null },
    assistant: null,
  };
}

function legalOccurrenceDelegates() {
  return {
    schedule: { findMany: async () => [legalOccurrenceSchedule()] },
    academicOccurrenceSwap: { findMany: async () => [] },
  };
}

function replaceProperty(target: object, property: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

test("academic service never reads legacy isKetuaKelas authority", () => {
  const source = readFileSync(path.join(__dirname, "academic.service.ts"), "utf8");
  assert.doesNotMatch(source, /isKetuaKelas/);
});

test("active structured leader PJ reads stay inside exact offering class", async () => {
  const offering = {
    id: ids.offering,
    termId: ids.term,
    classId: ids.academicClass,
    isActive: true,
    term: { isActive: true },
    academicClass: { isActive: true },
  };
  const memberships = [{ id: "membership-1", user: { id: "member-user-1", name: "Member One" } }];
  const pjs = [{
    id: "pj-1",
    membershipId: "membership-1",
    membership: { user: { id: "member-user-1", name: "Member One" } },
  }];
  const leaderQueries: unknown[] = [];
  let membershipQuery: unknown;
  let pjQuery: unknown;
  const restores = [
    replaceProperty(prisma.academicOffering, "findUnique", async () => offering),
    replaceProperty(prisma.user, "findUnique", async () => ({ id: ids.leader, role: "MAHASISWA", isActive: true })),
    replaceProperty(prisma.academicClassLeader, "findFirst", async ({ where }: { where: unknown }) => {
      leaderQueries.push(where);
      return { id: "leader-assignment-1" };
    }),
    replaceProperty(prisma.academicClassMembership, "findMany", async (input: unknown) => {
      membershipQuery = input;
      return memberships;
    }),
    replaceProperty(prisma.academicOfferingPJ, "findMany", async (input: unknown) => {
      pjQuery = input;
      return pjs;
    }),
  ];

  const leaderWhere = {
    termId: ids.term,
    classId: ids.academicClass,
    isActive: true,
    term: { isActive: true },
    academicClass: { isActive: true },
    membership: {
      userId: ids.leader,
      termId: ids.term,
      classId: ids.academicClass,
      isActive: true,
      user: { role: "MAHASISWA", isActive: true },
    },
  };

  try {
    assert.deepEqual(
      await AcademicService.listPjMemberships(ids.offering, { userId: ids.leader, role: "MAHASISWA" }),
      memberships,
    );
    assert.deepEqual(
      await AcademicService.listOfferingPjs(ids.offering, { userId: ids.leader, role: "MAHASISWA" }),
      pjs,
    );
    assert.deepEqual(leaderQueries, [leaderWhere, leaderWhere]);
    assert.deepEqual(membershipQuery, {
      where: {
        termId: ids.term,
        classId: ids.academicClass,
        isActive: true,
        user: { role: "MAHASISWA", isActive: true },
      },
      select: { id: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    assert.deepEqual(pjQuery, {
      where: {
        offeringId: ids.offering,
        isActive: true,
        membership: {
          termId: ids.term,
          classId: ids.academicClass,
          isActive: true,
          user: { role: "MAHASISWA", isActive: true },
        },
      },
      select: {
        id: true,
        membershipId: true,
        membership: { select: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("ordinary student, other-class leader, and DOSEN cannot read scoped PJ data", async () => {
  const offering = {
    id: ids.offering,
    termId: ids.term,
    classId: ids.academicClass,
    isActive: true,
    term: { isActive: true },
    academicClass: { isActive: true },
  };
  const leaderQueries: unknown[] = [];
  const activeLeaders = [{ termId: ids.otherTerm, classId: ids.otherClass, userId: ids.otherLeader }];
  let membershipReads = 0;
  let pjReads = 0;
  const restores = [
    replaceProperty(prisma.academicOffering, "findUnique", async () => offering),
    replaceProperty(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      role: where.id === ids.dosen ? "DOSEN" : "MAHASISWA",
      isActive: true,
    })),
    replaceProperty(prisma.academicClassLeader, "findFirst", async ({ where }: { where: unknown }) => {
      leaderQueries.push(where);
      const scope = where as { termId: string; classId: string; membership: { userId: string } };
      return activeLeaders.some(
        (leader) =>
          leader.termId === scope.termId &&
          leader.classId === scope.classId &&
          leader.userId === scope.membership.userId,
      ) ? { id: "other-class-leader-assignment" } : null;
    }),
    replaceProperty(prisma.academicClassMembership, "findMany", async () => {
      membershipReads += 1;
      return [];
    }),
    replaceProperty(prisma.academicOfferingPJ, "findMany", async () => {
      pjReads += 1;
      return [];
    }),
  ];

  try {
    await assert.rejects(
      AcademicService.listPjMemberships(ids.offering, { userId: ids.ordinaryStudent, role: "MAHASISWA" }),
      AcademicAuthorizationError,
    );
    await assert.rejects(
      AcademicService.listOfferingPjs(ids.offering, { userId: ids.otherLeader, role: "MAHASISWA" }),
      AcademicAuthorizationError,
    );
    await assert.rejects(
      AcademicService.listPjMemberships(ids.offering, { userId: ids.dosen, role: "DOSEN" }),
      AcademicAuthorizationError,
    );
    assert.deepEqual(leaderQueries, [
      {
        termId: ids.term,
        classId: ids.academicClass,
        isActive: true,
        term: { isActive: true },
        academicClass: { isActive: true },
        membership: {
          userId: ids.ordinaryStudent,
          termId: ids.term,
          classId: ids.academicClass,
          isActive: true,
          user: { role: "MAHASISWA", isActive: true },
        },
      },
      {
        termId: ids.term,
        classId: ids.academicClass,
        isActive: true,
        term: { isActive: true },
        academicClass: { isActive: true },
        membership: {
          userId: ids.otherLeader,
          termId: ids.term,
          classId: ids.academicClass,
          isActive: true,
          user: { role: "MAHASISWA", isActive: true },
        },
      },
    ]);
    assert.equal(membershipReads, 0);
    assert.equal(pjReads, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("scoped PJ reads use persisted actor role instead of caller role", async () => {
  const offering = {
    id: ids.offering,
    termId: ids.term,
    classId: ids.academicClass,
    isActive: true,
    term: { isActive: true },
    academicClass: { isActive: true },
  };
  let membershipReads = 0;
  const restores = [
    replaceProperty(prisma.academicOffering, "findUnique", async () => offering),
    replaceProperty(prisma.user, "findUnique", async () => ({ id: ids.ordinaryStudent, role: "MAHASISWA", isActive: true })),
    replaceProperty(prisma.academicClassLeader, "findFirst", async () => null),
    replaceProperty(prisma.academicClassMembership, "findMany", async () => {
      membershipReads += 1;
      return [];
    }),
  ];

  try {
    await assert.rejects(
      AcademicService.listPjMemberships(ids.offering, { userId: ids.ordinaryStudent, role: "KOORDINATOR_LAB" }),
      AcademicAuthorizationError,
    );
    assert.equal(membershipReads, 0);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("coordinator scoped PJ reads do not require leader assignment", async () => {
  const offering = {
    id: ids.offering,
    termId: ids.term,
    classId: ids.academicClass,
    isActive: false,
    term: { isActive: false },
    academicClass: { isActive: false },
  };
  const memberships = [{ id: "membership-1", user: { id: "member-user-1", name: "Member One" } }];
  const pjs = [{ id: "pj-1", membershipId: "membership-1" }];
  const restores = [
    replaceProperty(prisma.academicOffering, "findUnique", async () => offering),
    replaceProperty(prisma.user, "findUnique", async () => ({ id: ids.coordinator, role: "KOORDINATOR_LAB", isActive: true })),
    replaceProperty(prisma.academicClassLeader, "findFirst", async () => {
      throw new Error("Coordinator must not require class leader assignment");
    }),
    replaceProperty(prisma.academicClassMembership, "findMany", async () => memberships),
    replaceProperty(prisma.academicOfferingPJ, "findMany", async () => pjs),
  ];

  try {
    assert.deepEqual(
      await AcademicService.listPjMemberships(ids.offering, { userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
      memberships,
    );
    assert.deepEqual(
      await AcademicService.listOfferingPjs(ids.offering, { userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
      pjs,
    );
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("DOSEN offering reads always scope to authenticated dosen", async () => {
  let capturedWhere: unknown;
  const restore = replaceProperty(prisma.academicOffering, "findMany", async ({ where }: { where: unknown }) => {
    capturedWhere = where;
    return [];
  });

  try {
    await AcademicService.listOfferings(
      { dosenId: ids.otherDosen },
      { userId: ids.dosen, role: "DOSEN" },
    );
    assert.deepEqual(capturedWhere, { dosenId: ids.dosen });
  } finally {
    restore();
  }
});

test("ordinary member receives read-only capabilities while active leader receives scoped actions", async () => {
  const offerings = [{
    id: ids.offering, termId: ids.term, classId: ids.academicClass, dosenId: ids.dosen,
    term: {}, course: {}, academicClass: {}, dosen: {}, schedule: null, pjs: [],
  }];
  const restoreOffering = replaceProperty(prisma.academicOffering, "findMany", async () => offerings);
  const restoreMembership = replaceProperty(prisma.academicClassMembership, "findMany", async () => [{ termId: ids.term, classId: ids.academicClass }]);
  const restorePj = replaceProperty(prisma.academicOfferingPJ, "findMany", async () => []);
  const restoreLeader = replaceProperty(prisma.academicClassLeader, "findMany", async () => []);
  try {
    const [offering] = await AcademicService.listOfferings({}, { userId: ids.ordinaryStudent, role: "MAHASISWA" });
    assert.deepEqual(offering.capabilities, {
      canReport: false, canManagePj: false, canRelease: false,
      canRequestSlot: false, canRequestSwap: false, canCoordinate: false,
    });
  } finally {
    restoreLeader(); restorePj(); restoreMembership(); restoreOffering();
  }

  const restoreOfferingLeader = replaceProperty(prisma.academicOffering, "findMany", async () => offerings);
  const restoreMembershipLeader = replaceProperty(prisma.academicClassMembership, "findMany", async () => [{ termId: ids.term, classId: ids.academicClass }]);
  const restorePjLeader = replaceProperty(prisma.academicOfferingPJ, "findMany", async () => []);
  const restoreLeaderActive = replaceProperty(prisma.academicClassLeader, "findMany", async () => [{ termId: ids.term, classId: ids.academicClass }]);
  try {
    const [offering] = await AcademicService.listOfferings({}, { userId: ids.leader, role: "MAHASISWA" });
    assert.deepEqual(offering.capabilities, {
      canReport: true, canManagePj: true, canRelease: true,
      canRequestSlot: true, canRequestSwap: true, canCoordinate: false,
    });
  } finally {
    restoreLeaderActive(); restorePjLeader(); restoreMembershipLeader(); restoreOfferingLeader();
  }
});

test("leader and PJ assignment revalidate authority and membership inside the serializable transaction", async () => {
  const audits: string[] = [];
  const tx = {
    user: { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, role: where.id === ids.coordinator ? "KOORDINATOR_LAB" : "MAHASISWA", isActive: true }) },
    academicClassMembership: {
      findUnique: async () => ({ id: "membership-1", termId: ids.term, classId: ids.academicClass, isActive: true, user: { role: "MAHASISWA", isActive: true } }),
    },
    academicClassLeader: {
      findFirst: async () => ({ id: "leader-1" }),
      updateMany: async () => ({ count: 1 }),
      upsert: async () => ({ id: "leader-1" }),
    },
    academicOffering: {
      findUnique: async () => ({ id: ids.offering, termId: ids.term, classId: ids.academicClass }),
    },
    academicOfferingPJ: {
      updateMany: async () => ({ count: 1 }),
      upsert: async () => ({ id: "pj-1" }),
    },
    auditLog: { create: async ({ data }: { data: { action: string } }) => { audits.push(data.action); return {}; } },
  };
  const restoreTransaction = replaceProperty(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
  const restoreGlobalMembership = replaceProperty(prisma.academicClassMembership, "findUnique", async () => { throw new Error("global membership read is forbidden"); });
  const restoreGlobalOffering = replaceProperty(prisma.academicOffering, "findUnique", async () => { throw new Error("global offering read is forbidden"); });
  try {
    await AcademicService.assignLeader(
      { termId: ids.term, classId: ids.academicClass, membershipId: "membership-1" },
      { userId: ids.coordinator, role: "KOORDINATOR_LAB" },
    );
    await AcademicService.assignPj(
      ids.offering,
      { membershipId: "membership-1" },
      { userId: ids.leader, role: "MAHASISWA" },
    );
    assert.deepEqual(audits, ["ACADEMIC_CLASS_LEADER_ASSIGNED", "ACADEMIC_OFFERING_PJ_ASSIGNED"]);
  } finally {
    restoreGlobalOffering();
    restoreGlobalMembership();
    restoreTransaction();
  }
});

test("student offering reads return empty without active structured membership", async () => {
  let capturedWhere: unknown;
  const restores = [
    replaceProperty(prisma.academicClassLeader, "findMany", async () => []),
    replaceProperty(prisma.academicOfferingPJ, "findMany", async () => []),
    replaceProperty(prisma.academicClassMembership, "findMany", async () => []),
    replaceProperty(prisma.academicOffering, "findMany", async ({ where }: { where: unknown }) => {
      capturedWhere = where;
      return [];
    }),
  ];

  try {
    assert.deepEqual(
      await AcademicService.listOfferings({}, { userId: ids.ordinaryStudent, role: "MAHASISWA" }),
      [],
    );
    assert.deepEqual(capturedWhere, { id: { in: [] } });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("coordinator schedule candidates use only safe predicate and display fields", async () => {
  const candidates = [{
    id: "schedule-1",
    title: "Praktikum Basis Data",
    day: "SENIN",
    specificDate: null,
    startTime: "08:00",
    endTime: "10:00",
    className: "TI-2A",
    semester: "3",
    lecturerName: "Dosen Lama",
    lab: { id: "lab-1", name: "Lab Basis Data", location: "Gedung A" },
  }];
  let reads = 0;
  let capturedQuery: unknown;
  const restore = replaceProperty(prisma.schedule, "findMany", async (query: unknown) => {
    reads += 1;
    capturedQuery = query;
    return candidates;
  });

  try {
    assert.deepEqual(
      await AcademicService.listScheduleCandidates({ userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
      candidates,
    );
    assert.deepEqual(capturedQuery, {
      where: {
        isActive: true,
        type: "PRAKTIKUM",
        status: "SCHEDULED",
        academicOffering: null,
      },
      select: {
        id: true,
        title: true,
        day: true,
        specificDate: true,
        startTime: true,
        endTime: true,
        className: true,
        semester: true,
        lecturerName: true,
        lab: { select: { id: true, name: true, location: true } },
      },
    });
    await assert.rejects(
      AcademicService.listScheduleCandidates({ userId: ids.ordinaryStudent, role: "MAHASISWA" }),
      AcademicAuthorizationError,
    );
    assert.equal(reads, 1);
  } finally {
    restore();
  }
});

test("offering creation requires active structured references and DOSEN", async () => {
  let inactiveReference: "term" | "course" | "class" | "dosen" | undefined;
  let creates = 0;
  const input = { termId: ids.term, courseId: ids.course, classId: ids.academicClass, dosenId: ids.dosen };
  const restores = [
    replaceProperty(prisma.academicTerm, "findUnique", async () => ({ id: ids.term, isActive: inactiveReference !== "term" })),
    replaceProperty(prisma.academicCourse, "findUnique", async () => ({ id: ids.course, isActive: inactiveReference !== "course" })),
    replaceProperty(prisma.academicClass, "findUnique", async () => ({ id: ids.academicClass, isActive: inactiveReference !== "class" })),
    replaceProperty(prisma.user, "findUnique", async () => ({ id: ids.dosen, role: "DOSEN", isActive: inactiveReference !== "dosen" })),
    replaceProperty(prisma.academicOffering, "create", async () => {
      creates += 1;
      return { id: ids.offering };
    }),
  ];

  try {
    for (const reference of ["term", "course", "class", "dosen"] as const) {
      inactiveReference = reference;
      await assert.rejects(
        AcademicService.createOffering(input, { userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
        /aktif diperlukan/,
      );
    }
    assert.equal(creates, 0);

    inactiveReference = undefined;
    assert.deepEqual(
      await AcademicService.createOffering(input, { userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
      { id: ids.offering },
    );
    assert.equal(creates, 1);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("offering DOSEN reassignment requires an active DOSEN", async () => {
  let dosenActive = false;
  let updates = 0;
  const restores = [
    replaceProperty(prisma.user, "findUnique", async () => ({ role: "DOSEN", isActive: dosenActive })),
    replaceProperty(prisma.academicOffering, "update", async () => {
      updates += 1;
      return { id: ids.offering, dosenId: ids.dosen };
    }),
  ];

  try {
    await assert.rejects(
      AcademicService.updateOffering(ids.offering, { dosenId: ids.dosen }, { userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
      /Dosen aktif diperlukan/,
    );
    assert.equal(updates, 0);

    dosenActive = true;
    assert.deepEqual(
      await AcademicService.updateOffering(ids.offering, { dosenId: ids.dosen }, { userId: ids.coordinator, role: "KOORDINATOR_LAB" }),
      { id: ids.offering, dosenId: ids.dosen },
    );
    assert.equal(updates, 1);
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test("legacy chair flag cannot create academic report without active leader or PJ assignment", async () => {
  let reportWrites = 0;
  const tx = {
    academicOffering: {
      findUnique: async () => ({
        id: ids.offering,
        isActive: true,
        termId: ids.term,
        classId: ids.academicClass,
      }),
    },
    academicClassLeader: { findFirst: async () => null },
    academicOfferingPJ: { findFirst: async () => null },
    academicReport: {
      create: async () => {
        reportWrites += 1;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AcademicService.createReport(
        { offeringId: ids.offering, reportDate: new Date("2026-10-22T00:00:00.000Z"), status: "TATAP_MUKA" },
        { userId: ids.student, role: "MAHASISWA" },
      ),
      /Ketua kelas atau PJ aktif/,
    );
    assert.equal(reportWrites, 0);
  } finally {
    restore();
  }
});

test("report creation rejects a date without a legal actual occurrence before writes", async () => {
  let reportWrites = 0;
  let revisionWrites = 0;
  let auditWrites = 0;
  const tx = {
    academicOffering: {
      findUnique: async () => ({
        id: ids.offering,
        isActive: true,
        termId: ids.term,
        classId: ids.academicClass,
        dosenId: ids.dosen,
        scheduleId: "schedule-report",
        term: { startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z") },
      }),
    },
    schedule: { findMany: async () => [] },
    academicOccurrenceSwap: { findMany: async () => [] },
    academicReport: {
      create: async () => { reportWrites += 1; },
    },
    academicReportRevision: {
      create: async () => { revisionWrites += 1; },
    },
    auditLog: {
      create: async () => { auditWrites += 1; },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AcademicService.createReport(
        { offeringId: ids.offering, reportDate, status: "TATAP_MUKA" },
        { userId: ids.coordinator, role: "KOORDINATOR_LAB" },
      ),
      /Tidak ada pertemuan akademik yang sah/,
    );
    assert.equal(reportWrites, 0);
    assert.equal(revisionWrites, 0);
    assert.equal(auditWrites, 0);
  } finally {
    restore();
  }
});

test("report creation accepts a legal WIB occurrence inside the academic term", async () => {
  const writes: unknown[] = [];
  const tx = {
    academicOffering: {
      findUnique: async () => ({
        id: ids.offering,
        isActive: true,
        termId: ids.term,
        classId: ids.academicClass,
        dosenId: ids.dosen,
        scheduleId: "schedule-report",
        term: { startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z") },
      }),
    },
    ...legalOccurrenceDelegates(),
    academicReport: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return { id: ids.report, ...data, revision: 1, notes: null };
      },
      findUniqueOrThrow: async () => ({
        id: ids.report,
        offeringId: ids.offering,
        reportDate,
        status: "TATAP_MUKA",
        revision: 1,
        offering: { course: { code: "IF101" } },
      }),
    },
    academicReportRevision: { create: async () => ({}) },
    auditLog: { create: async () => ({}) },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    const result = await AcademicService.createReport(
      { offeringId: ids.offering, reportDate, status: "TATAP_MUKA" },
      { userId: ids.coordinator, role: "KOORDINATOR_LAB" },
    );
    assert.equal(result.id, ids.report);
    assert.equal(writes.length, 1);
    assert.equal((writes[0] as { reportDate: Date }).reportDate.toISOString(), reportDate.toISOString());
  } finally {
    restore();
  }
});

test("report update uses expected revision then appends revision and audit log", async () => {
  const reportUpdates: unknown[] = [];
  const revisions: unknown[] = [];
  const audits: unknown[] = [];
  const current = {
    id: ids.report,
    revision: 2,
    notes: "Tatap muka",
    reportDate,
    release: null,
    offering: { id: ids.offering, isActive: true, termId: ids.term, classId: ids.academicClass, dosenId: ids.dosen },
  };
  const tx = {
    academicOffering: {
      findUnique: async () => ({
        id: ids.offering,
        term: { startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z") },
      }),
    },
    ...legalOccurrenceDelegates(),
    academicReport: {
      findUnique: async () => current,
      updateMany: async (input: unknown) => {
        reportUpdates.push(input);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ id: ids.report, revision: 3 }),
    },
    academicReportRevision: {
      create: async (input: unknown) => {
        revisions.push(input);
      },
    },
    auditLog: {
      create: async (input: unknown) => {
        audits.push(input);
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    const result = await AcademicService.updateReport(
      ids.report,
      { expectedRevision: 2, status: "ONLINE", notes: "Kuliah daring" },
      { userId: "coordinator-1", role: "KOORDINATOR_LAB", ipAddress: "127.0.0.1" },
    );
    assert.deepEqual(result, { id: ids.report, revision: 3 });
    assert.deepEqual(reportUpdates, [{
      where: { id: ids.report, revision: 2, release: null },
      data: {
        status: "ONLINE",
        notes: "Kuliah daring",
        revision: { increment: 1 },
        updatedById: "coordinator-1",
      },
    }]);
    assert.deepEqual(revisions, [{
      data: {
        reportId: ids.report,
        revision: 3,
        status: "ONLINE",
        notes: "Kuliah daring",
        changedById: "coordinator-1",
      },
    }]);
    assert.deepEqual(audits, [{
      data: {
        userId: "coordinator-1",
        action: "ACADEMIC_REPORT_UPDATED",
        targetType: "AcademicReport",
        targetId: ids.report,
        description: "Revisi 3",
        ipAddress: "127.0.0.1",
      },
    }]);
  } finally {
    restore();
  }
});

test("stale expected revision cannot append revision or audit log", async () => {
  let revisionWrites = 0;
  let auditWrites = 0;
  const tx = {
    academicReport: {
      findUnique: async () => ({
        id: ids.report,
        revision: 3,
        notes: "Sudah diubah",
        reportDate,
        release: null,
        offering: { id: ids.offering, isActive: true, termId: ids.term, classId: ids.academicClass, dosenId: ids.dosen },
      }),
      updateMany: async () => ({ count: 0 }),
    },
    academicOffering: {
      findUnique: async () => ({
        id: ids.offering,
        term: { startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-12-31T00:00:00.000Z") },
      }),
    },
    ...legalOccurrenceDelegates(),
    academicReportRevision: {
      create: async () => {
        revisionWrites += 1;
      },
    },
    auditLog: {
      create: async () => {
        auditWrites += 1;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      AcademicService.updateReport(
        ids.report,
        { expectedRevision: 2, status: "ONLINE" },
        { userId: "coordinator-1", role: "KOORDINATOR_LAB" },
      ),
      AcademicConflictError,
    );
    assert.equal(revisionWrites, 0);
    assert.equal(auditWrites, 0);
  } finally {
    restore();
  }
});
