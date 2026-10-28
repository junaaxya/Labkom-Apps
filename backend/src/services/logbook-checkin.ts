import { Prisma } from "@prisma/client";
import type { CheckinLogbookInput } from "../validators/logbook.validator";
import { getJakartaClock } from "./jakarta-time";
import { LOGBOOK_INCLUDE } from "./logbook-include";
import { withSerializableRetry } from "./schedule-availability";
import { resolveActualOccurrence } from "./actual-occurrence.service";

class LogbookCheckinError extends Error {}

export async function checkinLogbook(userId: string, input: CheckinLogbookInput, now = new Date()) {
  const clock = getJakartaClock(now);
  if (input.occurrenceDate !== clock.date.toISOString().slice(0, 10)) {
    throw new LogbookCheckinError("Tanggal pertemuan harus sesuai tanggal hari ini di Jakarta.");
  }

  try {
    return await withSerializableRetry(async (tx) => {
      const existing = await tx.logbook.findFirst({ where: { officialCheckinById: userId, date: clock.date } });
      if (existing) throw new LogbookCheckinError("Anda sudah check-in hari ini.");

      const occurrence = await resolveActualOccurrence(tx, input.scheduleId, clock.date);
      if (!occurrence || occurrence.labId !== input.labId) {
        throw new LogbookCheckinError("Jadwal tidak ditemukan untuk lab ini.");
      }
      const schedule = occurrence.schedule;
      if (schedule.type !== "PRAKTIKUM") {
        throw new LogbookCheckinError("Jadwal praktikum aktif diperlukan untuk check-in.");
      }
      if (!schedule.academicOffering?.isActive) {
        throw new LogbookCheckinError("Jadwal harus terhubung dengan penawaran akademik aktif; sesi ad hoc tidak didukung.");
      }

      return tx.logbook.create({
        data: {
          date: clock.date,
          labId: input.labId,
          scheduleId: schedule.id,
          academicOfferingId: schedule.academicOffering.id,
          occurrenceDate: clock.date,
          officialCheckinById: userId,
          officialCheckinAt: now,
          status: "CHECKED_IN",
        },
        include: LOGBOOK_INCLUDE,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.length === 2 && target.includes("officialCheckinById") && target.includes("date")) {
        throw new LogbookCheckinError("Anda sudah check-in hari ini.");
      }
    }
    throw error;
  }
}
