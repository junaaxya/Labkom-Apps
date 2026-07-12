import { Prisma } from "@prisma/client";

export const OPERATIONAL_SCHEDULE_STATUSES = ["SCHEDULED", "ONGOING"] as const;

export const operationalScheduleWhere = {
  isActive: true,
  status: { in: [...OPERATIONAL_SCHEDULE_STATUSES] },
} satisfies Prisma.ScheduleWhereInput;
