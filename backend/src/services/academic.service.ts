import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { canonicalDateOnly } from "./jakarta-time";
import type {
  AcademicLeaderQueryInput,
  AcademicMembershipQueryInput,
  AcademicOfferingQueryInput,
  AcademicPjQueryInput,
  AcademicReportQueryInput,
  AssignAcademicLeaderInput,
  AssignAcademicPjInput,
  CreateAcademicClassInput,
  CreateAcademicCourseInput,
  CreateAcademicDosenInput,
  CreateAcademicMembershipInput,
  CreateAcademicOfferingInput,
  CreateAcademicReportInput,
  CreateAcademicTermInput,
  UpdateAcademicClassInput,
  UpdateAcademicCourseInput,
  UpdateAcademicDosenInput,
  UpdateAcademicLeaderInput,
  UpdateAcademicMembershipInput,
  UpdateAcademicOfferingInput,
  UpdateAcademicPjInput,
  UpdateAcademicReportInput,
  UpdateAcademicTermInput,
} from "../validators/academic.validator";

type UserContext = {
  userId: string;
  role: string;
  ipAddress?: string;
};

type AcademicScopeClient = Pick<Prisma.TransactionClient, "academicClassLeader" | "academicOfferingPJ">;

type ClassScope = {
  termId: string;
  classId: string;
};

type OfferingScope = ClassScope & {
  isActive: boolean;
  dosenId: string;
};

type StudentAuthorityScopes = {
  leaderScopes: ClassScope[];
  pjOfferingIds: string[];
  membershipScopes: ClassScope[];
};

class AcademicConflictError extends Error {}
class AcademicAuthorizationError extends Error {}

const dosenSelect = {
  id: true,
  email: true,
  name: true,
  nip: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const offeringInclude = {
  term: { select: { id: true, code: true, name: true, isActive: true } },
  course: { select: { id: true, code: true, name: true, isActive: true } },
  academicClass: { select: { id: true, code: true, name: true, isActive: true } },
  dosen: { select: dosenSelect },
  pjs: {
    where: { isActive: true },
    include: {
      membership: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
      },
    },
  },
} satisfies Prisma.AcademicOfferingInclude;

const reportInclude = {
  offering: {
    include: {
      term: { select: { id: true, code: true, name: true } },
      course: { select: { id: true, code: true, name: true } },
      academicClass: { select: { id: true, code: true, name: true } },
      dosen: { select: dosenSelect },
    },
  },
  createdBy: { select: { id: true, name: true, role: true } },
  updatedBy: { select: { id: true, name: true, role: true } },
  revisions: {
    orderBy: { revision: "asc" },
    include: { changedBy: { select: { id: true, name: true, role: true } } },
  },
} satisfies Prisma.AcademicReportInclude;

function assertCoordinator(actor: UserContext): void {
  if (actor.role !== "KOORDINATOR_LAB") {
    throw new AcademicAuthorizationError("Hanya Koordinator Lab yang dapat mengelola data akademik");
  }
}

function cleanNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  return value.trim() || null;
}

function masterWhere<T extends { isActive?: boolean }>(input: T): { isActive?: boolean } {
  return input.isActive === undefined ? {} : { isActive: input.isActive };
}

async function getStudentAuthorityScopes(userId: string): Promise<StudentAuthorityScopes> {
  const [leaders, pjs, memberships] = await Promise.all([
    prisma.academicClassLeader.findMany({
      where: {
        isActive: true,
        term: { isActive: true },
        academicClass: { isActive: true },
        membership: { userId, isActive: true, user: { role: "MAHASISWA", isActive: true } },
      },
      select: { termId: true, classId: true },
    }),
    prisma.academicOfferingPJ.findMany({
      where: {
        isActive: true,
        offering: { isActive: true, term: { isActive: true }, academicClass: { isActive: true } },
        membership: { userId, isActive: true, user: { role: "MAHASISWA", isActive: true } },
      },
      select: {
        offeringId: true,
        offering: { select: { termId: true, classId: true } },
        membership: { select: { termId: true, classId: true } },
      },
    }),
    prisma.academicClassMembership.findMany({
      where: {
        userId,
        isActive: true,
        term: { isActive: true },
        academicClass: { isActive: true },
        user: { role: "MAHASISWA", isActive: true },
      },
      select: { termId: true, classId: true },
    }),
  ]);

  return {
    leaderScopes: leaders,
    pjOfferingIds: pjs
      .filter(
        (pj) =>
          pj.offering.termId === pj.membership.termId &&
          pj.offering.classId === pj.membership.classId
      )
      .map((pj) => pj.offeringId),
    membershipScopes: memberships,
  };
}

