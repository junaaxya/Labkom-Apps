import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { AttendanceLocationService, AttendanceService, isLateCheckin, pickTodaySchedule, ShiftScheduleService } from "./attendance.service";
import { AttendanceQrService } from "./attendance-qr.service";

type Restore = () => void;

function replaceMethod(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Reflect.deleteProperty(target, key);
    }
  };
}

function restoreAll(restores: Restore[]): void {
  for (const restore of restores.reverse()) restore();
}

function nextMonday(): string {
  const date = new Date();
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
  return monday.toISOString().slice(0, 10);
}

function weeklyPlan(weekStart: string, userId: string) {
  return {
    weekStart,
    shiftId: "shift-1",
    assignments: [{ date: weekStart, labId: "lab-1", requiredAssistantCount: 1, userIds: [userId] }],
  };
}

test("08:00 shift marks 09:00 WIB as late", () => {
  assert.equal(isLateCheckin(new Date("2026-07-14T02:00:00.000Z"), "08:00", 15), true);
});

test("zero tolerance is honored for picket check-in", () => {
  assert.equal(isLateCheckin(new Date("2026-07-14T01:00:00.000Z"), "08:00", 0), false);
  assert.equal(isLateCheckin(new Date("2026-07-14T01:01:00.000Z"), "08:00", 0), true);
});

test("check-in exactly at the tolerance boundary is still on time", () => {
  assert.equal(isLateCheckin(new Date("2026-07-14T01:15:00.000Z"), "08:00", 15), false);
  assert.equal(isLateCheckin(new Date("2026-07-14T01:16:00.000Z"), "08:00", 15), true);
});

test("today schedule picks the latest shift already started in WIB", () => {
  const selected = pickTodaySchedule(
    [
      { id: "shift-2", shift: { startTime: "10:00" } },
      { id: "shift-1", shift: { startTime: "08:00" } },
      { id: "shift-3", shift: { startTime: "13:00" } },
    ],
    new Date("2026-07-14T05:30:00.000Z"),
  );

  assert.equal(selected?.id, "shift-2");
});

test("today schedule falls back to earliest shift when none has started yet", () => {
  const selected = pickTodaySchedule(
    [
      { id: "shift-2", shift: { startTime: "10:00" } },
      { id: "shift-1", shift: { startTime: "08:00" } },
    ],
    new Date("2026-07-14T00:30:00.000Z"),
  );

  assert.equal(selected?.id, "shift-1");
});

test("getAllAttendance filters by user role and selects role", async () => {
  let findManyQuery: { where?: unknown; include?: unknown } | undefined;
  const restores = [
    replaceMethod(prisma.attendance, "findMany", async (query: { where?: unknown; include?: unknown }) => {
      findManyQuery = query;
      return [];
    }),
    replaceMethod(prisma.attendance, "count", async () => 0),
    replaceMethod(prisma, "$transaction", async () => {
      return [[], 0];
    }),
  ];

  try {
    await AttendanceService.getAllAttendance({ role: "MAGANG", limit: 100 });
    assert.deepEqual(findManyQuery?.where, { user: { role: "MAGANG" } });
    assert.deepEqual(findManyQuery?.include, {
      user: { select: { id: true, name: true, nim: true, role: true } },
      shiftSchedule: { include: { shift: { select: { name: true, startTime: true, endTime: true } } } },
      dailyTasks: { select: { id: true, task: true, status: true } },
    });
  } finally {
    restoreAll(restores);
  }
});

function activeSchedule(userId = "magang-1") {
  return {
    id: "shift-schedule-1",
    userId,
    scheduleDate: new Date(),
    shift: {
      id: "shift-1",
      name: "Pagi",
      startTime: "00:00",
      endTime: "23:59",
      lateToleranceMinutes: 15,
      checkoutGraceMinutes: 0,
    },
    lab: { id: "lab-1", name: "Lab 1" },
  };
}

function futureSchedule(userId = "magang-1") {
  return {
    ...activeSchedule(userId),
    id: "future-shift-schedule-1",
    scheduleDate: new Date(Date.now() + 86_400_000),
    shift: {
      ...activeSchedule(userId).shift,
      startTime: "08:00",
      endTime: "16:00",
    },
  };
}

