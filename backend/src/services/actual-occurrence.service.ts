import type { Prisma } from "@prisma/client";
import { canonicalDateOnly, weekdayForDateOnly } from "./jakarta-time";
import { isOperationalSchedule, operationalScheduleWhere } from "./schedule-availability";

const scheduleSelect = {
  id: true,
  labId: true,
  title: true,
  lecturerName: true,
  className: true,
  semester: true,
  startTime: true,
  endTime: true,
  specificDate: true,
  day: true,
  type: true,
  status: true,
  isActive: true,
  academicOffering: {
    select: {
      id: true,
      termId: true,
      classId: true,
      isActive: true,
    },
  },
  lab: {
    select: {
      id: true,
      name: true,
      location: true,
    },
  },
  assistant: {
    select: {
      id: true,
      name: true,
    },
  },
  occurrenceReleases: {
    select: { id: true, status: true },
  },
} satisfies Prisma.ScheduleSelect;

export type ActualOccurrence = {
  schedule: Prisma.ScheduleGetPayload<{ select: typeof scheduleSelect }>;
  occurrenceDate: Date;
  labId: string;
  startTime: string;
  endTime: string;
  swapId: string | null;
};

function matchesDate(schedule: ActualOccurrence["schedule"], date: Date): boolean {
  return schedule.specificDate
    ? canonicalDateOnly(schedule.specificDate).getTime() === date.getTime()
    : schedule.day === weekdayForDateOnly(date);
}

/**
 * Projects a structured academic occurrence without mutating its official Schedule.
 * Legacy schedules remain their stored occurrence because they have no academic binding.
 */
export async function resolveActualOccurrences(
  tx: Prisma.TransactionClient,
  dateInput: Date,
  options?: { scheduleId?: string; labId?: string }
): Promise<ActualOccurrence[]> {
  const date = canonicalDateOnly(dateInput);
  const schedules = await tx.schedule.findMany({
    where: {
      ...operationalScheduleWhere,
      ...(options?.scheduleId ? { id: options.scheduleId } : {}),
      OR: [{ specificDate: date }, { specificDate: null, day: weekdayForDateOnly(date) }],
    },
    select: {
      ...scheduleSelect,
      occurrenceReleases: {
        where: { occurrenceDate: date },
        select: { id: true, status: true },
      },
    },
  });
  const structuredScheduleIds = schedules
    .filter((schedule) => Boolean(schedule.academicOffering))
    .map((schedule) => schedule.id);
  const swapDelegate = (tx as unknown as { academicOccurrenceSwap?: typeof tx.academicOccurrenceSwap }).academicOccurrenceSwap;
  const swaps = structuredScheduleIds.length === 0 || !swapDelegate
    ? []
    : await swapDelegate.findMany({
        where: {
          status: "APPROVED",
          occurrenceDate: date,
          OR: [{ sourceScheduleId: { in: structuredScheduleIds } }, { targetScheduleId: { in: structuredScheduleIds } }],
        },
        select: {
          id: true,
          sourceScheduleId: true,
          targetScheduleId: true,
          sourceLabId: true,
          targetLabId: true,
          sourceStartTime: true,
          sourceEndTime: true,
          targetStartTime: true,
          targetEndTime: true,
        },
      });

  return schedules.flatMap((schedule) => {
    if (!isOperationalSchedule(schedule.status, schedule.isActive) || !matchesDate(schedule, date)) return [];
    const release = schedule.academicOffering
      ? (schedule.occurrenceReleases ?? []).find((item) => item.status === "RELEASED" || item.status === "ALLOCATED")
      : undefined;
    if (release) return [];

    const swap = swaps.find((item) => item.sourceScheduleId === schedule.id || item.targetScheduleId === schedule.id);
    const projected = swap?.sourceScheduleId === schedule.id
      ? { labId: swap.targetLabId, startTime: swap.targetStartTime, endTime: swap.targetEndTime, swapId: swap.id }
      : swap?.targetScheduleId === schedule.id
        ? { labId: swap.sourceLabId, startTime: swap.sourceStartTime, endTime: swap.sourceEndTime, swapId: swap.id }
        : { labId: schedule.labId, startTime: schedule.startTime, endTime: schedule.endTime, swapId: null };
    if (options?.labId && projected.labId !== options.labId) return [];
    return [{ schedule, occurrenceDate: date, ...projected }];
  });
}

export async function resolveActualOccurrence(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  date: Date
): Promise<ActualOccurrence | null> {
  const occurrences = await resolveActualOccurrences(tx, date, { scheduleId });
  return occurrences.length === 1 ? occurrences[0] : null;
}