function offeringScopeWhere(scopes: StudentAuthorityScopes): Prisma.AcademicOfferingWhereInput {
  const or: Prisma.AcademicOfferingWhereInput[] = [];
  if (scopes.pjOfferingIds.length > 0) or.push({ id: { in: scopes.pjOfferingIds } });
  for (const scope of scopes.membershipScopes) {
    or.push({ termId: scope.termId, classId: scope.classId });
  }
  for (const scope of scopes.leaderScopes) {
    or.push({ termId: scope.termId, classId: scope.classId });
  }
  return or.length > 0 ? { OR: or } : { id: { in: [] } };
}

async function assertPjManagementAuthority(
  actor: UserContext,
  offering: { termId: string; classId: string }
): Promise<void> {
  if (actor.role === "KOORDINATOR_LAB") return;
  if (actor.role !== "MAHASISWA") {
    throw new AcademicAuthorizationError("Hanya Koordinator Lab atau Ketua Kelas aktif yang dapat mengelola PJ");
  }
  const leader = await prisma.academicClassLeader.findFirst({
    where: {
      termId: offering.termId,
      classId: offering.classId,
      isActive: true,
      membership: {
        userId: actor.userId,
        termId: offering.termId,
        classId: offering.classId,
        isActive: true,
        user: { role: "MAHASISWA", isActive: true },
      },
    },
    select: { id: true },
  });
  if (!leader) {
    throw new AcademicAuthorizationError("Ketua kelas aktif untuk term dan kelas ini diperlukan");
  }
}

async function assertReportWriteAuthority(
  client: AcademicScopeClient,
  actor: UserContext,
  offering: OfferingScope & { id: string }
): Promise<void> {
  if (actor.role === "KOORDINATOR_LAB") return;
  if (!offering.isActive) {
    throw new AcademicAuthorizationError("Penawaran akademik tidak aktif");
  }
  if (actor.role === "DOSEN") {
    if (offering.dosenId === actor.userId) return;
    throw new AcademicAuthorizationError("Anda hanya dapat melaporkan penawaran milik sendiri");
  }
  if (actor.role !== "MAHASISWA") {
    throw new AcademicAuthorizationError("Anda tidak memiliki otoritas laporan akademik");
  }

  const leader = await client.academicClassLeader.findFirst({
    where: {
      termId: offering.termId,
      classId: offering.classId,
      isActive: true,
      term: { isActive: true },
      academicClass: { isActive: true },
      membership: {
        userId: actor.userId,
        termId: offering.termId,
        classId: offering.classId,
        isActive: true,
        user: { role: "MAHASISWA", isActive: true },
      },
    },
    select: { id: true },
  });
  if (leader) return;

  const pj = await client.academicOfferingPJ.findFirst({
    where: {
      offeringId: offering.id,
      isActive: true,
      offering: { isActive: true, term: { isActive: true }, academicClass: { isActive: true } },
      membership: {
        userId: actor.userId,
        termId: offering.termId,
        classId: offering.classId,
        isActive: true,
        user: { role: "MAHASISWA", isActive: true },
      },
    },
    select: { id: true },
  });
  if (pj) return;

  throw new AcademicAuthorizationError("Ketua kelas atau PJ aktif untuk penawaran ini diperlukan");
}