type CheckinActor = {
  role: "ASISTEN_LAB" | "MAGANG" | "MAHASISWA";
  isActive: boolean;
};

type AttendanceLookupQuery = {
  where: {
    shiftScheduleId?: string;
    userId?: string;
    checkinAt?: { gte: Date; lte: Date };
  };
};

type AttendanceCreateQuery = {
  data: {
    userId: string;
    shiftScheduleId: string | null;
    checkinAt: Date;
    checkinLatitude?: number;
    checkinLongitude?: number;
    checkinLocationId?: string;
    status: "CHECKED_IN" | "LATE";
  };
};

type AuditCreateQuery = {
  data: {
    userId: string;
    action: string;
    targetType: string;
    targetId: string;
    description: string;
  };
};

type CheckinTransaction = {
  user: {
    findUnique: (query: unknown) => Promise<CheckinActor | null>;
  };
  asLabShiftSchedule: {
    findMany: (query: unknown) => Promise<ReturnType<typeof activeSchedule>[]>;
  };
  attendance: {
    findFirst: (query: AttendanceLookupQuery) => Promise<unknown>;
    create: (query: AttendanceCreateQuery) => Promise<{ id: string }>;
  };
  auditLog: {
    create: (query: AuditCreateQuery) => Promise<{ id: string }>;
  };
};

function checkinTransaction(options: {
  user?: CheckinActor | null;
  findUser?: (query: unknown) => Promise<CheckinActor | null>;
  schedules?: ReturnType<typeof activeSchedule>[];
  findSchedules?: (query: unknown) => Promise<ReturnType<typeof activeSchedule>[]>;
  existing?: unknown;
  findExisting?: (query: AttendanceLookupQuery) => Promise<unknown>;
  create?: (query: AttendanceCreateQuery) => Promise<{ id: string }>;
  audit?: (query: AuditCreateQuery) => Promise<{ id: string }>;
}): CheckinTransaction {
  return {
    user: { findUnique: options.findUser ?? (async () => options.user === undefined ? { role: "MAGANG", isActive: true } : options.user) },
    asLabShiftSchedule: { findMany: options.findSchedules ?? (async () => options.schedules ?? [activeSchedule()]) },
    attendance: {
      findFirst: options.findExisting ?? (async () => options.existing ?? null),
      create: options.create ?? (async () => ({ id: "attendance-1" })),
    },
    auditLog: { create: options.audit ?? (async () => ({ id: "audit-1" })) },
  };
}

test("check-in rejects missing GPS when geofencing is enabled before transaction", async () => {
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: true, lateToleranceMinutes: 15 })),
  ];

  try {
    await assert.rejects(AttendanceService.checkin("magang-1"), /Koordinat GPS tidak valid/);
  } finally {
    restoreAll(restores);
  }
});

test("ASISTEN_LAB check-in rejects duplicate attendance for the same scheduled shift", async () => {
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: false, lateToleranceMinutes: 15 })),
    replaceMethod(prisma, "$transaction", async (callback: (transaction: CheckinTransaction) => Promise<unknown>) => callback(checkinTransaction({
      user: { role: "ASISTEN_LAB", isActive: true },
      schedules: [activeSchedule("asisten-1")],
      existing: { id: "attendance-open" },
    }))),
  ];

  try {
    await assert.rejects(AttendanceService.checkin("asisten-1"), /Absensi untuk shift ini sudah tercatat/);
  } finally {
    restoreAll(restores);
  }
});

test("check-in rejects Magang outside enabled geofence before create", async () => {
  const locationCalls: Array<{ latitude: number; longitude: number }> = [];
  let createCalls = 0;
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: true, lateToleranceMinutes: 15 })),
    replaceMethod(AttendanceLocationService, "findNearestValid", async (latitude: number, longitude: number) => {
      locationCalls.push({ latitude, longitude });
      return null;
    }),
  ];

  try {
    await assert.rejects(
      AttendanceService.checkin("magang-1", -6.2, 106.8),
      /Lokasi check-in di luar jangkauan area lab/,
    );
    assert.deepEqual(locationCalls, [{ latitude: -6.2, longitude: 106.8 }]);
    assert.equal(createCalls, 0);
  } finally {
    restoreAll(restores);
  }
});

