import { Prisma, SmartAcademicMeetingStatus } from "@prisma/client";
import prisma from "../config/database";
import { canonicalDateOnly, getJakartaClock, weekdayForDateOnly } from "./jakarta-time";
import { AcademicAuthorizationError, AcademicConflictError, AcademicValidationError } from "./academic.service";
import { operationalScheduleWhere, withSerializableRetry } from "./schedule-availability";

type Actor = { userId: string; role: string; ipAddress?: string };
type ReviewInput = { approved: boolean; rejectionReason?: string | null };

const scheduleInclude = {
  lab: { select: { id: true, name: true, capacity: true } },
  smartAcademicPjs: { where: { isActive: true }, include: { student: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.ScheduleInclude;

function normalized(value?: string | null) {
  return (value || "").trim().toLocaleLowerCase("id-ID");
}

function matchesOccurrence(schedule: { specificDate: Date | null; day: string }, date: Date) {
  return schedule.specificDate
    ? canonicalDateOnly(schedule.specificDate).getTime() === date.getTime()
    : schedule.day === weekdayForDateOnly(date);
}

async function activeActor(tx: Prisma.TransactionClient, actor: Actor) {
  const user = await tx.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, role: true, isActive: true, isKetuaKelas: true, className: true, semester: true },
  });
  if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
  return user;
}

function assertClassMatch(user: { className: string | null; semester: string | null }, schedule: { className: string | null; semester: string | null }) {
  const userClass = normalized(user.className);
  const scheduleClass = normalized(schedule.className);
  if (!userClass || !scheduleClass || userClass !== scheduleClass) {
    throw new AcademicAuthorizationError("Kelas mahasiswa harus sama persis dengan kelas jadwal");
  }
  const userSemester = normalized(user.semester).replace(/^semester\s*/, "");
  const scheduleSemester = normalized(schedule.semester).replace(/^semester\s*/, "");
  if (!userSemester || !scheduleSemester || userSemester !== scheduleSemester) {
    throw new AcademicAuthorizationError("Semester mahasiswa harus sama persis dengan semester jadwal");
  }
}

async function assertScheduleManager(tx: Prisma.TransactionClient, actor: Actor, schedule: { id: string; className: string | null; semester: string | null }) {
  const user = await activeActor(tx, actor);
  if (user.role === "KOORDINATOR_LAB") return user;
  if (user.role !== "MAHASISWA") throw new AcademicAuthorizationError("Ketua kelas atau PJ diperlukan");
  assertClassMatch(user, schedule);
  if (user.isKetuaKelas) return user;
  const pj = await tx.smartAcademicPj.findFirst({ where: { scheduleId: schedule.id, studentId: user.id, isActive: true } });
  if (!pj) throw new AcademicAuthorizationError("Ketua kelas atau PJ mata kuliah diperlukan");
  return user;
}

async function isActiveLabAssistant(tx: Prisma.TransactionClient | typeof prisma, userId: string, labId: string, date: Date, startTime: string, endTime: string) {
  const shift = await tx.asLabShiftSchedule.findFirst({
    where: {
      userId, labId, scheduleDate: date, status: "SCHEDULED",
      shift: { isActive: true, startTime: { lte: startTime }, endTime: { gte: endTime } },
      attendances: { some: { checkinAt: { not: null }, checkoutAt: null, status: "CHECKED_IN" } },
    },
    select: { id: true },
  });
  return Boolean(shift);
}

async function classOrLecturerConflict(tx: Prisma.TransactionClient, target: { id: string; className: string | null; lecturerName: string | null }, date: Date, startTime: string, endTime: string) {
  const schedules = await tx.schedule.findMany({
    where: {
      ...operationalScheduleWhere,
      id: { not: target.id },
      startTime: { lt: endTime }, endTime: { gt: startTime },
      OR: [{ specificDate: date }, { specificDate: null, day: weekdayForDateOnly(date) }],
    },
    select: { className: true, lecturerName: true, title: true },
  });
  const classConflict = schedules.find((item) => normalized(item.className) && normalized(item.className) === normalized(target.className));
  if (classConflict) throw new AcademicConflictError(`Kelas memiliki jadwal lain: ${classConflict.title}`);
  const lecturerConflict = schedules.find((item) => normalized(item.lecturerName) && normalized(item.lecturerName) === normalized(target.lecturerName));
  if (lecturerConflict) throw new AcademicConflictError(`Dosen memiliki jadwal lain: ${lecturerConflict.title}`);
}

