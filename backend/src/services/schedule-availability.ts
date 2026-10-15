import { DayOfWeek, Prisma } from "@prisma/client";
import prisma from "../config/database";
import { weekdayForDateOnly } from "./jakarta-time";

export const OPERATIONAL_SCHEDULE_STATUSES = ["SCHEDULED", "ONGOING"] as const;
export const SERIALIZABLE_RETRY_LIMIT = 2;

export const operationalScheduleWhere = {
  isActive: true,
  status: { in: [...OPERATIONAL_SCHEDULE_STATUSES] },
} satisfies Prisma.ScheduleWhereInput;

export function isOperationalSchedule(status: string, isActive: boolean): boolean {
  return isActive && (status === "SCHEDULED" || status === "ONGOING");
}

export type OccupancyCandidate = {
  readonly labId: string;
  readonly day: DayOfWeek;
  readonly startTime: string;
  readonly endTime: string;
  readonly specificDate: Date | null;
};

export type OccupancyConflict =
  | { readonly kind: "SCHEDULE"; readonly title: string; readonly startTime: string; readonly endTime: string }
  | { readonly kind: "BOOKING"; readonly startTime: string; readonly endTime: string };

export function operationalScheduleOverlapWhere(
  candidate: OccupancyCandidate,
  excludeScheduleId?: string
): Prisma.ScheduleWhereInput {
  return {
    ...operationalScheduleWhere,
    startTime: { lt: candidate.endTime },
    endTime: { gt: candidate.startTime },
    ...(candidate.specificDate
      ? {
          OR: [
            { specificDate: candidate.specificDate },
            { specificDate: null, day: candidate.day },
          ],
        }
      : { day: candidate.day }),
    ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
  };
}

export async function findOccupancyConflict(
  tx: Prisma.TransactionClient,
  candidate: OccupancyCandidate,
  options?: { readonly excludeScheduleId?: string; readonly excludeBookingId?: string }
): Promise<OccupancyConflict | undefined> {
  const scheduleWhere: Prisma.ScheduleWhereInput = {
    labId: candidate.labId,
    ...operationalScheduleOverlapWhere(candidate, options?.excludeScheduleId),
  };
  const bookingWhere: Prisma.LabBookingWhereInput = {
    labId: candidate.labId,
    status: "APPROVED",
    startTime: { lt: candidate.endTime },
    endTime: { gt: candidate.startTime },
    ...(options?.excludeBookingId ? { id: { not: options.excludeBookingId } } : {}),
  };

  if (candidate.specificDate) {
    const [schedule, booking] = await Promise.all([
      tx.schedule.findFirst({ where: scheduleWhere }),
      tx.labBooking.findFirst({ where: { ...bookingWhere, date: candidate.specificDate } }),
    ]);

    if (schedule) {
      return { kind: "SCHEDULE", title: schedule.title, startTime: schedule.startTime, endTime: schedule.endTime };
    }
    if (booking) {
      return { kind: "BOOKING", startTime: booking.startTime, endTime: booking.endTime };
    }
    return undefined;
  }

  const [schedule, bookings] = await Promise.all([
    tx.schedule.findFirst({ where: scheduleWhere }),
    tx.labBooking.findMany({ where: bookingWhere }),
  ]);

  if (schedule) {
    return { kind: "SCHEDULE", title: schedule.title, startTime: schedule.startTime, endTime: schedule.endTime };
  }

  const booking = bookings.find((item) => weekdayForDateOnly(item.date) === candidate.day);
  return booking ? { kind: "BOOKING", startTime: booking.startTime, endTime: booking.endTime } : undefined;
}

export async function withSerializableRetry<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let retriesRemaining = SERIALIZABLE_RETRY_LIMIT;

  while (true) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (retriesRemaining === 0 || !isSerializationFailure(error)) throw error;
      retriesRemaining -= 1;
    }
  }
}

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