test("MAGANG check-in ignores future shifts and creates independent attendance with valid GPS", async () => {
  const locationCalls: Array<{ latitude: number; longitude: number }> = [];
  const createCalls: AttendanceCreateQuery[] = [];
  let scheduleQueries = 0;
  let scheduleUserId: string | undefined;
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: true, lateToleranceMinutes: 15 })),
    replaceMethod(AttendanceLocationService, "findNearestValid", async (latitude: number, longitude: number) => {
      locationCalls.push({ latitude, longitude });
      return { location: { id: "location-1" }, distance: 0 };
    }),
    replaceMethod(prisma, "$transaction", async (callback: (transaction: CheckinTransaction) => Promise<unknown>) => callback(checkinTransaction({
      findSchedules: async () => {
        scheduleQueries += 1;
        return [futureSchedule()];
      },
      create: async (query) => {
        createCalls.push(query);
        scheduleUserId = query.data.userId;
        return { id: "attendance-1" };
      },
    }))),
  ];

  try {
    const attendance = await AttendanceService.checkin("magang-1", -6.2, 106.8);
    assert.equal(attendance.id, "attendance-1");
    assert.deepEqual(locationCalls, [{ latitude: -6.2, longitude: 106.8 }]);
    assert.equal(scheduleUserId, "magang-1");
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0]?.data.userId, "magang-1");
    assert.equal(createCalls[0]?.data.checkinLatitude, -6.2);
    assert.equal(createCalls[0]?.data.checkinLongitude, 106.8);
    assert.equal(createCalls[0]?.data.checkinLocationId, "location-1");
    assert.equal(createCalls[0]?.data.shiftScheduleId, null);
    assert.equal(scheduleQueries, 0);
  } finally {
    restoreAll(restores);
  }
});

test("MAGANG check-in without a shift creates independent attendance", async () => {
  const userQueries: unknown[] = [];
  const duplicateQueries: AttendanceLookupQuery[] = [];
  const createCalls: AttendanceCreateQuery[] = [];
  const auditCalls: AuditCreateQuery[] = [];
  let transactionOptions: { isolationLevel?: unknown } | undefined;
  const transaction = checkinTransaction({
    schedules: [],
    findUser: async (query) => {
      userQueries.push(query);
      return { role: "MAGANG", isActive: true };
    },
    findExisting: async (query) => {
      duplicateQueries.push(query);
      return null;
    },
    create: async (query) => {
      createCalls.push(query);
      return { id: "attendance-magang-1" };
    },
    audit: async (query) => {
      auditCalls.push(query);
      return { id: "audit-1" };
    },
  });
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: false, isQrRequired: false })),
    replaceMethod(prisma, "$transaction", async (
      callback: (currentTransaction: CheckinTransaction) => Promise<unknown>,
      options?: { isolationLevel?: unknown },
    ) => {
      transactionOptions = options;
      return callback(transaction);
    }),
  ];

  try {
    const attendance = await AttendanceService.checkin("magang-1");
    const duplicateRange = duplicateQueries[0]?.where.checkinAt;

    assert.equal(attendance.id, "attendance-magang-1");
    assert.deepEqual(userQueries, [{
      where: { id: "magang-1" },
      select: { role: true, isActive: true },
    }]);
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0]?.data.userId, "magang-1");
    assert.equal(createCalls[0]?.data.shiftScheduleId, null);
    assert.equal(createCalls[0]?.data.status, "CHECKED_IN");
    assert.ok(duplicateRange);
    assert.equal(duplicateQueries[0]?.where.userId, "magang-1");
    assert.equal(duplicateRange.lte.getTime() - duplicateRange.gte.getTime(), 86_399_999);
    assert.equal(duplicateRange.gte.getUTCHours(), 17);
    assert.deepEqual(transactionOptions, { isolationLevel: "Serializable" });
    assert.deepEqual(auditCalls, [{
      data: {
        userId: "magang-1",
        action: "ATTENDANCE_CHECKIN",
        targetType: "Attendance",
        targetId: "attendance-magang-1",
        description: "Check-in MAGANG tanpa jadwal shift",
      },
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("MAGANG independent check-in rejects an existing Jakarta-date attendance", async () => {
  const duplicateQueries: AttendanceLookupQuery[] = [];
  let createCalls = 0;
  const transaction = checkinTransaction({
    schedules: [],
    findExisting: async (query) => {
      duplicateQueries.push(query);
      return { id: "attendance-today" };
    },
    create: async () => {
      createCalls += 1;
      return { id: "unexpected" };
    },
  });
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: false, isQrRequired: false })),
    replaceMethod(prisma, "$transaction", async (callback: (currentTransaction: CheckinTransaction) => Promise<unknown>) => callback(transaction)),
  ];

  try {
    await assert.rejects(AttendanceService.checkin("magang-1"), /Absensi hari ini sudah tercatat/);
    const duplicateRange = duplicateQueries[0]?.where.checkinAt;
    assert.ok(duplicateRange);
    assert.equal(duplicateQueries[0]?.where.userId, "magang-1");
    assert.equal(duplicateRange.lte.getTime() - duplicateRange.gte.getTime(), 86_399_999);
    assert.equal(createCalls, 0);
  } finally {
    restoreAll(restores);
  }
});

