import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { KeyService } from "./key.service";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

function restoreAll(restores: Restore[]) {
  restores.reverse().forEach((restore) => restore());
}

const now = new Date("2026-10-13T02:00:00.000Z");
const key = { id: "key-1", labId: "lab-1", status: "AVAILABLE", currentHolderId: null };
const chair = { id: "chair-1", role: "MAHASISWA", isKetuaKelas: true, semester: "3", className: "TI-3A" };
const schedule = {
  id: "schedule-1", labId: "lab-1", className: "TI-3A", semester: "3", specificDate: null, startTime: "00:00", endTime: "23:59",
};

test("student take creates occurrence cycle and linked TAKEN log atomically", async () => {
  const writes: unknown[] = [];
  const tx = {
    key: { findUnique: async () => key, updateMany: async () => ({ count: 1 }) },
    user: { findUnique: async () => chair },
    schedule: { findMany: async () => [schedule] },
    labBooking: { findMany: async () => [] },
    keyBorrowCycle: { findUnique: async () => null, create: async (args: any) => ({ id: "cycle-1", ...args.data }) },
    keyLog: { create: async (args: any) => { writes.push(args.data); return { id: "log-1" }; } },
  };
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => chair),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma.labBooking, "findMany", async () => []),
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    await KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now);
    assert.deepEqual(writes, [{ keyId: "key-1", userId: "chair-1", borrowCycleId: "cycle-1", action: "TAKEN", takenAt: now, notes: undefined }]);
  } finally {
    restoreAll(restores);
  }
});

test("take re-resolves occurrence inside Serializable transaction before writing", async () => {
  let writes = 0;
  let isolation: unknown;
  const tx = {
    key: { findUnique: async () => key, updateMany: async () => { writes += 1; return { count: 1 }; } },
    user: { findUnique: async () => chair },
    schedule: { findMany: async () => [] },
    labBooking: { findMany: async () => [] },
    keyBorrowCycle: { findUnique: async () => null, create: async () => { writes += 1; return { id: "cycle-1" }; } },
    keyLog: { create: async () => { writes += 1; return { id: "log-1" }; } },
  };
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => chair),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma.labBooking, "findMany", async () => []),
    replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>, options: unknown) => {
      isolation = options;
      return operation(tx);
    }),
  ];
  try {
    await assert.rejects(KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now), /Tidak ada sesi lab aktif/);
    assert.deepEqual(isolation, { isolationLevel: "Serializable" });
    assert.equal(writes, 0);
  } finally {
    restoreAll(restores);
  }
});

test("take retries serialization failures and re-resolves occurrence before retrying writes", async () => {
  let attempts = 0;
  let scheduleReads = 0;
  const tx = {
    key: { findUnique: async () => key, updateMany: async () => ({ count: 1 }) },
    user: { findUnique: async () => chair },
    schedule: { findMany: async () => { scheduleReads += 1; return attempts === 1 ? [schedule] : []; } },
    labBooking: { findMany: async () => [] },
    keyBorrowCycle: { findUnique: async () => null, create: async () => ({ id: "cycle-1" }) },
    keyLog: { create: async () => ({ id: "log-1" }) },
  };
  const restore = replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable");
    attempts += 1;
    const result = await operation(tx);
    if (attempts === 1) throw new Prisma.PrismaClientKnownRequestError("serialization failure", { code: "P2034", clientVersion: "test" });
    return result;
  });
  try {
    await assert.rejects(KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now), /Tidak ada sesi lab aktif/);
    assert.equal(attempts, 2);
    assert.equal(scheduleReads, 2);
  } finally {
    restore();
  }
});

test("student take rejects missing or mismatched trusted class authority", async () => {
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => ({ ...chair, className: "TI-3B" })),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma, "$transaction", async (operation: (client: object) => Promise<unknown>) => operation({
      key: { findUnique: async () => key },
      user: { findUnique: async () => ({ ...chair, className: "TI-3B" }) },
      schedule: { findMany: async () => [schedule] },
    })),
  ];
  try {
    await assert.rejects(KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now), /Otoritas ketua kelas tidak cocok/);
  } finally {
    restoreAll(restores);
  }
});

test("eligibility blocks every borrower after occurrence cycle exists", async () => {
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => chair),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma.labBooking, "findMany", async () => []),
    replace(prisma.keyBorrowCycle, "findUnique", async () => ({ id: "cycle-closed" })),
  ];
  try {
    const result = await KeyService.getEligibility("key-1", "chair-1", "MAHASISWA", now);
    assert.equal(result.canTake, false);
    assert.match(result.takeReason || "", /sudah digunakan/);
  } finally {
    restoreAll(restores);
  }
});

test("return refuses an active cycle without bound evidence", async () => {
  const cycle = { id: "cycle-1", borrowerId: "chair-1", status: "ACTIVE", takenAt: now, returnEvidence: null, key: { ...key, status: "BORROWED", currentHolderId: "chair-1" } };
  const restores = [
    replace(prisma, "$transaction", async (operation: any) => operation({ keyBorrowCycle: { findFirst: async () => cycle } })),
  ];
  try {
    await assert.rejects(KeyService.returnKey("key-1", "chair-1", undefined, now), /Foto kondisi akhir/);
  } finally {
    restoreAll(restores);
  }
});