async function assertReportReadAuthority(
  actor: UserContext,
  offering: OfferingScope & { id: string; dosenId: string }
): Promise<void> {
  if (actor.role === "KOORDINATOR_LAB") return;
  if (actor.role === "DOSEN") {
    if (offering.dosenId === actor.userId) return;
    throw new AcademicAuthorizationError("Anda hanya dapat membaca penawaran dan laporan milik sendiri");
  }
  if (actor.role !== "MAHASISWA") {
    throw new AcademicAuthorizationError("Anda tidak memiliki akses ke laporan akademik");
  }
  const membership = await prisma.academicClassMembership.findFirst({
    where: {
      userId: actor.userId,
      termId: offering.termId,
      classId: offering.classId,
      isActive: true,
      user: { role: "MAHASISWA", isActive: true },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new AcademicAuthorizationError("Keanggotaan kelas aktif untuk penawaran ini diperlukan");
  }
}

async function assertMembershipReferences(input: CreateAcademicMembershipInput): Promise<void> {
  const [term, academicClass, user] = await Promise.all([
    prisma.academicTerm.findUnique({ where: { id: input.termId }, select: { id: true } }),
    prisma.academicClass.findUnique({ where: { id: input.classId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true, isActive: true } }),
  ]);
  if (!term) throw new Error("Term akademik tidak ditemukan");
  if (!academicClass) throw new Error("Kelas akademik tidak ditemukan");
  if (!user || user.role !== "MAHASISWA" || !user.isActive) {
    throw new Error("Keanggotaan kelas wajib memakai mahasiswa aktif");
  }
}

async function assertOfferingReferences(input: CreateAcademicOfferingInput): Promise<void> {
  const [term, course, academicClass, dosen] = await Promise.all([
    prisma.academicTerm.findUnique({ where: { id: input.termId }, select: { id: true } }),
    prisma.academicCourse.findUnique({ where: { id: input.courseId }, select: { id: true } }),
    prisma.academicClass.findUnique({ where: { id: input.classId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: input.dosenId }, select: { id: true, role: true } }),
  ]);
  if (!term) throw new Error("Term akademik tidak ditemukan");
  if (!course) throw new Error("Mata kuliah tidak ditemukan");
  if (!academicClass) throw new Error("Kelas akademik tidak ditemukan");
  if (!dosen || dosen.role !== "DOSEN") throw new Error("Dosen tidak ditemukan");
}

async function assertDosen(dosenId: string): Promise<void> {
  const dosen = await prisma.user.findUnique({ where: { id: dosenId }, select: { role: true } });
  if (!dosen || dosen.role !== "DOSEN") throw new Error("Dosen tidak ditemukan");
}

async function assertLeaderMembership(input: AssignAcademicLeaderInput) {
  const membership = await prisma.academicClassMembership.findUnique({
    where: { id: input.membershipId },
    select: { id: true, termId: true, classId: true, isActive: true, user: { select: { role: true, isActive: true } } },
  });
  if (
    !membership ||
    !membership.isActive ||
    membership.termId !== input.termId ||
    membership.classId !== input.classId ||
    membership.user.role !== "MAHASISWA" ||
    !membership.user.isActive
  ) {
    throw new Error("Ketua kelas wajib memakai keanggotaan mahasiswa aktif pada term dan kelas yang sama");
  }
}

async function assertPjMembership(offeringId: string, membershipId: string) {
  const [offering, membership] = await Promise.all([
    prisma.academicOffering.findUnique({ where: { id: offeringId }, select: { id: true, termId: true, classId: true } }),
    prisma.academicClassMembership.findUnique({
      where: { id: membershipId },
      select: { id: true, termId: true, classId: true, isActive: true, user: { select: { role: true, isActive: true } } },
    }),
  ]);
  if (!offering) throw new Error("Penawaran akademik tidak ditemukan");
  if (
    !membership ||
    !membership.isActive ||
    membership.termId !== offering.termId ||
    membership.classId !== offering.classId ||
    membership.user.role !== "MAHASISWA" ||
    !membership.user.isActive
  ) {
    throw new Error("PJ wajib memakai keanggotaan mahasiswa aktif pada term dan kelas penawaran yang sama");
  }
}

export { AcademicAuthorizationError, AcademicConflictError };

export class AcademicService {
  static async listDosen() {
    return prisma.user.findMany({ where: { role: "DOSEN" }, select: dosenSelect, orderBy: { name: "asc" } });
  }

  static async createDosen(input: CreateAcademicDosenInput, actor: UserContext) {
    assertCoordinator(actor);
    const email = input.email.toLowerCase();
    const [existingEmail, existingNip] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      input.nip ? prisma.user.findUnique({ where: { nip: input.nip }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (existingEmail) throw new AcademicConflictError("Email sudah terdaftar");
    if (existingNip) throw new AcademicConflictError("NIP sudah terdaftar");

    return prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(input.password, 12),
        name: input.name.trim(),
        nip: input.nip?.trim(),
        phone: input.phone?.trim(),
        role: "DOSEN",
      },
      select: dosenSelect,
    });
  }

  static async updateDosen(id: string, input: UpdateAcademicDosenInput, actor: UserContext) {
    assertCoordinator(actor);
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, email: true, nip: true } });
    if (!existing || existing.role !== "DOSEN") throw new Error("Dosen tidak ditemukan");

    const email = input.email?.toLowerCase();
    if (email && email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (duplicate) throw new AcademicConflictError("Email sudah terdaftar");
    }
    if (input.nip && input.nip !== existing.nip) {
      const duplicate = await prisma.user.findUnique({ where: { nip: input.nip }, select: { id: true } });
      if (duplicate) throw new AcademicConflictError("NIP sudah terdaftar");
    }

    return prisma.user.update({
      where: { id },
      data: {
        email,
        name: input.name?.trim(),
        nip: cleanNullableText(input.nip),
        phone: cleanNullableText(input.phone),
        isActive: input.isActive,
      },
      select: dosenSelect,
    });
  }

  static async listTerms() {
    return prisma.academicTerm.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] });
  }

  static async createTerm(input: CreateAcademicTermInput, actor: UserContext) {
    assertCoordinator(actor);
    return prisma.academicTerm.create({
      data: {
        code: input.code.trim(),
        name: input.name.trim(),
        startDate: input.startDate ? canonicalDateOnly(input.startDate) : undefined,
        endDate: input.endDate ? canonicalDateOnly(input.endDate) : undefined,
        isActive: input.isActive,
      },
    });
  }

  static async updateTerm(id: string, input: UpdateAcademicTermInput, actor: UserContext) {
    assertCoordinator(actor);
    const current = await prisma.academicTerm.findUnique({ where: { id }, select: { startDate: true, endDate: true } });
    if (!current) throw new Error("Term akademik tidak ditemukan");
    const startDate = input.startDate === undefined ? current.startDate : input.startDate && canonicalDateOnly(input.startDate);
    const endDate = input.endDate === undefined ? current.endDate : input.endDate && canonicalDateOnly(input.endDate);
    if (startDate && endDate && startDate > endDate) {
      throw new Error("Tanggal mulai harus sebelum atau sama dengan tanggal selesai");
    }
    return prisma.academicTerm.update({
      where: { id },
      data: {
        code: input.code?.trim(),
        name: input.name?.trim(),
        startDate,
        endDate,
        isActive: input.isActive,
      },
    });
  }

  static async listCourses() {
    return prisma.academicCourse.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] });
  }

  static async createCourse(input: CreateAcademicCourseInput, actor: UserContext) {
    assertCoordinator(actor);
    return prisma.academicCourse.create({ data: { code: input.code.trim(), name: input.name.trim(), isActive: input.isActive } });
  }

  static async updateCourse(id: string, input: UpdateAcademicCourseInput, actor: UserContext) {
    assertCoordinator(actor);
    return prisma.academicCourse.update({
      where: { id },
      data: { code: input.code?.trim(), name: input.name?.trim(), isActive: input.isActive },
    });
  }

  static async listClasses() {
    return prisma.academicClass.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] });
  }

  static async createClass(input: CreateAcademicClassInput, actor: UserContext) {
    assertCoordinator(actor);
    return prisma.academicClass.create({ data: { code: input.code.trim(), name: input.name.trim(), isActive: input.isActive } });
  }

  static async updateClass(id: string, input: UpdateAcademicClassInput, actor: UserContext) {
    assertCoordinator(actor);
    return prisma.academicClass.update({
      where: { id },
      data: { code: input.code?.trim(), name: input.name?.trim(), isActive: input.isActive },
    });
  }

  static async listMemberships(query: AcademicMembershipQueryInput) {
    return prisma.academicClassMembership.findMany({
      where: {
        ...(query.termId ? { termId: query.termId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...masterWhere(query),
      },
      include: {
        term: { select: { id: true, code: true, name: true } },
        academicClass: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        leaderAssignment: true,
        pjAssignments: { where: { isActive: true }, select: { id: true, offeringId: true, isActive: true } },
      },
      orderBy: [{ term: { code: "asc" } }, { academicClass: { code: "asc" } }, { user: { name: "asc" } }],
    });
  }

  static async createMembership(input: CreateAcademicMembershipInput, actor: UserContext) {
    assertCoordinator(actor);
    await assertMembershipReferences(input);
    return prisma.academicClassMembership.create({ data: input });
  }

  static async updateMembership(id: string, input: UpdateAcademicMembershipInput, actor: UserContext) {
    assertCoordinator(actor);
    return prisma.academicClassMembership.update({ where: { id }, data: input });
  }

  static async listLeaders(query: AcademicLeaderQueryInput) {
    return prisma.academicClassLeader.findMany({
      where: {
        ...(query.termId ? { termId: query.termId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...masterWhere(query),
      },
      include: {
        term: { select: { id: true, code: true, name: true } },
        academicClass: { select: { id: true, code: true, name: true } },
        membership: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  static async assignLeader(input: AssignAcademicLeaderInput, actor: UserContext) {
    assertCoordinator(actor);
    await assertLeaderMembership(input);
    return prisma.$transaction(async (tx) => {
      await tx.academicClassLeader.updateMany({
        where: { termId: input.termId, classId: input.classId, isActive: true },
        data: { isActive: false },
      });
      return tx.academicClassLeader.upsert({
        where: { membershipId: input.membershipId },
        create: { ...input, isActive: true },
        update: { termId: input.termId, classId: input.classId, isActive: true },
        include: {
          term: { select: { id: true, code: true, name: true } },
          academicClass: { select: { id: true, code: true, name: true } },
          membership: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
    });
  }

  static async updateLeader(id: string, input: UpdateAcademicLeaderInput, actor: UserContext) {
    assertCoordinator(actor);
    const leader = await prisma.academicClassLeader.findUnique({
      where: { id },
      select: { id: true, termId: true, classId: true, membershipId: true },
    });
    if (!leader) throw new Error("Ketua kelas tidak ditemukan");
    if (!input.isActive) return prisma.academicClassLeader.update({ where: { id }, data: { isActive: false } });
    return this.assignLeader({ termId: leader.termId, classId: leader.classId, membershipId: leader.membershipId }, actor);
  }

  static async listOfferings(query: AcademicOfferingQueryInput, actor: UserContext) {
    if (actor.role !== "KOORDINATOR_LAB" && actor.role !== "DOSEN" && actor.role !== "MAHASISWA") {
      throw new AcademicAuthorizationError("Anda tidak memiliki akses ke penawaran akademik");
    }
    const actorScope = actor.role === "MAHASISWA" ? offeringScopeWhere(await getStudentAuthorityScopes(actor.userId)) : {};
    return prisma.academicOffering.findMany({
      where: {
        ...(query.termId ? { termId: query.termId } : {}),
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(actor.role === "DOSEN" ? { dosenId: actor.userId } : query.dosenId ? { dosenId: query.dosenId } : {}),
        ...masterWhere(query),
        ...actorScope,
      },
      include: offeringInclude,
      orderBy: [{ term: { code: "desc" } }, { course: { code: "asc" } }, { academicClass: { code: "asc" } }],
    });
  }

  static async createOffering(input: CreateAcademicOfferingInput, actor: UserContext) {
    assertCoordinator(actor);
    await assertOfferingReferences(input);
    return prisma.academicOffering.create({ data: input, include: offeringInclude });
  }

  static async updateOffering(id: string, input: UpdateAcademicOfferingInput, actor: UserContext) {
    assertCoordinator(actor);
    if (input.dosenId) await assertDosen(input.dosenId);
    return prisma.academicOffering.update({ where: { id }, data: input, include: offeringInclude });
  }

  static async listPjs(query: AcademicPjQueryInput) {
    return prisma.academicOfferingPJ.findMany({
      where: {
        ...(query.offeringId ? { offeringId: query.offeringId } : {}),
        ...(query.membershipId ? { membershipId: query.membershipId } : {}),
        ...masterWhere(query),
      },
      include: {
        offering: { include: offeringInclude },
        membership: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  static async assignPj(offeringId: string, input: AssignAcademicPjInput, actor: UserContext) {
    const offering = await prisma.academicOffering.findUnique({
      where: { id: offeringId },
      select: { id: true, termId: true, classId: true },
    });
    if (!offering) throw new Error("Penawaran akademik tidak ditemukan");
    await assertPjManagementAuthority(actor, offering);
    await assertPjMembership(offeringId, input.membershipId);
    return prisma.$transaction(async (tx) => {
      await tx.academicOfferingPJ.updateMany({ where: { offeringId, isActive: true }, data: { isActive: false } });
      return tx.academicOfferingPJ.upsert({
        where: { offeringId_membershipId: { offeringId, membershipId: input.membershipId } },
        create: { offeringId, membershipId: input.membershipId, isActive: true },
        update: { isActive: true },
        include: {
          offering: { include: offeringInclude },
          membership: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
    });
  }

  static async updatePj(id: string, input: UpdateAcademicPjInput, actor: UserContext) {
    const pj = await prisma.academicOfferingPJ.findUnique({
      where: { id },
      select: { id: true, offeringId: true, membershipId: true, offering: { select: { termId: true, classId: true } } },
    });
    if (!pj) throw new Error("PJ penawaran tidak ditemukan");
    await assertPjManagementAuthority(actor, pj.offering);
    if (!input.isActive) return prisma.academicOfferingPJ.update({ where: { id }, data: { isActive: false } });
    return this.assignPj(pj.offeringId, { membershipId: pj.membershipId }, actor);
  }

  static async listReports(query: AcademicReportQueryInput, actor: UserContext) {
    const baseOfferingWhere: Prisma.AcademicOfferingWhereInput = {
      ...(query.offeringId ? { id: query.offeringId } : {}),
      ...(query.termId ? { termId: query.termId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
    };
    let actorScope: Prisma.AcademicOfferingWhereInput;
    if (actor.role === "KOORDINATOR_LAB") {
      actorScope = {};
    } else if (actor.role === "DOSEN") {
      actorScope = { dosenId: actor.userId };
    } else if (actor.role === "MAHASISWA") {
      actorScope = offeringScopeWhere(await getStudentAuthorityScopes(actor.userId));
    } else {
      throw new AcademicAuthorizationError("Anda tidak memiliki akses ke laporan akademik");
    }

    return prisma.academicReport.findMany({
      where: {
        offering: { AND: [baseOfferingWhere, actorScope] },
        ...(query.reportDate ? { reportDate: canonicalDateOnly(query.reportDate) } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: reportInclude,
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
    });
  }

  static async getReport(id: string, actor: UserContext) {
    const report = await prisma.academicReport.findUnique({ where: { id }, include: reportInclude });
    if (!report) throw new Error("Laporan akademik tidak ditemukan");
    await assertReportReadAuthority(actor, report.offering);
    return report;
  }

  static async createReport(input: CreateAcademicReportInput, actor: UserContext) {
    return prisma.$transaction(async (tx) => {
      const offering = await tx.academicOffering.findUnique({
        where: { id: input.offeringId },
        select: { id: true, isActive: true, termId: true, classId: true, dosenId: true },
      });
      if (!offering) throw new Error("Penawaran akademik tidak ditemukan");
      await assertReportWriteAuthority(tx, actor, offering);

      const report = await tx.academicReport.create({
        data: {
          offeringId: input.offeringId,
          reportDate: canonicalDateOnly(input.reportDate),
          status: input.status,
          notes: cleanNullableText(input.notes),
          revision: 1,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      await tx.academicReportRevision.create({
        data: {
          reportId: report.id,
          revision: report.revision,
          status: report.status,
          notes: report.notes,
          changedById: actor.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "ACADEMIC_REPORT_CREATED",
          targetType: "AcademicReport",
          targetId: report.id,
          description: `Revisi ${report.revision}`,
          ipAddress: actor.ipAddress,
        },
      });
      return tx.academicReport.findUniqueOrThrow({ where: { id: report.id }, include: reportInclude });
    });
  }

  static async updateReport(id: string, input: UpdateAcademicReportInput, actor: UserContext) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.academicReport.findUnique({
        where: { id },
        include: { offering: { select: { id: true, isActive: true, termId: true, classId: true, dosenId: true } } },
      });
      if (!current) throw new Error("Laporan akademik tidak ditemukan");
      await assertReportWriteAuthority(tx, actor, current.offering);

      const nextRevision = input.expectedRevision + 1;
      const notes = input.notes === undefined ? current.notes : cleanNullableText(input.notes);
      const updated = await tx.academicReport.updateMany({
        where: { id, revision: input.expectedRevision },
        data: {
          status: input.status,
          notes,
          revision: { increment: 1 },
          updatedById: actor.userId,
        },
      });
      if (updated.count !== 1) {
        throw new AcademicConflictError("Revisi laporan sudah berubah. Muat ulang data sebelum menyimpan.");
      }
      await tx.academicReportRevision.create({
        data: {
          reportId: id,
          revision: nextRevision,
          status: input.status,
          notes,
          changedById: actor.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "ACADEMIC_REPORT_UPDATED",
          targetType: "AcademicReport",
          targetId: id,
          description: `Revisi ${nextRevision}`,
          ipAddress: actor.ipAddress,
        },
      });
      return tx.academicReport.findUniqueOrThrow({ where: { id }, include: reportInclude });
    });
  }
}