test("ASISTEN_LAB without a shift keeps schedule rejection", async () => {
  const attendanceQueries: AttendanceLookupQuery[] = [];
  let createCalls = 0;
  const transaction = checkinTransaction({
    user: { role: "ASISTEN_LAB", isActive: true },
    schedules: [],
    findExisting: async (query) => {
      attendanceQueries.push(query);
      return null;
    },
    create: async () => {
      createCalls += 1;
      return { id: "unexpected" };
    },
  });
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: false, isQrRequired: false })),
    replaceMethod(prisma, "$transaction", async (callback: (currentTransaction: CheckinTransaction) => Promise<unknown>) => callback(transaction)),
  ];

  try {
    await assert.rejects(AttendanceService.checkin("asisten-1"), /Anda tidak memiliki jadwal piket aktif pada waktu ini/);
    assert.equal(attendanceQueries.length, 0);
    assert.equal(createCalls, 0);
  } finally {
    restoreAll(restores);
  }
});

test("check-in rejects inactive MAGANG and unsupported persisted roles", async () => {
  const inactiveTransaction = checkinTransaction({ user: { role: "MAGANG", isActive: false } });
  const unsupportedTransaction = checkinTransaction({ user: { role: "MAHASISWA", isActive: true } });
  const transactions = [inactiveTransaction, unsupportedTransaction];
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: false, isQrRequired: false })),
    replaceMethod(prisma, "$transaction", async (callback: (currentTransaction: CheckinTransaction) => Promise<unknown>) => {
      const transaction = transactions.shift();
      if (!transaction) throw new Error("Unexpected attendance transaction");
      return callback(transaction);
    }),
  ];

  try {
    await assert.rejects(AttendanceService.checkin("magang-inactive"), /Akun tidak aktif/);
    await assert.rejects(AttendanceService.checkin("mahasiswa-1"), /Role pengguna tidak dapat melakukan absensi/);
  } finally {
    restoreAll(restores);
  }
});

type CheckoutUpdateQuery = {
  where: { id: string; checkoutAt: null };
  data: {
    checkoutAt: Date;
    checkoutLatitude?: number;
    checkoutLongitude?: number;
    checkoutLocationId?: string;
    workDurationMinutes: number;
    status: "CHECKED_OUT" | "WAITING_VERIFICATION";
  };
};

type CheckoutTransaction = {
  attendance: {
    updateMany: (query: CheckoutUpdateQuery) => Promise<{ count: number }>;
    findUniqueOrThrow: (query: unknown) => Promise<{ id: string; status: string }>;
  };
  auditLog: {
    create: (query: AuditCreateQuery) => Promise<{ id: string }>;
  };
  point: {
    create: (query: unknown) => Promise<{ id: string }>;
  };
};

