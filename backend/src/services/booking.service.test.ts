import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { ApprovalConflictError } from "./approval-conflict.error";
import { BookingService } from "./booking.service";

type BookingStub = {
  id: string;
  requestedBy: string;
};

function mockBookingFindUnique(result: BookingStub | null): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(prisma.labBooking, "findUnique");

  Object.defineProperty(prisma.labBooking, "findUnique", {
    configurable: true,
    value: async () => result,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(prisma.labBooking, "findUnique", descriptor);
    } else {
      Reflect.deleteProperty(prisma.labBooking, "findUnique");
    }
  };
}

type ApprovalBooking = {
  id: string;
  labId: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
};

type ApprovalTransaction = {
  labBooking: {
    findUnique: (args: { where: { id: string } }) => Promise<ApprovalBooking | null>;
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>;
    update: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  schedule: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ title: string; startTime: string; endTime: string } | null>;
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
};

type CreationSchedule = {
  labId: string;
  title: string;
  status: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
  specificDate: Date | null;
  day: string;
};

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, property, descriptor);
    } else {
      Reflect.deleteProperty(target, property);
    }
  };
}

function pendingApprovalBooking(status = "PENDING"): ApprovalBooking {
  return {
    id: "booking-1",
    labId: "lab-a",
    title: "Internal event",
    date: new Date("2026-10-13T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "10:00",
    status,
  };
}

function matchesCreationScheduleQuery(schedule: CreationSchedule, where: Record<string, any>): boolean {
  if (
    schedule.labId !== where.labId ||
    schedule.isActive !== where.isActive ||
    !where.status.in.includes(schedule.status) ||
    !(schedule.startTime < where.startTime.lt) ||
    !(schedule.endTime > where.endTime.gt)
  ) {
    return false;
  }

  return where.OR.some((candidate: { specificDate: Date | null; day?: string }) =>
    candidate.specificDate === null
      ? schedule.specificDate === null && schedule.day === candidate.day
      : schedule.specificDate?.getTime() === candidate.specificDate.getTime()
  );
}

test("booking detail service allows coordinator and owner", async () => {
  const restore = mockBookingFindUnique({ id: "booking-1", requestedBy: "owner-1" });

  try {
    for (const actor of [
      { userId: "coordinator-1", role: "KOORDINATOR_LAB" },
      { userId: "owner-1", role: "MAHASISWA" },
    ]) {
      const booking = await BookingService.getBookingById("booking-1", actor);
      assert.equal(booking.id, "booking-1");
    }
  } finally {
    restore();
  }
});

test("booking detail service denies non-owner assistant, mahasiswa, and magang", async () => {
  const restore = mockBookingFindUnique({ id: "booking-1", requestedBy: "owner-1" });

  try {
    for (const role of ["ASISTEN_LAB", "MAHASISWA", "MAGANG"]) {
      await assert.rejects(
        BookingService.getBookingById("booking-1", { userId: "other-user", role }),
        /Anda tidak memiliki akses ke data ini/,
      );
    }
  } finally {
    restore();
  }
});

test("booking detail service reports a missing booking before authorization", async () => {
  const restore = mockBookingFindUnique(null);

  try {
    await assert.rejects(
      BookingService.getBookingById("missing-booking", { userId: "coordinator-1", role: "KOORDINATOR_LAB" }),
      /Pengajuan peminjaman tidak ditemukan/,
    );
  } finally {
    restore();
  }
});

test("booking approval uses same-lab, approved-only, strict-boundary predicates and writes an internal booking schedule", async () => {
  let scheduleConflictWhere: Record<string, unknown> | undefined;
  let bookingConflictWhere: Record<string, unknown> | undefined;
  let bookingWrite: Record<string, unknown> | undefined;
  let scheduleWrite: Record<string, unknown> | undefined;
  const transactionOptions: unknown[] = [];
  const tx: ApprovalTransaction = {
    labBooking: {
      findUnique: async () => pendingApprovalBooking(),
      findFirst: async ({ where }) => {
        bookingConflictWhere = where;
        return null;
      },
      update: async ({ data }) => {
        bookingWrite = data;
        return { id: "booking-1", ...data };
      },
    },
    schedule: {
      findFirst: async ({ where }) => {
        scheduleConflictWhere = where;
        return null;
      },
      create: async ({ data }) => {
        scheduleWrite = data;
        return { id: "schedule-1", ...data };
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ApprovalTransaction) => Promise<unknown>, options: unknown) => {
      transactionOptions.push(options);
      return operation(tx);
    },
  );

  try {
    await BookingService.approveBooking("booking-1", "coordinator-1");

    assert.deepEqual(transactionOptions, [{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }]);
    assert.deepEqual(scheduleConflictWhere, {
      labId: "lab-a",
      isActive: true,
      status: { in: ["SCHEDULED", "ONGOING"] },
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      OR: [
        { specificDate: new Date("2026-10-13T00:00:00.000Z") },
        { specificDate: null, day: "SELASA" },
      ],
    });
    assert.deepEqual(bookingConflictWhere, {
      id: { not: "booking-1" },
      labId: "lab-a",
      date: new Date("2026-10-13T00:00:00.000Z"),
      status: "APPROVED",
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
    });
    assert.deepEqual(bookingWrite, {
      status: "APPROVED",
      approvedBy: "coordinator-1",
      rejectionReason: null,
    });
    assert.deepEqual(scheduleWrite, {
      labId: "lab-a",
      title: "Internal event",
      specificDate: new Date("2026-10-13T00:00:00.000Z"),
      day: "SELASA",
      startTime: "09:00",
      endTime: "10:00",
      type: "PEMINJAMAN",
      status: "SCHEDULED",
      isActive: true,
      className: "Booking:booking-1",
      assistantId: "coordinator-1",
    });
  } finally {
    restore();
  }
});

test("booking approval stops before booking and schedule writes when a class schedule overlaps", async () => {
  let bookingUpdates = 0;
  let scheduleCreates = 0;
  const tx: ApprovalTransaction = {
    labBooking: {
      findUnique: async () => pendingApprovalBooking(),
      findFirst: async () => null,
      update: async ({ data }) => {
        bookingUpdates += 1;
        return data;
      },
    },
    schedule: {
      findFirst: async () => ({ title: "Praktikum", startTime: "09:30", endTime: "10:30" }),
      create: async ({ data }) => {
        scheduleCreates += 1;
        return data;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ApprovalTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(BookingService.approveBooking("booking-1", "coordinator-1"), ApprovalConflictError);
    assert.equal(bookingUpdates, 0);
    assert.equal(scheduleCreates, 0);
  } finally {
    restore();
  }
});

test("booking approval stops before writes when an approved booking overlaps in the same lab", async () => {
  let bookingConflictWhere: Record<string, unknown> | undefined;
  let bookingUpdates = 0;
  let scheduleCreates = 0;
  const tx: ApprovalTransaction = {
    labBooking: {
      findUnique: async () => pendingApprovalBooking(),
      findFirst: async ({ where }) => {
        bookingConflictWhere = where;
        return { id: "booking-2" };
      },
      update: async ({ data }) => {
        bookingUpdates += 1;
        return data;
      },
    },
    schedule: {
      findFirst: async () => null,
      create: async ({ data }) => {
        scheduleCreates += 1;
        return data;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ApprovalTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(BookingService.approveBooking("booking-1", "coordinator-1"), ApprovalConflictError);
    assert.deepEqual(bookingConflictWhere, {
      id: { not: "booking-1" },
      labId: "lab-a",
      date: new Date("2026-10-13T00:00:00.000Z"),
      status: "APPROVED",
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
    });
    assert.equal(bookingUpdates, 0);
    assert.equal(scheduleCreates, 0);
  } finally {
    restore();
  }
});

test("booking approval keeps adjacent and different-lab approved bookings outside its conflict query", async () => {
  let bookingConflictWhere: Record<string, unknown> | undefined;
  let writes = 0;
  const tx: ApprovalTransaction = {
    labBooking: {
      findUnique: async () => pendingApprovalBooking(),
      findFirst: async ({ where }) => {
        bookingConflictWhere = where;
        return null;
      },
      update: async ({ data }) => {
        writes += 1;
        return data;
      },
    },
    schedule: {
      findFirst: async () => null,
      create: async ({ data }) => {
        writes += 1;
        return data;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ApprovalTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await BookingService.approveBooking("booking-1", "coordinator-1");
    assert.equal(bookingConflictWhere?.labId, "lab-a");
    assert.deepEqual(bookingConflictWhere?.startTime, { lt: "10:00" });
    assert.deepEqual(bookingConflictWhere?.endTime, { gt: "09:00" });
    assert.equal(writes, 2);
  } finally {
    restore();
  }
});

test("booking approval rejects a repeated non-PENDING approval without writes", async () => {
  let conflictChecks = 0;
  let writes = 0;
  const tx: ApprovalTransaction = {
    labBooking: {
      findUnique: async () => pendingApprovalBooking("APPROVED"),
      findFirst: async () => {
        conflictChecks += 1;
        return null;
      },
      update: async ({ data }) => {
        writes += 1;
        return data;
      },
    },
    schedule: {
      findFirst: async () => {
        conflictChecks += 1;
        return null;
      },
      create: async ({ data }) => {
        writes += 1;
        return data;
      },
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ApprovalTransaction) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(BookingService.approveBooking("booking-1", "coordinator-1"), /PENDING/);
    assert.equal(conflictChecks, 0);
    assert.equal(writes, 0);
  } finally {
    restore();
  }
});

test("booking approval retries P2034 twice before completing its transaction callback", async () => {
  let transactionAttempts = 0;
  const tx: ApprovalTransaction = {
    labBooking: {
      findUnique: async () => pendingApprovalBooking(),
      findFirst: async () => null,
      update: async ({ data }) => data,
    },
    schedule: {
      findFirst: async () => null,
      create: async ({ data }) => data,
    },
  };
  const restore = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: ApprovalTransaction) => Promise<unknown>, options: unknown) => {
      transactionAttempts += 1;
      assert.deepEqual(options, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (transactionAttempts < 3) {
        throw new Prisma.PrismaClientKnownRequestError("serialization failure", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      return operation(tx);
    },
  );

  try {
    await BookingService.approveBooking("booking-1", "coordinator-1");
    assert.equal(transactionAttempts, 3);
  } finally {
    restore();
  }
});

test("booking creation preserves a UTC date-only value and derives its weekday without host timezone", async () => {
  let scheduleConflictWhere: Record<string, unknown> | undefined;
  let bookingConflictWhere: Record<string, unknown> | undefined;
  let bookingWrite: Record<string, unknown> | undefined;
  const restores = [
    replaceProperty(prisma.user, "findUnique", async () => ({ role: "MAHASISWA", isKetuaKelas: false })),
    replaceProperty(prisma.lab, "findUnique", async () => ({ id: "lab-a" })),
    replaceProperty(prisma.schedule, "findFirst", async ({ where }: { where: Record<string, unknown> }) => {
      scheduleConflictWhere = where;
      return null;
    }),
    replaceProperty(prisma.labBooking, "findFirst", async ({ where }: { where: Record<string, unknown> }) => {
      bookingConflictWhere = where;
      return null;
    }),
    replaceProperty(prisma.labBooking, "create", async ({ data }: { data: Record<string, unknown> }) => {
      bookingWrite = data;
      return { id: "booking-1", ...data };
    }),
    replaceProperty(prisma, "$transaction", async (operation: (transaction: typeof prisma) => Promise<unknown>) => operation(prisma)),
  ];

  try {
    await BookingService.createBooking({
      labId: "lab-a",
      title: "UTC booking",
      purpose: "Pelatihan",
      date: new Date("2026-10-13T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      participants: 10,
    }, "student-1");

    const date = new Date("2026-10-13T00:00:00.000Z");
    assert.deepEqual(scheduleConflictWhere, {
      labId: "lab-a",
      isActive: true,
      status: { in: ["SCHEDULED", "ONGOING"] },
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      OR: [
        { specificDate: date },
        { specificDate: null, day: "SELASA" },
      ],
    });
    assert.equal((bookingConflictWhere?.date as Date).getTime(), date.getTime());
    assert.deepEqual(bookingConflictWhere?.status, { in: ["PENDING", "APPROVED"] });
    assert.equal((bookingWrite?.date as Date).getTime(), date.getTime());
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});

test("booking creation blocks only active operational same-lab strict schedule overlaps", async () => {
  const date = new Date("2026-10-13T00:00:00.000Z");
  let schedules: CreationSchedule[] = [];
  let bookingCreates = 0;
  const scheduleQueries: Record<string, any>[] = [];
  const restores = [
    replaceProperty(prisma.user, "findUnique", async () => ({ role: "MAHASISWA", isKetuaKelas: false })),
    replaceProperty(prisma.lab, "findUnique", async () => ({ id: "lab-a" })),
    replaceProperty(prisma.schedule, "findFirst", async ({ where }: { where: Record<string, any> }) => {
      scheduleQueries.push(where);
      return schedules.find((schedule) => matchesCreationScheduleQuery(schedule, where)) ?? null;
    }),
    replaceProperty(prisma.labBooking, "findFirst", async () => null),
    replaceProperty(prisma.labBooking, "create", async ({ data }: { data: Record<string, unknown> }) => {
      bookingCreates += 1;
      return { id: `booking-${bookingCreates}`, ...data };
    }),
    replaceProperty(prisma, "$transaction", async (operation: (transaction: typeof prisma) => Promise<unknown>) => operation(prisma)),
  ];
  const createBooking = () => BookingService.createBooking({
    labId: "lab-a",
    title: "Lab event",
    purpose: "Pelatihan",
    date,
    startTime: "09:00",
    endTime: "10:00",
    participants: 10,
  }, "student-1");

  try {
    schedules = [{
      labId: "lab-a", title: "Cancelled", status: "CANCELLED", isActive: true,
      startTime: "09:30", endTime: "10:30", specificDate: date, day: "SELASA",
    }];
    await createBooking();

    schedules = [{
      labId: "lab-a", title: "Inactive", status: "SCHEDULED", isActive: false,
      startTime: "09:30", endTime: "10:30", specificDate: date, day: "SELASA",
    }];
    await createBooking();

    schedules = [{
      labId: "lab-b", title: "Other lab", status: "SCHEDULED", isActive: true,
      startTime: "09:30", endTime: "10:30", specificDate: date, day: "SELASA",
    }];
    await createBooking();

    schedules = [{
      labId: "lab-a", title: "Adjacent", status: "SCHEDULED", isActive: true,
      startTime: "08:00", endTime: "09:00", specificDate: date, day: "SELASA",
    }];
    await createBooking();

    schedules = [{
      labId: "lab-a", title: "Stale date", status: "SCHEDULED", isActive: true,
      startTime: "09:30", endTime: "10:30", specificDate: new Date("2026-10-06T00:00:00.000Z"), day: "SELASA",
    }];
    await createBooking();

    schedules = [{
      labId: "lab-a", title: "Exact session", status: "SCHEDULED", isActive: true,
      startTime: "09:30", endTime: "10:30", specificDate: date, day: "SELASA",
    }];
    await assert.rejects(createBooking(), /Waktu bentrok dengan jadwal "Exact session"/);

    schedules = [{
      labId: "lab-a", title: "Recurring session", status: "ONGOING", isActive: true,
      startTime: "09:30", endTime: "10:30", specificDate: null, day: "SELASA",
    }];
    await assert.rejects(createBooking(), /Waktu bentrok dengan jadwal "Recurring session"/);

    assert.equal(bookingCreates, 5);
    assert.deepEqual(scheduleQueries[0], {
      labId: "lab-a",
      isActive: true,
      status: { in: ["SCHEDULED", "ONGOING"] },
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      OR: [
        { specificDate: date },
        { specificDate: null, day: "SELASA" },
      ],
    });
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});

test("booking creation keeps pending and approved booking overlap checks", async () => {
  const date = new Date("2026-10-13T00:00:00.000Z");
  let bookingCreates = 0;
  let bookings: Array<{
    labId: string;
    date: Date;
    status: string;
    startTime: string;
    endTime: string;
  }> = [];
  const bookingQueries: Record<string, any>[] = [];
  const restores = [
    replaceProperty(prisma.user, "findUnique", async () => ({ role: "MAHASISWA", isKetuaKelas: false })),
    replaceProperty(prisma.lab, "findUnique", async () => ({ id: "lab-a" })),
    replaceProperty(prisma.schedule, "findFirst", async () => null),
    replaceProperty(prisma.labBooking, "findFirst", async ({ where }: { where: Record<string, any> }) => {
      bookingQueries.push(where);
      return bookings.find((booking) =>
        booking.labId === where.labId &&
        booking.date.getTime() === where.date.getTime() &&
        where.status.in.includes(booking.status) &&
        booking.startTime < where.startTime.lt &&
        booking.endTime > where.endTime.gt
      ) ?? null;
    }),
    replaceProperty(prisma.labBooking, "create", async ({ data }: { data: Record<string, unknown> }) => {
      bookingCreates += 1;
      return { id: `booking-${bookingCreates}`, ...data };
    }),
    replaceProperty(prisma, "$transaction", async (operation: (transaction: typeof prisma) => Promise<unknown>) => operation(prisma)),
  ];
  const createBooking = () => BookingService.createBooking({
    labId: "lab-a",
    title: "Lab event",
    purpose: "Pelatihan",
    date,
    startTime: "09:00",
    endTime: "10:00",
    participants: 10,
  }, "student-1");

  try {
    bookings = [{
      labId: "lab-a", date, status: "PENDING", startTime: "09:30", endTime: "10:30",
    }];
    await assert.rejects(createBooking(), /Waktu bentrok dengan pengajuan lain/);

    bookings = [{
      labId: "lab-a", date, status: "APPROVED", startTime: "09:30", endTime: "10:30",
    }];
    await assert.rejects(createBooking(), /Waktu bentrok dengan pengajuan lain/);

    bookings = [{
      labId: "lab-a", date, status: "CANCELLED", startTime: "09:30", endTime: "10:30",
    }];
    await createBooking();

    assert.deepEqual(bookingQueries.map((where) => ({
      labId: where.labId,
      date: where.date,
      status: where.status,
      startTime: where.startTime,
      endTime: where.endTime,
    })), [
      {
        labId: "lab-a",
        date,
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: "10:00" },
        endTime: { gt: "09:00" },
      },
      {
        labId: "lab-a",
        date,
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: "10:00" },
        endTime: { gt: "09:00" },
      },
      {
        labId: "lab-a",
        date,
        status: { in: ["PENDING", "APPROVED"] },
        startTime: { lt: "10:00" },
        endTime: { gt: "09:00" },
      },
    ]);
    assert.equal(bookingCreates, 1);
  } finally {
    for (const restore of restores.reverse()) restore();
  }
});
