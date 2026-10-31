import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { canonicalDateOnly, getJakartaClock, weekdayForDateOnly } from "./jakarta-time";
import { operationalScheduleWhere, withSerializableRetry } from "./schedule-availability";
import { notificationService } from "./notification.service";
import { AcademicAuthorizationError, AcademicConflictError } from "./academic.service";
import { resolveActualOccurrences } from "./actual-occurrence.service";

type Actor = { userId: string; role: string; ipAddress?: string };
type CreateInput = { sourceOfferingId: string; targetOfferingId: string; occurrenceDate: Date; reason?: string | null };
type ReviewInput = { approved: boolean; rejectionReason?: string | null };

const occurrenceScheduleSelect = {
  id: true, labId: true, day: true, startTime: true, endTime: true, specificDate: true,
  isActive: true, status: true, type: true,
} satisfies Prisma.ScheduleSelect;

type OfferingWithSchedule = {
  id: string; termId: string; classId: string; dosenId: string; isActive: boolean;
  schedule: Prisma.ScheduleGetPayload<{ select: typeof occurrenceScheduleSelect }> | null;
};

function durationMinutes(start: string, end: string): number {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return endHour * 60 + endMinute - startHour * 60 - startMinute;
}

function scheduleMatchesOccurrence(schedule: NonNullable<OfferingWithSchedule["schedule"]>, date: Date): boolean {
  return schedule.specificDate
    ? canonicalDateOnly(schedule.specificDate).getTime() === date.getTime()
    : schedule.day === weekdayForDateOnly(date);
}

async function persistedActor(tx: Prisma.TransactionClient, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
  return user;
}

async function assertOfferingAuthority(tx: Prisma.TransactionClient, actor: Actor, offering: OfferingWithSchedule, allowCoordinator = false): Promise<void> {
  const user = await persistedActor(tx, actor);
  if (allowCoordinator && user.role === "KOORDINATOR_LAB") return;
  if (user.role === "DOSEN" && offering.dosenId === user.id) return;
  if (user.role !== "MAHASISWA") throw new AcademicAuthorizationError("Anda tidak memiliki otoritas pertukaran pertemuan");
  const [leader, pj] = await Promise.all([
    tx.academicClassLeader.findFirst({ where: { termId: offering.termId, classId: offering.classId, isActive: true, membership: { userId: user.id, isActive: true, user: { role: "MAHASISWA", isActive: true } } } }),
    tx.academicOfferingPJ.findFirst({ where: { offeringId: offering.id, isActive: true, membership: { userId: user.id, isActive: true, user: { role: "MAHASISWA", isActive: true } } } }),
  ]);
  if (!leader && !pj) throw new AcademicAuthorizationError("PJ atau Ketua Kelas aktif diperlukan");
}

function assertEligiblePair(source: OfferingWithSchedule, target: OfferingWithSchedule, date: Date): [NonNullable<OfferingWithSchedule["schedule"]>, NonNullable<OfferingWithSchedule["schedule"]>] {
  if (!source.isActive || !target.isActive || source.id === target.id || source.classId === target.classId) {
    throw new AcademicConflictError("Pertukaran harus melibatkan dua penawaran aktif dari kelas berbeda");
  }
  const sourceSchedule = source.schedule;
  const targetSchedule = target.schedule;
  if (!sourceSchedule || !targetSchedule || sourceSchedule.type !== "PRAKTIKUM" || targetSchedule.type !== "PRAKTIKUM" || sourceSchedule.status !== "SCHEDULED" || targetSchedule.status !== "SCHEDULED" || !sourceSchedule.isActive || !targetSchedule.isActive) {
    throw new AcademicConflictError("Kedua penawaran harus terikat ke jadwal PRAKTIKUM resmi yang aktif");
  }
  if (!scheduleMatchesOccurrence(sourceSchedule, date) || !scheduleMatchesOccurrence(targetSchedule, date)) {
    throw new AcademicConflictError("Tanggal tidak cocok dengan kedua pertemuan resmi");
  }
  if (sourceSchedule.labId !== targetSchedule.labId) throw new AcademicConflictError("Pertukaran hanya dapat dilakukan pada lab yang sama");
  if (durationMinutes(sourceSchedule.startTime, sourceSchedule.endTime) !== durationMinutes(targetSchedule.startTime, targetSchedule.endTime)) {
    throw new AcademicConflictError("Durasi kedua pertemuan harus sama");
  }
  return [sourceSchedule, targetSchedule];
}

