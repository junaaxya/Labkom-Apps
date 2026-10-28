import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { canonicalDateOnly, weekdayForDateOnly } from "./jakarta-time";
import { findOccupancyConflict, withSerializableRetry } from "./schedule-availability";
import { notificationService } from "./notification.service";
import { notifyAcademicOffering } from "./academic-notification.service";
import { AcademicAuthorizationError, AcademicConflictError } from "./academic.service";

type Actor = { userId: string; role: string; ipAddress?: string };

async function getActiveActor(tx: Prisma.TransactionClient, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { id: true, role: true, isActive: true } });
  if (!user || !user.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");
  return user;
}

async function mayManageOffering(tx: Prisma.TransactionClient, actor: Actor, offering: { id: string; termId: string; classId: string; dosenId: string }) {
  const persistedActor = await getActiveActor(tx, actor);
  if (persistedActor.role === "KOORDINATOR_LAB") return;
  if (persistedActor.role === "DOSEN" && offering.dosenId === persistedActor.id) return;
  if (persistedActor.role !== "MAHASISWA") throw new AcademicAuthorizationError("Anda tidak memiliki otoritas akademik");
  const [leader, pj] = await Promise.all([
    tx.academicClassLeader.findFirst({ where: { termId: offering.termId, classId: offering.classId, isActive: true, membership: { userId: persistedActor.id, isActive: true, user: { role: "MAHASISWA", isActive: true } } } }),
    tx.academicOfferingPJ.findFirst({ where: { offeringId: offering.id, isActive: true, membership: { userId: persistedActor.id, isActive: true, user: { role: "MAHASISWA", isActive: true } } } }),
  ]);
  if (!leader && !pj) throw new AcademicAuthorizationError("Ketua kelas atau PJ aktif diperlukan");
}

