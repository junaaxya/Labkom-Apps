import { Prisma } from "@prisma/client";
import type { CheckinLogbookInput } from "../validators/logbook.validator";
import { getJakartaClock } from "./jakarta-time";
import { LOGBOOK_INCLUDE } from "./logbook-include";
import { isOperationalSchedule, withSerializableRetry } from "./schedule-availability";

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

      const schedule = await tx.schedule.findUnique({
        where: { id: input.scheduleId },
        include: {
          academicOffering: { select: { id: true, isActive: true } },
          occurrenceReleases: {
            where: { occurrenceDate: clock.date, status: { in: ["RELEASED", "ALLOCATED"] } },
            select: { id: true },
          },
        },
      });
      if (!schedule || schedule.labId !== input.labId) {
        throw new LogbookCheckinError("Jadwal tidak ditemukan untuk lab ini.");
      }
      if (schedule.type !== "PRAKTIKUM" || !isOperationalSchedule(schedule.status, schedule.isActive)) {
        throw new LogbookCheckinError("Jadwal praktikum aktif diperlukan untuk check-in.");
      }
      if (schedule.specificDate ? schedule.specificDate.getTime() !== clock.date.getTime() : schedule.day !== clock.day) {
        throw new LogbookCheckinError("Jadwal tidak berlaku pada tanggal pertemuan ini.");
      }
      if (!schedule.academicOffering?.isActive) {
        throw new LogbookCheckinError("Jadwal harus terhubung dengan penawaran akademik aktif; sesi ad hoc tidak didukung.");
      }
      if (schedule.occurrenceReleases?.length) {
        throw new LogbookCheckinError("Pertemuan ini telah dilepas atau dialokasikan; check-in jadwal asal tidak diizinkan.");
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