async function assertNoUseOrBooking(tx: Prisma.TransactionClient, scheduleId: string, labId: string, date: Date, startTime: string, endTime: string): Promise<void> {
  const [logbook, cycle, key, booking, release] = await Promise.all([
    tx.logbook.findFirst({ where: { scheduleId, occurrenceDate: date, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    tx.keyBorrowCycle.findFirst({ where: { occurrenceDate: date, status: "ACTIVE", key: { labId } } }),
    tx.key.findFirst({ where: { labId, status: "BORROWED" } }),
    tx.labBooking.findFirst({ where: { labId, date, status: { in: ["PENDING", "APPROVED"] }, startTime: { lt: endTime }, endTime: { gt: startTime } } }),
    tx.academicOccurrenceRelease.findFirst({ where: { scheduleId, occurrenceDate: date, status: { in: ["RELEASED", "ALLOCATED"] } } }),
  ]);
  if (logbook) throw new AcademicConflictError("Pertemuan tidak dapat ditukar karena logbook sudah aktif");
  if (cycle || key) throw new AcademicConflictError("Pertemuan tidak dapat ditukar karena kunci lab sedang digunakan");
  if (booking) throw new AcademicConflictError("Pertemuan tidak dapat ditukar karena booking lab aktif atau menunggu keputusan");
  if (release) throw new AcademicConflictError("Pertemuan tidak dapat ditukar karena sudah masuk alokasi slot akademik");
}

async function assertActualAvailability(tx: Prisma.TransactionClient, date: Date, labId: string, startTime: string, endTime: string, sourceScheduleId: string, targetScheduleId: string): Promise<void> {
  const day = weekdayForDateOnly(date);
  const [schedule, booking, swap] = await Promise.all([
    tx.schedule.findFirst({ where: { ...operationalScheduleWhere, labId, id: { notIn: [sourceScheduleId, targetScheduleId] }, startTime: { lt: endTime }, endTime: { gt: startTime }, OR: [{ specificDate: date }, { specificDate: null, day }] } }),
    tx.labBooking.findFirst({ where: { labId, date, status: "APPROVED", startTime: { lt: endTime }, endTime: { gt: startTime } } }),
    tx.academicOccurrenceSwap.findFirst({ where: { status: "APPROVED", occurrenceDate: date, OR: [{ sourceLabId: labId, sourceStartTime: { lt: endTime }, sourceEndTime: { gt: startTime } }, { targetLabId: labId, targetStartTime: { lt: endTime }, targetEndTime: { gt: startTime } }] } }),
  ]);
  if (schedule || booking || swap) throw new AcademicConflictError("Slot aktual bentrok dengan penggunaan lab lain");
}

function notificationRecipients(swap: { requestedById: string; sourceOffering: { dosenId: string; pjs: { membership: { userId: string } }[] }; targetOffering: { dosenId: string; pjs: { membership: { userId: string } }[] }; confirmations: { confirmedById: string }[] }): string[] {
  return [...new Set([
    swap.requestedById,
    swap.sourceOffering.dosenId,
    swap.targetOffering.dosenId,
    ...swap.sourceOffering.pjs.map((pj) => pj.membership.userId),
    ...swap.targetOffering.pjs.map((pj) => pj.membership.userId),
    ...swap.confirmations.map((confirmation) => confirmation.confirmedById),
  ])];
}

export class AcademicSwapService {
  static async list(actor: Actor) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, role: true, isActive: true } });
    if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
    const leaderScopes = user.role === "MAHASISWA"
      ? await prisma.academicClassLeader.findMany({ where: { isActive: true, membership: { userId: user.id, isActive: true } }, select: { termId: true, classId: true } })
      : [];
    const leaderOfferingScopes = leaderScopes.flatMap(({ termId, classId }) => [{ termId, classId }]);
    const where: Prisma.AcademicOccurrenceSwapWhereInput = user.role === "KOORDINATOR_LAB" ? {} : user.role === "DOSEN"
      ? { OR: [{ sourceOffering: { dosenId: actor.userId } }, { targetOffering: { dosenId: actor.userId } }] }
      : { OR: [
          { sourceOffering: { OR: [{ pjs: { some: { isActive: true, membership: { userId: actor.userId, isActive: true } } } }, ...leaderOfferingScopes] } },
          { targetOffering: { OR: [{ pjs: { some: { isActive: true, membership: { userId: actor.userId, isActive: true } } } }, ...leaderOfferingScopes] } },
        ] };
    return prisma.academicOccurrenceSwap.findMany({
      where,
      include: {
        sourceOffering: { include: { course: true, academicClass: true } },
        targetOffering: { include: { course: true, academicClass: true } },
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        confirmations: { include: { confirmedBy: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async request(input: CreateInput, actor: Actor) {
    const date = canonicalDateOnly(input.occurrenceDate);
    const clock = getJakartaClock();
    if (date.getTime() < clock.date.getTime()) throw new AcademicConflictError("Pertukaran hanya dapat diajukan untuk tanggal mendatang");
    return withSerializableRetry(async (tx) => {
      const [source, target] = await Promise.all([
        tx.academicOffering.findUnique({ where: { id: input.sourceOfferingId }, include: { schedule: { select: occurrenceScheduleSelect } } }),
        tx.academicOffering.findUnique({ where: { id: input.targetOfferingId }, include: { schedule: { select: occurrenceScheduleSelect } } }),
      ]);
      if (!source || !target) throw new AcademicConflictError("Penawaran akademik tidak ditemukan");
      await assertOfferingAuthority(tx, actor, source);
      const [sourceSchedule, targetSchedule] = assertEligiblePair(source, target, date);
      if (date.getTime() === clock.date.getTime() && (sourceSchedule.startTime <= clock.time || targetSchedule.startTime <= clock.time)) {
        throw new AcademicConflictError("Pertukaran tidak dapat diajukan setelah pertemuan dimulai");
      }
      await Promise.all([
        assertNoUseOrBooking(tx, sourceSchedule.id, sourceSchedule.labId, date, sourceSchedule.startTime, sourceSchedule.endTime),
        assertNoUseOrBooking(tx, targetSchedule.id, targetSchedule.labId, date, targetSchedule.startTime, targetSchedule.endTime),
      ]);
      const swap = await tx.academicOccurrenceSwap.create({ data: {
        sourceOfferingId: source.id, targetOfferingId: target.id, sourceScheduleId: sourceSchedule.id, targetScheduleId: targetSchedule.id,
        occurrenceDate: date, sourceLabId: sourceSchedule.labId, targetLabId: targetSchedule.labId,
        sourceStartTime: sourceSchedule.startTime, sourceEndTime: sourceSchedule.endTime, targetStartTime: targetSchedule.startTime, targetEndTime: targetSchedule.endTime,
        reason: input.reason?.trim() || null, requestedById: actor.userId,
        confirmations: { create: { offeringId: source.id, confirmedById: actor.userId } },
        reservations: { create: [{ scheduleId: sourceSchedule.id, occurrenceDate: date }, { scheduleId: targetSchedule.id, occurrenceDate: date }] },
      }, include: { confirmations: true } });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "ACADEMIC_SWAP_REQUESTED", targetType: "AcademicOccurrenceSwap", targetId: swap.id, description: `${source.id}:${target.id}:${date.toISOString().slice(0, 10)}`, ipAddress: actor.ipAddress } });
      return swap;
    });
  }

  static async confirm(id: string, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const swap = await tx.academicOccurrenceSwap.findUnique({ where: { id }, include: { sourceOffering: { include: { schedule: { select: occurrenceScheduleSelect } } }, targetOffering: { include: { schedule: { select: occurrenceScheduleSelect } } }, confirmations: true } });
      if (!swap || swap.status !== "PENDING_CONFIRMATION") throw new AcademicConflictError("Pertukaran tidak dapat dikonfirmasi");
      const candidates = [swap.sourceOffering, swap.targetOffering];
      let offering: OfferingWithSchedule | undefined;
      for (const candidate of candidates) {
        try { await assertOfferingAuthority(tx, actor, candidate); offering = candidate; break; } catch (error) { if (!(error instanceof AcademicAuthorizationError)) throw error; }
      }
      if (!offering) throw new AcademicAuthorizationError("Anda bukan perwakilan legal untuk kedua kelas ini");
      const existing = swap.confirmations.find((item) => item.offeringId === offering.id);
      if (existing) {
        if (existing.confirmedById === actor.userId) return swap;
        throw new AcademicConflictError("Kelas ini sudah memiliki konfirmasi legal");
      }
      const confirmation = await tx.academicOccurrenceSwapConfirmation.create({ data: { swapId: swap.id, offeringId: offering.id, confirmedById: actor.userId } });
      const confirmationCount = swap.confirmations.length + 1;
      const status = confirmationCount === 2 ? "PENDING_APPROVAL" : "PENDING_CONFIRMATION";
      const updated = await tx.academicOccurrenceSwap.update({ where: { id: swap.id }, data: { status, reservations: { updateMany: { where: {}, data: { status } } } }, include: { confirmations: true } });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "ACADEMIC_SWAP_CONFIRMED", targetType: "AcademicOccurrenceSwap", targetId: swap.id, description: confirmation.id, ipAddress: actor.ipAddress } });
      return updated;
    });
  }

  static async cancel(id: string, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const user = await persistedActor(tx, actor);
      const swap = await tx.academicOccurrenceSwap.findUnique({ where: { id } });
      if (!swap || !["PENDING_CONFIRMATION", "PENDING_APPROVAL"].includes(swap.status)) {
        throw new AcademicConflictError("Pertukaran tidak dapat dibatalkan");
      }
      if (swap.requestedById !== user.id && user.role !== "KOORDINATOR_LAB") {
        throw new AcademicAuthorizationError("Hanya pengaju atau Koordinator Lab yang dapat membatalkan pertukaran");
      }
      const updated = await tx.academicOccurrenceSwap.update({
        where: { id },
        data: { status: "CANCELLED", reservations: { updateMany: { where: {}, data: { status: "CANCELLED" } } } },
      });
      await tx.auditLog.create({ data: { userId: user.id, action: "ACADEMIC_SWAP_CANCELLED", targetType: "AcademicOccurrenceSwap", targetId: id, description: swap.occurrenceDate.toISOString().slice(0, 10), ipAddress: actor.ipAddress } });
      return updated;
    });
  }

  static async review(id: string, input: ReviewInput, actor: Actor) {
    const result = await withSerializableRetry(async (tx) => {
      const user = await persistedActor(tx, actor);
      if (user.role !== "KOORDINATOR_LAB") throw new AcademicAuthorizationError("Hanya Koordinator Lab yang dapat meninjau pertukaran");
      const swap = await tx.academicOccurrenceSwap.findUnique({ where: { id }, include: {
        sourceOffering: { include: { schedule: { select: occurrenceScheduleSelect }, pjs: { where: { isActive: true }, include: { membership: { select: { userId: true } } } } } },
        targetOffering: { include: { schedule: { select: occurrenceScheduleSelect }, pjs: { where: { isActive: true }, include: { membership: { select: { userId: true } } } } } },
        confirmations: true,
      } });
      if (!swap || swap.status !== "PENDING_APPROVAL") throw new AcademicConflictError("Pertukaran tidak dapat ditinjau");
      if (!input.approved) {
        return tx.academicOccurrenceSwap.update({
          where: { id },
          data: {
            status: "REJECTED",
            reviewedById: actor.userId,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason?.trim() || "Ditolak koordinator",
            reservations: { updateMany: { where: {}, data: { status: "REJECTED" } } },
          },
          include: {
            sourceOffering: { include: { pjs: { include: { membership: { select: { userId: true } } } } } },
            targetOffering: { include: { pjs: { include: { membership: { select: { userId: true } } } } } },
            confirmations: true,
          },
        });
      }
      if (swap.confirmations.length !== 2) throw new AcademicConflictError("Konfirmasi dari kedua kelas diperlukan");
      const [sourceSchedule, targetSchedule] = assertEligiblePair(swap.sourceOffering, swap.targetOffering, swap.occurrenceDate);
      await Promise.all([
        assertNoUseOrBooking(tx, sourceSchedule.id, sourceSchedule.labId, swap.occurrenceDate, sourceSchedule.startTime, sourceSchedule.endTime),
        assertNoUseOrBooking(tx, targetSchedule.id, targetSchedule.labId, swap.occurrenceDate, targetSchedule.startTime, targetSchedule.endTime),
        assertActualAvailability(tx, swap.occurrenceDate, sourceSchedule.labId, targetSchedule.startTime, targetSchedule.endTime, sourceSchedule.id, targetSchedule.id),
        assertActualAvailability(tx, swap.occurrenceDate, targetSchedule.labId, sourceSchedule.startTime, sourceSchedule.endTime, sourceSchedule.id, targetSchedule.id),
      ]);
      const updated = await tx.academicOccurrenceSwap.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          rejectionReason: null,
          reservations: { updateMany: { where: {}, data: { status: "APPROVED" } } },
        },
        include: {
          sourceOffering: { include: { pjs: { include: { membership: { select: { userId: true } } } } } },
          targetOffering: { include: { pjs: { include: { membership: { select: { userId: true } } } } } },
          confirmations: true,
        },
      });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "ACADEMIC_SWAP_APPROVED", targetType: "AcademicOccurrenceSwap", targetId: id, description: swap.occurrenceDate.toISOString().slice(0, 10), ipAddress: actor.ipAddress } });
      return updated;
    });
    const event = input.approved ? "approved" : "rejected";
    for (const userId of notificationRecipients(result)) {
      void notificationService.create({ userId, type: "SYSTEM", title: input.approved ? "Pertukaran praktikum disetujui" : "Pertukaran praktikum ditolak", message: input.approved ? "Jadwal aktual pertemuan telah diperbarui." : "Pengajuan pertukaran pertemuan ditolak.", reminderKey: `academic-swap:${result.id}:${event}:${userId}`, metadata: { academicOccurrenceSwapId: result.id } }).catch(() => undefined);
    }
    return result;
  }

  static async listActualSchedules(dateInput: Date, actor: Actor) {
    const date = canonicalDateOnly(dateInput);
    const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, role: true, isActive: true } });
    if (!user?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
    const memberScopes = user.role === "MAHASISWA"
      ? await prisma.academicClassMembership.findMany({ where: { userId: user.id, isActive: true }, select: { termId: true, classId: true } })
      : [];
    const where: Prisma.AcademicOfferingWhereInput = user.role === "KOORDINATOR_LAB" ? { isActive: true } : user.role === "DOSEN" ? { isActive: true, dosenId: user.id } : user.role === "MAHASISWA" ? { isActive: true, OR: [{ pjs: { some: { isActive: true, membership: { userId: user.id, isActive: true } } } }, ...memberScopes.map(({ termId, classId }) => ({ termId, classId }))] } : { id: { in: [] } };
    const offerings = await prisma.academicOffering.findMany({ where, include: { course: true, academicClass: true, schedule: { select: occurrenceScheduleSelect } } });
    const occurrences = await resolveActualOccurrences(prisma as unknown as Prisma.TransactionClient, date);
    const byOfferingId = new Map(offerings.map((offering) => [offering.id, offering]));
    return occurrences.flatMap((actual) => {
      const offering = actual.academicOffering ? byOfferingId.get(actual.academicOffering.id) : undefined;
      if (!offering) return [];
      return [{ offeringId: offering.id, course: offering.course, academicClass: offering.academicClass, scheduleId: actual.schedule.id, occurrenceDate: actual.occurrenceDate, labId: actual.labId, startTime: actual.startTime, endTime: actual.endTime, swapId: actual.swapId }];
    }).sort((left, right) => left.startTime.localeCompare(right.startTime));
  }
}