test("MAGANG independent checkout keeps location, QR, audit, and atomic update without shift or task queries", async () => {
  const locationCalls: Array<{ latitude: number; longitude: number }> = [];
  const updateCalls: CheckoutUpdateQuery[] = [];
  const auditCalls: AuditCreateQuery[] = [];
  const qrTokens: string[] = [];
  let qrUseCalls = 0;
  let shiftQueries = 0;
  let taskQueries = 0;
  let transactionOptions: { isolationLevel?: unknown } | undefined;
  const transaction: CheckoutTransaction = {
    attendance: {
      updateMany: async (query) => {
        updateCalls.push(query);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ id: "attendance-magang-1", status: "CHECKED_OUT" }),
    },
    auditLog: {
      create: async (query) => {
        auditCalls.push(query);
        return { id: "audit-1" };
      },
    },
    point: { create: async () => ({ id: "point-1" }) },
  };
  const restores = [
    replaceMethod(prisma.user, "findUnique", async () => ({ role: "MAGANG", isActive: true })),
    replaceMethod(prisma.attendance, "findFirst", async () => ({
      id: "attendance-magang-1",
      userId: "magang-1",
      shiftScheduleId: "legacy-magang-shift-1",
      checkinAt: new Date(Date.now() - 30 * 60_000),
      checkoutAt: null,
      status: "CHECKED_IN",
    })),
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({
      isGeofencingEnabled: true,
      isQrRequired: true,
      isTaskRequired: true,
      isVerificationRequired: false,
    })),
    replaceMethod(AttendanceLocationService, "findNearestValid", async (latitude: number, longitude: number) => {
      locationCalls.push({ latitude, longitude });
      return { location: { id: "location-1" }, distance: 0 };
    }),
    replaceMethod(AttendanceQrService, "verify", (token: string) => {
      qrTokens.push(token);
      return { type: "ATTENDANCE_QR", locationId: "location-1", nonce: "nonce-1", iat: 1, exp: 2 };
    }),
    replaceMethod(AttendanceQrService, "markUsed", async () => {
      qrUseCalls += 1;
    }),
    replaceMethod(prisma.asLabShiftSchedule, "findUnique", async () => {
      shiftQueries += 1;
      return null;
    }),
    replaceMethod(prisma.dailyTaskLog, "count", async () => {
      taskQueries += 1;
      return 0;
    }),
    replaceMethod(prisma, "$transaction", async (
      callback: (currentTransaction: CheckoutTransaction) => Promise<unknown>,
      options?: { isolationLevel?: unknown },
    ) => {
      transactionOptions = options;
      return callback(transaction);
    }),
  ];

  try {
    const attendance = await AttendanceService.checkout("magang-1", -6.2, 106.8, "qr-token");

    assert.deepEqual(locationCalls, [{ latitude: -6.2, longitude: 106.8 }]);
    assert.deepEqual(qrTokens, ["qr-token"]);
    assert.equal(qrUseCalls, 1);
    assert.equal(shiftQueries, 0);
    assert.equal(taskQueries, 0);
    assert.equal(attendance.status, "CHECKED_OUT");
    assert.deepEqual(updateCalls[0]?.where, { id: "attendance-magang-1", checkoutAt: null });
    assert.equal(updateCalls[0]?.data.checkoutLatitude, -6.2);
    assert.equal(updateCalls[0]?.data.checkoutLongitude, 106.8);
    assert.equal(updateCalls[0]?.data.checkoutLocationId, "location-1");
    assert.equal(updateCalls[0]?.data.status, "CHECKED_OUT");
    assert.ok((updateCalls[0]?.data.workDurationMinutes ?? 0) >= 30);
    assert.deepEqual(transactionOptions, { isolationLevel: "Serializable" });
    assert.deepEqual(auditCalls, [{
      data: {
        userId: "magang-1",
        action: "ATTENDANCE_CHECKOUT",
        targetType: "Attendance",
        targetId: "attendance-magang-1",
        description: "Check-out MAGANG tanpa jadwal shift",
      },
    }]);
  } finally {
    restoreAll(restores);
  }
});