export class SmartAcademicService {
  static async listSchedules(actor: Actor) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { role: true, isActive: true, className: true, semester: true } });
    if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
    const where: Prisma.ScheduleWhereInput = {
      ...operationalScheduleWhere,
      type: "PRAKTIKUM",
      ...(user.role === "MAHASISWA" ? { className: { equals: user.className || "", mode: "insensitive" } } : {}),
    };
    if (!["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"].includes(user.role)) throw new AcademicAuthorizationError("Akses Ruang Akademik ditolak");
    return prisma.schedule.findMany({ where, include: scheduleInclude, orderBy: [{ day: "asc" }, { startTime: "asc" }] });
  }

  static async listClassmates(scheduleId: string, actor: Actor) {
    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { id: true, className: true, semester: true } });
    if (!schedule) throw new AcademicConflictError("Jadwal tidak ditemukan");
    if (!normalized(schedule.className) || !normalized(schedule.semester)) throw new AcademicValidationError("Jadwal wajib memiliki kelas dan semester sebelum PJ dipilih");
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { role: true, isActive: true, isKetuaKelas: true, className: true, semester: true } });
    if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
    if (user.role !== "KOORDINATOR_LAB") {
      if (user.role !== "MAHASISWA" || !user.isKetuaKelas) throw new AcademicAuthorizationError("Hanya Ketua Kelas atau Koordinator yang dapat memilih PJ");
      assertClassMatch(user, schedule);
    }
    return prisma.user.findMany({
      where: {
        role: "MAHASISWA", isActive: true,
        className: { equals: schedule.className!, mode: "insensitive" },
        semester: { equals: schedule.semester!, mode: "insensitive" },
      },
      select: { id: true, name: true, email: true, nim: true }, orderBy: { name: "asc" },
    });
  }

  static async assignPj(scheduleId: string, studentId: string, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const schedule = await tx.schedule.findUnique({ where: { id: scheduleId }, select: { id: true, type: true, className: true, semester: true } });
      if (!schedule || schedule.type !== "PRAKTIKUM") throw new AcademicConflictError("Jadwal praktikum tidak ditemukan");
      if (!normalized(schedule.className) || !normalized(schedule.semester)) throw new AcademicValidationError("Jadwal wajib memiliki kelas dan semester sebelum PJ ditetapkan");
      const manager = await activeActor(tx, actor);
      if (manager.role !== "KOORDINATOR_LAB") {
        if (manager.role !== "MAHASISWA" || !manager.isKetuaKelas) throw new AcademicAuthorizationError("Hanya Ketua Kelas atau Koordinator yang dapat menetapkan PJ");
        assertClassMatch(manager, schedule);
      }
      const student = await tx.user.findUnique({ where: { id: studentId }, select: { id: true, role: true, isActive: true, className: true, semester: true } });
      if (!student?.isActive || student.role !== "MAHASISWA") throw new AcademicValidationError("PJ harus mahasiswa aktif");
      assertClassMatch(student, schedule);
      const assignment = await tx.smartAcademicPj.upsert({
        where: { scheduleId_studentId: { scheduleId, studentId } },
        create: { scheduleId, studentId, assignedById: manager.id },
        update: { isActive: true, assignedById: manager.id },
        include: { student: { select: { id: true, name: true, email: true } } },
      });
      await tx.auditLog.create({ data: { userId: manager.id, action: "SMART_ACADEMIC_PJ_ASSIGNED", targetType: "Schedule", targetId: scheduleId, description: studentId, ipAddress: actor.ipAddress } });
      return assignment;
    });
  }

  static async removePj(scheduleId: string, studentId: string, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const schedule = await tx.schedule.findUnique({ where: { id: scheduleId }, select: { id: true, className: true, semester: true } });
      if (!schedule) throw new AcademicConflictError("Jadwal tidak ditemukan");
      const manager = await activeActor(tx, actor);
      if (manager.role !== "KOORDINATOR_LAB") {
        if (manager.role !== "MAHASISWA" || !manager.isKetuaKelas) throw new AcademicAuthorizationError("Hanya Ketua Kelas atau Koordinator yang dapat mengubah PJ");
        assertClassMatch(manager, schedule);
      }
      return tx.smartAcademicPj.update({ where: { scheduleId_studentId: { scheduleId, studentId } }, data: { isActive: false } });
    });
  }

  static async report(input: { scheduleId: string; occurrenceDate: Date; status: SmartAcademicMeetingStatus; source: string; notes?: string | null }, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const date = canonicalDateOnly(input.occurrenceDate);
      const schedule = await tx.schedule.findUnique({ where: { id: input.scheduleId } });
      if (!schedule || schedule.type !== "PRAKTIKUM" || !schedule.isActive || schedule.status !== "SCHEDULED" || !matchesOccurrence(schedule, date)) {
        throw new AcademicConflictError("Pertemuan praktikum tidak tersedia pada tanggal tersebut");
      }
      await assertScheduleManager(tx, actor, schedule);
      const report = await tx.smartAcademicOccurrenceReport.upsert({
        where: { scheduleId_occurrenceDate: { scheduleId: schedule.id, occurrenceDate: date } },
        create: { scheduleId: schedule.id, occurrenceDate: date, status: input.status, source: input.source.trim(), notes: input.notes?.trim() || null, reportedById: actor.userId, labId: schedule.labId, startTime: schedule.startTime, endTime: schedule.endTime },
        update: { status: input.status, source: input.source.trim(), notes: input.notes?.trim() || null, reportedById: actor.userId },
        include: { schedule: { include: { lab: true } }, reportedBy: { select: { id: true, name: true } }, move: true },
      });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "SMART_ACADEMIC_OCCURRENCE_REPORTED", targetType: "Schedule", targetId: schedule.id, description: `${input.status}:${date.toISOString().slice(0, 10)}`, ipAddress: actor.ipAddress } });
      return report;
    });
  }

  static async listReports(actor: Actor) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { role: true, className: true, isActive: true } });
    if (!user?.isActive || !["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"].includes(user.role)) throw new AcademicAuthorizationError("Akses Ruang Akademik ditolak");
    return prisma.smartAcademicOccurrenceReport.findMany({
      where: user.role === "MAHASISWA" ? { OR: [
        { schedule: { className: { equals: user.className || "", mode: "insensitive" } } },
        { status: { in: ["KOSONG", "ONLINE"] } },
      ] } : {},
      include: { schedule: { include: { lab: true } }, reportedBy: { select: { id: true, name: true } }, move: { include: { requestedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } } } },
      orderBy: [{ occurrenceDate: "desc" }, { startTime: "asc" }],
    });
  }

  static async requestMove(input: { sourceReportId: string; targetScheduleId: string; reason?: string | null }, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const [report, target] = await Promise.all([
        tx.smartAcademicOccurrenceReport.findUnique({ where: { id: input.sourceReportId }, include: { schedule: true, move: true } }),
        tx.schedule.findUnique({ where: { id: input.targetScheduleId }, include: { lab: true } }),
      ]);
      if (!report || !["KOSONG", "ONLINE"].includes(report.status)) throw new AcademicConflictError("Slot belum dilaporkan kosong");
      if (report.move) throw new AcademicConflictError("Slot sudah memiliki pengajuan");
      if (!target || target.type !== "PRAKTIKUM" || !target.isActive || target.status !== "SCHEDULED" || !matchesOccurrence(target, report.occurrenceDate)) throw new AcademicConflictError("Jadwal target tidak tersedia pada tanggal tersebut");
      if (target.id === report.scheduleId) throw new AcademicConflictError("Jadwal asal tidak dapat memakai slotnya sendiri");
      await assertScheduleManager(tx, actor, target);
      await classOrLecturerConflict(tx, target, report.occurrenceDate, report.startTime, report.endTime);
      const [activeLogbook, activeKey, approvedBooking, pendingBooking] = await Promise.all([
        tx.logbook.findFirst({ where: { labId: report.labId, occurrenceDate: report.occurrenceDate, status: { notIn: ["COMPLETED", "CANCELLED"] }, schedule: { startTime: { lt: report.endTime }, endTime: { gt: report.startTime } } } }),
        tx.keyBorrowCycle.findFirst({ where: { occurrenceDate: report.occurrenceDate, status: "ACTIVE", key: { labId: report.labId } } }),
        tx.labBooking.findFirst({ where: { labId: report.labId, date: report.occurrenceDate, status: "APPROVED", startTime: { lt: report.endTime }, endTime: { gt: report.startTime } } }),
        tx.labBooking.findFirst({ where: { labId: report.labId, date: report.occurrenceDate, status: "PENDING", startTime: { lt: report.endTime }, endTime: { gt: report.startTime } } }),
      ]);
      if (activeLogbook) throw new AcademicConflictError("Lab memiliki sesi aktif");
      if (activeKey) throw new AcademicConflictError("Kunci lab sedang dipinjam");
      if (approvedBooking) throw new AcademicConflictError("Lab sudah memiliki booking aktif");
      const reasons: string[] = [];
      if (target.labId !== report.labId) reasons.push("Perubahan memakai lab berbeda");
      if (pendingBooking) reasons.push("Ada booking yang masih menunggu keputusan");
      const clock = getJakartaClock();
      if (report.occurrenceDate.getTime() === clock.date.getTime() && report.startTime <= clock.time) throw new AcademicConflictError("Slot sudah dimulai");
      if (report.occurrenceDate.getTime() === clock.date.getTime()) reasons.push("Perubahan diajukan pada hari pelaksanaan");
      const riskLevel = reasons.length ? "YELLOW" : "GREEN";
      const status = riskLevel === "GREEN" ? "AUTO_APPROVED" : "PENDING_REVIEW";
      const request = await tx.smartAcademicMoveRequest.create({
        data: { sourceReportId: report.id, targetScheduleId: target.id, requestedById: actor.userId, occurrenceDate: report.occurrenceDate, labId: report.labId, startTime: report.startTime, endTime: report.endTime, status, riskLevel, riskReasons: reasons, reason: input.reason?.trim() || null, ...(status === "AUTO_APPROVED" ? { reviewedAt: new Date() } : {}) },
        include: { sourceReport: { include: { schedule: true } }, targetSchedule: { include: { lab: true } }, requestedBy: { select: { id: true, name: true } } },
      });
      await tx.auditLog.create({ data: { userId: actor.userId, action: status === "AUTO_APPROVED" ? "SMART_ACADEMIC_MOVE_AUTO_APPROVED" : "SMART_ACADEMIC_MOVE_REQUESTED", targetType: "SmartAcademicMoveRequest", targetId: request.id, description: JSON.stringify(reasons), ipAddress: actor.ipAddress } });
      return request;
    });
  }

  static async listMoves(actor: Actor) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { role: true, className: true, isActive: true } });
    if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
    const include = { sourceReport: { include: { schedule: true } }, targetSchedule: { include: { lab: true } }, lab: { select: { id: true, name: true } }, requestedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } } } satisfies Prisma.SmartAcademicMoveRequestInclude;
    if (user.role === "ASISTEN_LAB") {
      const requests = await prisma.smartAcademicMoveRequest.findMany({ include, orderBy: { createdAt: "desc" } });
      const visible = await Promise.all(requests.map(async (request) =>
        await isActiveLabAssistant(prisma, actor.userId, request.labId, request.occurrenceDate, request.startTime, request.endTime) ? request : null
      ));
      return visible.filter((request): request is NonNullable<typeof request> => request !== null);
    }
    const where: Prisma.SmartAcademicMoveRequestWhereInput = user.role === "MAHASISWA"
      ? { targetSchedule: { className: { equals: user.className || "", mode: "insensitive" } } }
      : user.role === "KOORDINATOR_LAB" ? {} : { id: { in: [] } };
    return prisma.smartAcademicMoveRequest.findMany({ where, include, orderBy: { createdAt: "desc" } });
  }

  static async reviewMove(id: string, input: ReviewInput, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const user = await activeActor(tx, actor);
      const request = await tx.smartAcademicMoveRequest.findUnique({ where: { id } });
      if (!request || request.status !== "PENDING_REVIEW") throw new AcademicConflictError("Pengajuan sudah diputuskan atau tidak tersedia");
      if (user.role === "ASISTEN_LAB") {
        const active = await isActiveLabAssistant(tx, user.id, request.labId, request.occurrenceDate, request.startTime, request.endTime);
        if (!active) throw new AcademicAuthorizationError("Anda tidak sedang bertugas di lab ini");
      } else if (user.role !== "KOORDINATOR_LAB") {
        throw new AcademicAuthorizationError("Hanya Koordinator atau Aslab bertugas yang dapat meninjau");
      }
      const rejectionReason = input.rejectionReason?.trim() || null;
      if (!input.approved && (!rejectionReason || rejectionReason.length < 3)) throw new AcademicValidationError("Alasan penolakan minimal 3 karakter");
      const result = await tx.smartAcademicMoveRequest.updateMany({
        where: { id, status: "PENDING_REVIEW" },
        data: { status: input.approved ? "APPROVED" : "REJECTED", reviewedById: user.id, reviewedAt: new Date(), rejectionReason },
      });
      if (result.count !== 1) throw new AcademicConflictError("Pengajuan sudah diputuskan petugas lain");
      await tx.auditLog.create({ data: { userId: user.id, action: input.approved ? "SMART_ACADEMIC_MOVE_APPROVED" : "SMART_ACADEMIC_MOVE_REJECTED", targetType: "SmartAcademicMoveRequest", targetId: id, description: rejectionReason || "Disetujui", ipAddress: actor.ipAddress } });
      return tx.smartAcademicMoveRequest.findUnique({ where: { id }, include: { sourceReport: { include: { schedule: true } }, targetSchedule: { include: { lab: true } }, reviewedBy: { select: { id: true, name: true } } } });
    });
  }
}
