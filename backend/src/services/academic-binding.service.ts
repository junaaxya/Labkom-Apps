import { AcademicAuthorizationError, AcademicConflictError } from "./academic.service";
import { withSerializableRetry } from "./schedule-availability";

type Actor = { readonly userId: string; readonly role: string; readonly ipAddress?: string };

function normalized(value: string | null | undefined): string | null {
  const result = value?.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
  return result || null;
}

function matchesKnownValue(value: string | null, values: Array<string | null | undefined>): boolean {
  return Boolean(value && values.some((candidate) => normalized(candidate) === value));
}

export class AcademicBindingService {
  static async bindSchedule(
    offeringId: string,
    scheduleId: string,
    actor: Actor,
    confirmAmbiguousMetadata = false,
  ) {
    if (actor.role !== "KOORDINATOR_LAB") {
      throw new AcademicAuthorizationError("Hanya Koordinator Lab yang dapat menghubungkan jadwal");
    }

    return withSerializableRetry(async (tx) => {
      const [offering, schedule] = await Promise.all([
        tx.academicOffering.findUnique({
          where: { id: offeringId },
          include: {
            term: { select: { id: true, code: true, name: true } },
            academicClass: { select: { id: true, code: true, name: true } },
            dosen: { select: { id: true, name: true } },
          },
        }),
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

      const scheduleClass = normalized(schedule.className);
      const scheduleSemester = normalized(schedule.semester);
      const scheduleLecturer = normalized(schedule.lecturerName);
      const warnings: string[] = [];
      if (scheduleClass && !matchesKnownValue(scheduleClass, [offering.academicClass.code, offering.academicClass.name])) warnings.push("kelas");
      if (scheduleSemester && !matchesKnownValue(scheduleSemester, [offering.term.code, offering.term.name])) warnings.push("semester");
      if (scheduleLecturer && !matchesKnownValue(scheduleLecturer, [offering.dosen.name])) warnings.push("dosen");
      if (warnings.length > 0 && !confirmAmbiguousMetadata) {
        throw new AcademicConflictError(`Metadata legacy ${warnings.join(", ")} tidak dapat dipastikan. Konfirmasi eksplisit Koordinator diperlukan.`);
      }

      const updated = await tx.academicOffering.update({ where: { id: offeringId }, data: { scheduleId } });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "ACADEMIC_SCHEDULE_BOUND",
          targetType: "AcademicOffering",
          targetId: offeringId,
          description: `Jadwal ${scheduleId}${warnings.length > 0 ? `; metadata ambigu dikonfirmasi: ${warnings.join(", ")}` : ""}`,
          ipAddress: actor.ipAddress,
        },
      });
      return updated;
    });
  }
}