test("force return requires nonempty reason before changing custody", async () => {
  await assert.rejects(KeyService.forceReturnKey("key-1", "coordinator-1", "   ", now), /Alasan force return wajib/);
});

test("legacy reconciliation releases BORROWED key without fabricating a cycle", async () => {
  const key = { id: "key-legacy", status: "BORROWED", currentHolderId: "holder-1" };
  const updates: unknown[] = [];
  const logs: unknown[] = [];
  const tx = {
    key: {
      findUnique: async () => key,
      updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; },
      findFirst: async () => null,
    },
    keyBorrowCycle: { findFirst: async () => null },
    keyLog: { create: async (args: unknown) => { logs.push(args); } },
  };
  const original = prisma.$transaction;
  (prisma as any).$transaction = async (callback: (value: typeof tx) => unknown) => callback(tx);
  try {
    await KeyService.reconcileLegacyBorrowedKey("key-legacy", "coordinator-1", "Physical return verified");
    assert.equal(updates.length, 1);
    assert.equal(logs.length, 1);
    assert.match(String((logs[0] as any).data.notes), /LEGACY RECONCILIATION/);
    assert.equal((logs[0] as any).data.borrowCycleId, undefined);
  } finally {
    (prisma as any).$transaction = original;
  }
});

test("student self-service profile update cannot escalate className or isKetuaKelas", async () => {
  const user = { ...chair, isKetuaKelas: false, className: "TI-3B" };
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => user),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma, "$transaction", async (operation: (client: object) => Promise<unknown>) => operation({
      key: { findUnique: async () => key },
      user: { findUnique: async () => user },
    })),
  ];
  try {
    await assert.rejects(
      KeyService.takeKey("key-1", "student-1", "MAHASISWA", undefined, now),
      /Hanya Koordinator Lab, Asisten Lab, atau ketua kelas yang diizinkan/
    );
  } finally {
    restoreAll(restores);
  }
});

test("concurrent student take requests allow exactly one claim to succeed", async () => {
  let claims = 0;
  const tx = {
    key: {
      findUnique: async () => key,
      updateMany: async () => {
        claims += 1;
        return { count: claims === 1 ? 1 : 0 };
      },
    },
    user: { findUnique: async () => chair },
    schedule: { findMany: async () => [schedule] },
    labBooking: { findMany: async () => [] },
    keyBorrowCycle: { findUnique: async () => null, create: async (args: any) => ({ id: "cycle-1", ...args.data }) },
    keyLog: { create: async () => ({ id: "log-1" }) },
  };
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => chair),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma.labBooking, "findMany", async () => []),
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    const results = await Promise.allSettled([
      KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now),
      KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
  } finally {
    restoreAll(restores);
  }
});

test("same student cannot retake same occurrence after return", async () => {
  const tx = {
    key: { findUnique: async () => key },
    user: { findUnique: async () => chair },
    schedule: { findMany: async () => [schedule] },
    labBooking: { findMany: async () => [] },
    keyBorrowCycle: { findUnique: async () => ({ id: "cycle-completed", status: "RETURNED" }) },
  };
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => chair),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma.labBooking, "findMany", async () => []),
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    await assert.rejects(
      KeyService.takeKey("key-1", "chair-1", "MAHASISWA", undefined, now),
      /Kunci sudah digunakan untuk pertemuan ini/
    );
  } finally {
    restoreAll(restores);
  }
});

test("distinct class leader cannot take key for completed occurrence of different class", async () => {
  const distinctChair = { ...chair, id: "chair-2", className: "TI-3A" };
  const tx = {
    key: { findUnique: async () => key },
    user: { findUnique: async () => distinctChair },
    schedule: { findMany: async () => [schedule] },
    labBooking: { findMany: async () => [] },
    keyBorrowCycle: { findUnique: async () => ({ id: "cycle-completed", status: "RETURNED" }) },
  };
  const restores = [
    replace(prisma.key, "findUnique", async () => key),
    replace(prisma.user, "findUnique", async () => distinctChair),
    replace(prisma.schedule, "findMany", async () => [schedule]),
    replace(prisma.labBooking, "findMany", async () => []),
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    await assert.rejects(
      KeyService.takeKey("key-1", "chair-2", "MAHASISWA", undefined, now),
      /Kunci sudah digunakan untuk pertemuan ini/
    );
  } finally {
    restoreAll(restores);
  }
});