async function assertNoActiveUse(tx: Prisma.TransactionClient, scheduleId: string, labId: string, date: Date) {
  const [logbook, cycle, borrowedKey] = await Promise.all([
    tx.logbook.findFirst({ where: { scheduleId, occurrenceDate: date, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    tx.keyBorrowCycle.findFirst({ where: { occurrenceDate: date, status: "ACTIVE", key: { labId } } }),
    tx.key.findFirst({ where: { labId, status: "BORROWED" } }),
  ]);
  if (logbook) throw new AcademicConflictError("Slot tidak dapat dilepas karena lab masih digunakan");
  if (cycle || borrowedKey) throw new AcademicConflictError("Slot tidak dapat dilepas karena kunci lab masih dipinjam");
}

export class AcademicOccurrenceService {
  static async listReleases(actor: Actor) {
    const persistedActor = await prisma.user.findUnique({ where: { id: actor.userId }, select: { role: true, isActive: true } });
    if (!persistedActor?.isActive) throw new AcademicAuthorizationError("Akun aktif diperlukan");

    const leaderScopes = persistedActor.role === "MAHASISWA"
      ? await prisma.academicClassLeader.findMany({
          where: { isActive: true, membership: { userId: actor.userId, isActive: true } },
          select: { termId: true, classId: true },
        })
      : [];
    const where: Prisma.AcademicOccurrenceReleaseWhereInput = persistedActor.role === "KOORDINATOR_LAB"
      ? {}
      : persistedActor.role === "DOSEN"
        ? { offering: { dosenId: actor.userId } }
        : persistedActor.role === "MAHASISWA"
          ? {
              offering: {
                OR: [
                  { pjs: { some: { isActive: true, membership: { userId: actor.userId, isActive: true } } } },
                  ...leaderScopes.map(({ termId, classId }) => ({ termId, classId })),
                ],
              },
            }
          : { id: { in: [] } };
    return prisma.academicOccurrenceRelease.findMany({
      where,
      include: {
        offering: { include: { course: true, academicClass: true } },
        requests: { include: { targetOffering: { include: { course: true, academicClass: true } }, requestedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ occurrenceDate: "desc" }, { createdAt: "desc" }],
    });
  }

  static async listRequests(actor: Actor) {
    const where = actor.role === "KOORDINATOR_LAB"
      ? {}
      : { requestedById: actor.userId };
    return prisma.academicSlotRequest.findMany({
      where,
      include: {
        release: { include: { offering: { include: { course: true, academicClass: true } } } },
        targetOffering: { include: { course: true, academicClass: true } },
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async release(reportId: string, actor: Actor) {
    const release = await withSerializableRetry(async (tx) => {
      const report = await tx.academicReport.findUnique({ where: { id: reportId }, include: { offering: { include: { schedule: true } } } });
      if (!report) throw new AcademicConflictError("Laporan akademik tidak ditemukan");
      if (report.status !== "ONLINE" && report.status !== "TIDAK_MASUK") throw new AcademicConflictError("Hanya laporan ONLINE atau TIDAK_MASUK yang dapat melepas slot");
      const offering = report.offering;
      await mayManageOffering(tx, actor, offering);
      const schedule = offering.schedule;
      const date = canonicalDateOnly(report.reportDate);
      if (!schedule || !schedule.isActive || schedule.status !== "SCHEDULED" || schedule.type !== "PRAKTIKUM" || schedule.labId === "" || (schedule.specificDate ? schedule.specificDate.getTime() !== date.getTime() : schedule.day !== weekdayForDateOnly(date))) {
        throw new AcademicConflictError("Laporan tidak cocok dengan pertemuan praktikum resmi pada tanggal ini");
      }
      await assertNoActiveUse(tx, schedule.id, schedule.labId, date);
      const booking = await tx.labBooking.findFirst({ where: { labId: schedule.labId, date, status: "APPROVED", startTime: { lt: schedule.endTime }, endTime: { gt: schedule.startTime } } });
      if (booking) throw new AcademicConflictError("Slot tidak dapat dilepas karena sudah memiliki booking aktif");
      const existing = await tx.academicOccurrenceRelease.findUnique({ where: { scheduleId_occurrenceDate: { scheduleId: schedule.id, occurrenceDate: date } } });
      if (existing) {
        if (existing.reportId === report.id) return existing;
        throw new AcademicConflictError("Pertemuan ini sudah memiliki pelepasan slot");
      }
      const release = await tx.academicOccurrenceRelease.create({ data: { offeringId: offering.id, scheduleId: schedule.id, reportId: report.id, labId: schedule.labId, occurrenceDate: date, startTime: schedule.startTime, endTime: schedule.endTime, releasedById: actor.userId } });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "ACADEMIC_OCCURRENCE_RELEASED", targetType: "AcademicOccurrenceRelease", targetId: release.id, description: `${schedule.id}:${date.toISOString().slice(0, 10)}`, ipAddress: actor.ipAddress } });
      return release;
    });
    void notifyAcademicOffering({
      offeringId: release.offeringId,
      actorId: actor.userId,
      event: "release",
      eventId: release.id,
      title: "Slot pertemuan akademik dirilis",
      message: "Slot praktikum dirilis setelah status ONLINE atau TIDAK_MASUK.",
      metadata: { academicOccurrenceReleaseId: release.id, occurrenceDate: release.occurrenceDate.toISOString() },
    }).catch(() => undefined);
    return release;
  }

  static async requestSlot(input: { releaseId: string; targetOfferingId: string; reason?: string | null }, actor: Actor) {
    return withSerializableRetry(async (tx) => {
      const [release, target] = await Promise.all([
        tx.academicOccurrenceRelease.findUnique({ where: { id: input.releaseId } }),
        tx.academicOffering.findUnique({ where: { id: input.targetOfferingId } }),
      ]);
      if (!release || release.status !== "RELEASED") throw new AcademicConflictError("Slot rilis tidak tersedia");
      if (!target || !target.isActive) throw new AcademicConflictError("Penawaran target tidak aktif");
      if (target.id === release.offeringId) throw new AcademicConflictError("Penawaran asal tidak dapat mengajukan slot rilisnya sendiri");
      await mayManageOffering(tx, actor, target);
      await assertNoActiveUse(tx, release.scheduleId, release.labId, release.occurrenceDate);
      const existing = await tx.academicSlotRequest.findFirst({ where: { releaseId: release.id, status: { in: ["PENDING", "APPROVED"] } } });
      if (existing) throw new AcademicConflictError("Slot sudah memiliki pengajuan aktif");
      const request = await tx.academicSlotRequest.create({ data: { releaseId: release.id, targetOfferingId: target.id, requestedById: actor.userId, reason: input.reason?.trim() || null } });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "ACADEMIC_SLOT_REQUESTED", targetType: "AcademicSlotRequest", targetId: request.id, description: release.id, ipAddress: actor.ipAddress } });
      return request;
    });
  }

  static async reviewRequest(id: string, input: { approved: boolean; rejectionReason?: string | null }, actor: Actor) {
    const result = await withSerializableRetry(async (tx) => {
      const persistedActor = await getActiveActor(tx, actor);
      if (persistedActor.role !== "KOORDINATOR_LAB") throw new AcademicAuthorizationError("Hanya Koordinator Lab yang dapat meninjau pengajuan slot");
      const request = await tx.academicSlotRequest.findUnique({ where: { id }, include: { release: { include: { report: true, schedule: true } }, targetOffering: { include: { course: true, academicClass: true } } } });
      if (!request || request.status !== "PENDING") throw new AcademicConflictError("Pengajuan slot tidak dapat ditinjau");
      if (!input.approved) {
        return tx.academicSlotRequest.update({ where: { id }, data: { status: "REJECTED", reviewedById: actor.userId, reviewedAt: new Date(), rejectionReason: input.rejectionReason?.trim() || "Ditolak koordinator" } });
      }
      const release = await tx.academicOccurrenceRelease.findUnique({ where: { id: request.releaseId } });
      if (!release || release.status !== "RELEASED") throw new AcademicConflictError("Slot rilis sudah tidak tersedia");
      if (request.release.report.status !== "ONLINE" && request.release.report.status !== "TIDAK_MASUK") {
        throw new AcademicConflictError("Laporan sumber tidak lagi memenuhi syarat pelepasan slot");
      }
      const sourceSchedule = request.release.schedule;
      if (!sourceSchedule.isActive || sourceSchedule.status !== "SCHEDULED" || sourceSchedule.type !== "PRAKTIKUM" || sourceSchedule.labId !== release.labId || sourceSchedule.startTime !== release.startTime || sourceSchedule.endTime !== release.endTime) {
        throw new AcademicConflictError("Snapshot slot rilis tidak lagi cocok dengan jadwal resmi");
      }
      await assertNoActiveUse(tx, release.scheduleId, release.labId, release.occurrenceDate);
      const day = weekdayForDateOnly(release.occurrenceDate);
      const conflict = await findOccupancyConflict(tx, { labId: release.labId, day, startTime: release.startTime, endTime: release.endTime, specificDate: release.occurrenceDate }, { excludeScheduleId: release.scheduleId });
      if (conflict) throw new AcademicConflictError("Slot sudah bentrok dengan penggunaan lab lain");
      const pendingBooking = await tx.labBooking.findFirst({
        where: {
          labId: release.labId,
          date: release.occurrenceDate,
          status: "PENDING",
          startTime: { lt: release.endTime },
          endTime: { gt: release.startTime },
        },
      });
      if (pendingBooking) throw new AcademicConflictError("Slot masih memiliki pengajuan booking yang belum diputuskan");
      const booking = await tx.labBooking.create({ data: { labId: release.labId, requestedBy: request.requestedById, approvedBy: actor.userId, title: `Akademik: ${request.targetOffering.course.code} ${request.targetOffering.academicClass.code}`, purpose: "Penggunaan slot akademik yang dirilis", date: release.occurrenceDate, startTime: release.startTime, endTime: release.endTime, participants: 1, status: "APPROVED", notes: request.reason } });
      await tx.schedule.create({ data: { labId: release.labId, title: booking.title, specificDate: release.occurrenceDate, day, startTime: release.startTime, endTime: release.endTime, type: "PEMINJAMAN", status: "SCHEDULED", isActive: true, className: `AcademicSlot:${request.targetOfferingId}`, assistantId: actor.userId } });
      await tx.academicOccurrenceRelease.update({ where: { id: release.id }, data: { status: "ALLOCATED" } });
      const approved = await tx.academicSlotRequest.update({ where: { id }, data: { status: "APPROVED", reviewedById: actor.userId, reviewedAt: new Date(), rejectionReason: null, bookingId: booking.id } });
      await tx.auditLog.create({ data: { userId: actor.userId, action: "ACADEMIC_SLOT_APPROVED", targetType: "AcademicSlotRequest", targetId: id, description: booking.id, ipAddress: actor.ipAddress } });
      return approved;
    });
    void notificationService.create({ userId: result.requestedById, type: "SYSTEM", title: input.approved ? "Pengajuan slot disetujui" : "Pengajuan slot ditolak", message: input.approved ? "Slot lab akademik telah dialokasikan." : "Pengajuan slot lab akademik ditolak.", metadata: { academicSlotRequestId: result.id }, reminderKey: `academic:allocation:${result.id}:${result.requestedById}` }).catch(() => undefined);
    return result;
  }
}