test("direct and bulk shift assignment allow active Magang and reject Mahasiswa", async () => {
  const eligibilityQueries: any[] = [];
  const createdSchedules: any[] = [];
  const notificationCalls: any[] = [];
  const restores = [
    replaceMethod(prisma.shift, "findUnique", async () => ({ id: "shift-1" })),
    replaceMethod(prisma.user, "findFirst", async (args: any) => {
      eligibilityQueries.push(args);
      return args.where.id === "magang-1" ? { id: "magang-1" } : null;
    }),
    replaceMethod(prisma.asLabShiftSchedule, "findFirst", async () => null),
    replaceMethod(prisma.asLabShiftSchedule, "create", async (args: any) => {
      createdSchedules.push(args);
      return {
        ...args.data,
        shift: { name: "Pagi", startTime: "08:00", endTime: "12:00" },
      };
    }),
    replaceMethod(notificationService, "notifyShiftAssigned", async (args: any) => {
      notificationCalls.push(args);
    }),
  ];

  try {
    const direct = await ShiftScheduleService.create({
      userId: "magang-1",
      destination: "LAB_DASAR" as never,
      shiftId: "shift-1",
      scheduleDate: "2026-10-12",
      assignedBy: "coordinator-1",
    });
    assert.equal(direct.userId, "magang-1");

    const bulk = await ShiftScheduleService.bulkCreate({
      userId: "magang-1",
      destination: "LAB_DASAR" as never,
      shiftId: "shift-1",
      dates: ["2026-10-13", "2026-10-14"],
      assignedBy: "coordinator-1",
    });
    assert.equal(bulk.length, 2);
    assert.equal(createdSchedules.length, 3);
    assert.equal(notificationCalls.length, 3);
    assert.deepEqual(eligibilityQueries[0].where, {
      id: "magang-1",
      role: { in: ["ASISTEN_LAB", "MAGANG"] },
      isActive: true,
    });

    await assert.rejects(
      ShiftScheduleService.create({
        userId: "mahasiswa-1",
        destination: "LAB_DASAR" as never,
        shiftId: "shift-1",
        scheduleDate: "2026-10-15",
        assignedBy: "coordinator-1",
      }),
      /Asisten Lab atau Magang aktif/,
    );
    await assert.rejects(
      ShiftScheduleService.bulkCreate({
        userId: "mahasiswa-1",
        destination: "LAB_DASAR" as never,
        shiftId: "shift-1",
        dates: ["2026-10-16"],
        assignedBy: "coordinator-1",
      }),
      /Asisten Lab atau Magang aktif/,
    );
    assert.equal(createdSchedules.length, 3);
  } finally {
    restoreAll(restores);
  }
});

test("weekly planner candidates include active Magang and exclude Mahasiswa", async () => {
  const candidateQueries: any[] = [];
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ id: "settings-1", activePicketWeekdays: [1] })),
    replaceMethod(prisma.shift, "findUnique", async () => ({ id: "shift-1", name: "Pagi", startTime: "08:00", endTime: "12:00" })),
    replaceMethod(prisma.lab, "findMany", async () => ([{ id: "lab-1", name: "Lab 1", defaultPicketAssistantCount: 1 }])),
    replaceMethod(prisma.user, "findMany", async (args: any) => {
      candidateQueries.push(args);
      return [{ id: "magang-1", name: "Magang Satu", nim: "M001" }];
    }),
    replaceMethod(prisma.asLabShiftSchedule, "findMany", async () => []),
  ];

  try {
    const weekStart = nextMonday();
    const plan = await ShiftScheduleService.previewWeeklyPlan({
      weekStart,
      shiftId: "shift-1",
      rooms: [{ labId: "lab-1", requiredAssistantCount: 1 }],
    });
    assert.deepEqual(plan.assignments[0]?.userIds, ["magang-1"]);
    assert.deepEqual(candidateQueries[0].where, {
      role: { in: ["ASISTEN_LAB", "MAGANG"] },
      isActive: true,
    });
  } finally {
    restoreAll(restores);
  }
});

test("weekly save accepts Magang and rejects Mahasiswa", async () => {
  const activeUserQueries: any[] = [];
  const tx = {
    shift: { findUnique: async () => ({ id: "shift-1" }) },
    lab: { findMany: async () => ([{ id: "lab-1", name: "Lab 1" }]) },
    user: {
      findMany: async (args: any) => {
        activeUserQueries.push(args);
        return args.where.id.in[0] === "magang-1" ? [{ id: "magang-1" }] : [];
      },
    },
    asLabShiftSchedule: {
      findMany: async () => [],
      createMany: async () => ({ count: 1 }),
    },
  };
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ id: "settings-1", activePicketWeekdays: [1] })),
    replaceMethod(prisma, "$transaction", async (callback: (transaction: any) => unknown) => callback(tx)),
  ];

  try {
    const weekStart = nextMonday();
    const accepted = await ShiftScheduleService.saveWeeklyPlan(weeklyPlan(weekStart, "magang-1"), "coordinator-1");
    assert.deepEqual(accepted.schedules, []);
    assert.deepEqual(activeUserQueries[0].where, {
      id: { in: ["magang-1"] },
      role: { in: ["ASISTEN_LAB", "MAGANG"] },
      isActive: true,
    });

    await assert.rejects(
      ShiftScheduleService.saveWeeklyPlan(weeklyPlan(weekStart, "mahasiswa-1"), "coordinator-1"),
      /bukan petugas aktif/,
    );
  } finally {
    restoreAll(restores);
  }
});

