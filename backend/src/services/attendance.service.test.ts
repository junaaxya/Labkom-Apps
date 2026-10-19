import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { AttendanceLocationService, AttendanceService, isLateCheckin, pickTodaySchedule, ShiftScheduleService } from "./attendance.service";

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

function checkinTransaction(options: { existing?: unknown; create?: (query: any) => Promise<any> }) {
  return {
    asLabShiftSchedule: { findMany: async () => [activeSchedule()] },
    attendance: {
      findFirst: async () => options.existing ?? null,
      create: options.create ?? (async () => ({ id: "attendance-1" })),
    },
    auditLog: { create: async () => ({ id: "audit-1" }) },
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

test("check-in rejects duplicate attendance for the same scheduled shift", async () => {
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: false, lateToleranceMinutes: 15 })),
    replaceMethod(prisma, "$transaction", async (callback: (tx: any) => unknown) => callback(checkinTransaction({ existing: { id: "attendance-open" } }))),
  ];

  try {
    await assert.rejects(AttendanceService.checkin("magang-1"), /Absensi untuk shift ini sudah tercatat/);
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

test("check-in creates attendance for passed Magang userId with valid GPS", async () => {
  const locationCalls: Array<{ latitude: number; longitude: number }> = [];
  const createCalls: Array<{
    data: {
      userId: string;
      checkinLatitude: number;
      checkinLongitude: number;
      checkinLocationId?: string;
    };
  }> = [];
  let scheduleUserId: string | undefined;
  const restores = [
    replaceMethod(prisma.attendanceSettings, "findFirst", async () => ({ isGeofencingEnabled: true, lateToleranceMinutes: 15 })),
    replaceMethod(AttendanceLocationService, "findNearestValid", async (latitude: number, longitude: number) => {
      locationCalls.push({ latitude, longitude });
      return { location: { id: "location-1" }, distance: 0 };
    }),
    replaceMethod(prisma, "$transaction", async (callback: (tx: any) => unknown) => callback(checkinTransaction({
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