test("force return records forceReturnedById and immutable audit notes", async () => {
  const activeCycle = {
    id: "cycle-1",
    borrowerId: "chair-1",
    status: "ACTIVE",
    key: { ...key, status: "BORROWED", currentHolderId: "chair-1" },
  };
  const logs: any[] = [];
  const cycleUpdates: any[] = [];
  const tx = {
    keyBorrowCycle: {
      findFirst: async () => activeCycle,
      update: async (args: any) => {
        cycleUpdates.push(args.data);
        return { id: "cycle-1", ...args.data };
      },
    },
    key: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ ...key, status: "AVAILABLE", currentHolderId: null }),
    },
    keyLog: {
      create: async (args: any) => {
        logs.push(args.data);
        return { id: "log-1", ...args.data };
      },
    },
  };
  const restores = [
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    await KeyService.forceReturnKey("key-1", "coordinator-1", "Emergency door check", now);
    assert.deepEqual(cycleUpdates, [
      { status: "FORCE_RETURNED", returnedAt: now, forceReturnedById: "coordinator-1", reason: "Emergency door check" },
    ]);
    assert.deepEqual(logs, [
      { keyId: "key-1", userId: "coordinator-1", borrowCycleId: "cycle-1", action: "FORCE_RETURNED", returnedAt: now, notes: "Emergency door check" },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("return key updates status to RETURNED and records audit log", async () => {
  const activeCycle = {
    id: "cycle-1",
    borrowerId: "chair-1",
    status: "ACTIVE",
    takenAt: now,
    returnEvidence: { id: "ev-1", createdAt: new Date(now.getTime() + 1000) },
    key: { ...key, status: "BORROWED", currentHolderId: "chair-1" },
  };
  const logs: any[] = [];
  const cycleUpdates: any[] = [];
  const tx = {
    keyBorrowCycle: {
      findFirst: async () => activeCycle,
      update: async (args: any) => {
        cycleUpdates.push(args.data);
        return { id: "cycle-1", ...args.data };
      },
    },
    key: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ ...key, status: "AVAILABLE", currentHolderId: null }),
    },
    keyLog: {
      create: async (args: any) => {
        logs.push(args.data);
        return { id: "log-1", ...args.data };
      },
    },
  };
  const restores = [
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    await KeyService.returnKey("key-1", "chair-1", "Selesai praktikum", now);
    assert.deepEqual(cycleUpdates, [
      { status: "RETURNED", returnedAt: now, returnedById: "chair-1" },
    ]);
    assert.deepEqual(logs, [
      { keyId: "key-1", userId: "chair-1", borrowCycleId: "cycle-1", action: "RETURNED", returnedAt: now, notes: "Selesai praktikum" },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("saveReturnEvidence rejects uploads not registered to active cycle", async () => {
  const activeCycle = {
    id: "cycle-1",
    borrowerId: "chair-1",
    status: "ACTIVE",
    key: { ...key, status: "BORROWED", currentHolderId: "chair-1" },
  };
  const tx = {
    keyBorrowCycle: { findFirst: async () => activeCycle },
    conditionPhotoUpload: { findMany: async () => [] },
  };
  const restores = [
    replace(prisma, "$transaction", async (operation: any) => operation(tx)),
  ];
  try {
    await assert.rejects(
      KeyService.saveReturnEvidence("key-1", "chair-1", ["/uploads/conditions/unregistered.png"]),
      /Foto kondisi tidak terdaftar untuk siklus peminjaman ini/
    );
  } finally {
    restoreAll(restores);
  }
});

test("getKeyLogs returns logs with key and borrowCycle included", async () => {
  const mockLogs = [
    { id: "log-1", keyId: "key-1", borrowCycleId: "cycle-1", action: "TAKEN" },
  ];
  const restores = [
    replace(prisma.keyLog, "findMany", async () => mockLogs),
  ];
  try {
    const logs = await KeyService.getKeyLogs("key-1");
    assert.equal(logs.length, 1);
    assert.equal(logs[0].id, "log-1");
  } finally {
    restoreAll(restores);
  }
});

test("findKeyByQR returns key matching keyCode or qrCode", async () => {
  const restores = [
    replace(prisma.key, "findFirst", async () => key),
  ];
  try {
    const found = await KeyService.findKeyByQR("KEY-1");
    assert.equal(found.id, "key-1");
  } finally {
    restoreAll(restores);
  }
});

test("MAGANG role is rejected from taking or returning keys and eligibility reflects read-only restriction", async () => {
  const eligibility = await KeyService.getEligibility("key-1", "user-magang", "MAGANG");
  assert.equal(eligibility.canTake, false);
  assert.equal(eligibility.canReturn, false);
  assert.match(eligibility.takeReason || "", /MAGANG/);
  assert.match(eligibility.returnReason || "", /MAGANG/);

  await assert.rejects(
    KeyService.takeKey("key-1", "user-magang", "MAGANG"),
    /Peran MAGANG tidak memiliki izin mengambil kunci lab/
  );

  await assert.rejects(
    KeyService.returnKey("key-1", "user-magang", "Selesai", now, "MAGANG"),
    /Peran MAGANG tidak memiliki izin mengembalikan kunci lab/
  );

  await assert.rejects(
    KeyService.saveReturnEvidence("key-1", "user-magang", ["/uploads/conditions/photo.png"], "MAGANG"),
    /Peran MAGANG tidak memiliki izin mengembalikan kunci lab/
  );
});