test("recurring save accepts Magang and rejects Mahasiswa", async () => {
  const activeUserQueries: any[] = [];
  const tx = {
    shift: { findUnique: async () => ({ id: "shift-1", name: "Pagi", startTime: "08:00", endTime: "12:00" }) },
    lab: { findMany: async () => ([{ id: "lab-1", name: "Lab 1" }]) },
    user: {
      findMany: async (args: any) => {
        activeUserQueries.push(args);
        return args.where.id.in[0] === "magang-1" ? [{ id: "magang-1" }] : [];
      },
    },
    asLabShiftSchedule: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 8 }),
    },
    asLabPicketPattern: { create: async () => ({ id: "pattern-1" }) },
    asLabPicketPatternAssignment: { createMany: async () => ({ count: 1 }) },
    attendance: { count: async () => 0 },
  };
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ id: "settings-1", activePicketWeekdays: [1] })),
    replaceMethod(prisma, "$transaction", async (callback: (transaction: any) => unknown) => callback(tx)),
  ];

  try {
    const effectiveFrom = nextMonday();
    const accepted = await ShiftScheduleService.saveRecurringPlan({
      ...weeklyPlan(effectiveFrom, "magang-1"),
      effectiveFrom,
    }, "coordinator-1");
    assert.equal(accepted.createdCount, 0);
    assert.deepEqual(activeUserQueries[0].where, {
      id: { in: ["magang-1"] },
      role: { in: ["ASISTEN_LAB", "MAGANG"] },
      isActive: true,
    });

    await assert.rejects(
      ShiftScheduleService.saveRecurringPlan({
        ...weeklyPlan(effectiveFrom, "mahasiswa-1"),
        effectiveFrom,
      }, "coordinator-1"),
      /bukan petugas aktif/,
    );
  } finally {
    restoreAll(restores);
  }
});

test("coordinator monitoring counts active Magang without changing summary keys", async () => {
  const countQueries: any[] = [];
  const restores = [
    replaceMethod(prisma.attendance, "findMany", async () => []),
    replaceMethod(prisma.user, "count", async (args: any) => {
      countQueries.push(args);
      return 2;
    }),
    replaceMethod(prisma.asLabShiftSchedule, "findMany", async () => []),
  ];

  try {
    const monitoring = await AttendanceService.getTodayMonitoring();
    assert.equal(monitoring.summary.totalAslab, 2);
    assert.deepEqual(countQueries[0].where, {
      role: { in: ["ASISTEN_LAB", "MAGANG"] },
      isActive: true,
    });
    assert.deepEqual(Object.keys(monitoring.summary), [
      "totalAslab",
      "checkedIn",
      "notCheckedIn",
      "late",
      "checkedOut",
      "forgotCheckout",
      "waitingVerification",
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("coordinator monthly recap includes active Magang without changing row keys", async () => {
  const recapQueries: any[] = [];
  const restores = [
    replaceMethod(prisma.user, "findMany", async (args: any) => {
      recapQueries.push(args);
      return [{ id: "magang-1", name: "Magang Satu", nim: "M001", attendances: [] }];
    }),
  ];

  try {
    const recap = await AttendanceService.getMonthlyRecap("2026-10");
    assert.equal(recap[0]?.id, "magang-1");
    assert.deepEqual(recapQueries[0].where, {
      role: { in: ["ASISTEN_LAB", "MAGANG"] },
      isActive: true,
    });
    assert.deepEqual(Object.keys(recap[0] ?? {}), [
      "id",
      "name",
      "nim",
      "totalDays",
      "present",
      "late",
      "absent",
      "totalHours",
      "attendances",
    ]);
  } finally {
    restoreAll(restores);
  }
});
