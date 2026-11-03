import type { Prisma } from "@prisma/client";

export const LOGBOOK_INCLUDE = {
  officialCheckinBy: { select: { id: true, name: true } },
  officialCheckoutBy: { select: { id: true, name: true } },
  conditions: {
    include: {
      lab: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, name: true } },
      verifiedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.LogbookInclude;
