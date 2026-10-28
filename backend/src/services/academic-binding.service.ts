import { AcademicAuthorizationError, AcademicConflictError } from "./academic.service";
import { withSerializableRetry } from "./schedule-availability";

type Actor = { readonly userId: string; readonly role: string; readonly ipAddress?: string };

export class AcademicBindingService {
  static async bindSchedule(offeringId: string, scheduleId: string, actor: Actor) {
    if (actor.role !== "KOORDINATOR_LAB") {
      throw new AcademicAuthorizationError("Hanya Koordinator Lab yang dapat menghubungkan jadwal");
    }

    return withSerializableRetry(async (tx) => {
      const [offering, schedule] = await Promise.all([
        tx.academicOffering.findUnique({ where: { id: offeringId } }),
        tx.schedule.findUnique({ where: { id: scheduleId } }),
      ]);
      if (!offering) throw new AcademicConflictError("Penawaran akademik tidak ditemukan");
      if (!schedule || !schedule.isActive || schedule.type !== "PRAKTIKUM" || schedule.status !== "SCHEDULED") {
        throw new AcademicConflictError("Jadwal praktikum aktif berstatus SCHEDULED diperlukan");
      }
      if (!offering.isActive) throw new AcademicConflictError("Penawaran akademik tidak aktif");
      if (offering.scheduleId === scheduleId) return offering;
      if (offering.scheduleId) throw new AcademicConflictError("Penawaran sudah terhubung dengan jadwal lain");

      const bound = await tx.academicOffering.findUnique({ where: { scheduleId } });
      if (bound) throw new AcademicConflictError("Jadwal sudah terhubung dengan penawaran lain");
      const updated = await tx.academicOffering.update({ where: { id: offeringId }, data: { scheduleId } });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "ACADEMIC_SCHEDULE_BOUND",
          targetType: "AcademicOffering",
          targetId: offeringId,
          description: `Jadwal ${scheduleId}`,
          ipAddress: actor.ipAddress,
        },
      });
      return updated;
    });
  }
}
