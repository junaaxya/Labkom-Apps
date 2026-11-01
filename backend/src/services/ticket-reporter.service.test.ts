import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, TicketCategory, TicketPriority, TicketStatus, type Ticket } from "@prisma/client";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { TicketReporterService } from "./ticket-reporter.service";
import { TicketAuthorizationError, TicketConflictError, TicketDuplicateError } from "./ticket-workflow.error";

type Restore = () => void;

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1", pcId: null, labId: "lab-1", reportedBy: "student-1", assignedTo: null,
    category: TicketCategory.CPU, title: "PC tidak menyala", description: "Laporan awal", photo: [],
    status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, resolutionNotes: null,
    rejectionReason: null, waitingReason: null, activeDuplicateKey: null, sourceLogbookConditionId: null, resolvedAt: null,
    createdAt: new Date("2026-10-31T00:00:00.000Z"), updatedAt: new Date("2026-10-31T00:00:00.000Z"),
    ...overrides,
  };
}

function transactionWith(client: object): Restore {
  return replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => operation(client));
}

test("reporter edit uses OPEN CAS and appends edit event", async () => {
  let current = ticket();
  const events: unknown[] = [];
  let updateWhere: unknown;
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      updateMany: async ({ where }: { readonly where: unknown }) => {
        updateWhere = where;
        current = { ...current, title: "PC mati total" };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
  };
  const restore = transactionWith(tx);
  try {
    const updated = await TicketReporterService.update("ticket-1", { title: "PC mati total" }, "student-1");
    assert.equal(updated.title, "PC mati total");
    assert.deepEqual(updateWhere, {
      id: "ticket-1", reportedBy: "student-1", status: "OPEN", title: "PC tidak menyala",
      description: "Laporan awal", category: "CPU", priority: "MEDIUM",
      updatedAt: new Date("2026-10-31T00:00:00.000Z"),
    });
    assert.deepEqual(events, [{
      ticketId: "ticket-1", actorId: "student-1", eventType: "REPORTER_EDITED",
      fromStatus: "OPEN", toStatus: "OPEN", fromAssigneeId: null, toAssigneeId: null, note: "title",
    }]);
  } finally {
    restore();
  }
});

test("reporter edit reports a conflict when CAS loses", async () => {
  const current = ticket();
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
    ticket: { findUnique: async () => current, updateMany: async () => ({ count: 0 }) },
  };
  const restore = transactionWith(tx);
  try {
    await assert.rejects(TicketReporterService.update("ticket-1", { title: "PC mati total" }, "student-1"), TicketConflictError);
  } finally {
    restore();
  }
});

test("reporter edit remains exact-owner and OPEN-only", async () => {
  const closed = ticket({ status: TicketStatus.IN_PROGRESS });
  const otherOwner = ticket({ reportedBy: "student-2" });
  const restore = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    return operation({
      user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
      ticket: { findUnique: async () => closed },
    });
  });
  try {
    await assert.rejects(TicketReporterService.update("ticket-1", { title: "PC mati total" }, "student-1"), TicketConflictError);
  } finally {
    restore();
  }

  const restoreOwner = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    return operation({
      user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
      ticket: { findUnique: async () => otherOwner },
    });
  });
  try {
    await assert.rejects(TicketReporterService.update("ticket-1", { title: "PC mati total" }, "student-1"), TicketAuthorizationError);
  } finally {
    restoreOwner();
  }
});

test("reporter edit preserves conflict across a serialization retry", async () => {
  let attempts = 0;
  const firstSnapshot = ticket();
  const changedSnapshot = ticket({
    title: "Perubahan asisten lain",
    updatedAt: new Date("2026-10-31T00:01:00.000Z"),
  });
  const restore = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    attempts += 1;
    const current = attempts === 1 ? firstSnapshot : changedSnapshot;
    const result = await operation({
      user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
      ticket: {
        findUnique: async () => current,
        updateMany: async () => ({ count: 1 }),
        findUniqueOrThrow: async () => current,
      },
      ticketEvent: { create: async () => ({ id: "event-1" }) },
    });
    if (attempts === 1) {
      throw new Prisma.PrismaClientKnownRequestError("serialization", { code: "P2034", clientVersion: "test" });
    }
    return result;
  });
  try {
    await assert.rejects(
      TicketReporterService.update("ticket-1", { title: "PC mati total" }, "student-1"),
      TicketConflictError,
    );
    assert.equal(attempts, 2);
  } finally {
    restore();
  }
});

test("reporter creation writes ticket, event, and mission together", async () => {
  const events: unknown[] = [];
  const missions: unknown[] = [];
  const created = ticket({ id: "ticket-2" });
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
    lab: { findUnique: async () => ({ id: "lab-1" }) },
    ticket: { create: async () => ({ ...created, lab: { id: "lab-1", name: "Lab Dasar" }, pc: null }) },
    ticketEvent: { create: async ({ data }: { readonly data: unknown }) => { events.push(data); return { id: "event-1" }; } },
    mission: { create: async ({ data }: { readonly data: unknown }) => { missions.push(data); return { id: "mission-1" }; } },
  };
  const restore = transactionWith(tx);
  const restoreCreated = replace(notificationService, "notifyTicketCreated", async () => null);
  const restoreMission = replace(notificationService, "notifyMissionAvailable", async () => null);
  try {
    const result = await TicketReporterService.create({
      labId: "lab-1", reportedBy: "student-1", category: TicketCategory.CPU,
      title: "PC tidak menyala", description: "Laporan awal", priority: TicketPriority.MEDIUM,
    });
    assert.equal(result.id, "ticket-2");
    assert.deepEqual(events, [{
      ticketId: "ticket-2", actorId: "student-1", eventType: "CREATED",
      fromStatus: null, toStatus: "OPEN", fromAssigneeId: null, toAssigneeId: null, note: null,
    }]);
    assert.equal(missions.length, 1);
    assert.equal((missions[0] as { sourceTicketId?: string }).sourceTicketId, "ticket-2");
  } finally {
    restoreMission();
    restoreCreated();
    restore();
  }
});

test("QR reporter creation resolves canonical PC and lab from asset code", async () => {
  let createdData: Record<string, unknown> | undefined;
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
    lab: { findUnique: async () => ({ id: "lab-canonical" }) },
    pC: {
      findUnique: async ({ where }: { readonly where: { readonly assetCode?: string; readonly id?: string } }) => (
        where.assetCode === "ASSET-LABD-PC-001" || where.id === "pc-canonical"
          ? { id: "pc-canonical", labId: "lab-canonical" }
          : null
      ),
      update: async () => ({ id: "pc-canonical" }),
    },
    ticket: {
      findMany: async () => [],
      create: async ({ data }: { readonly data: Record<string, unknown> }) => {
        createdData = data;
        return {
          ...ticket({ id: "ticket-qr", pcId: "pc-canonical", labId: "lab-canonical" }),
          lab: { id: "lab-canonical", name: "Lab Dasar" },
          pc: { id: "pc-canonical", pcCode: "LABD-PC-001" },
        };
      },
    },
    ticketEvent: { create: async () => ({ id: "event-qr" }) },
    mission: { create: async () => ({ id: "mission-qr", title: "Mission QR" }) },
  };
  const restoreTx = transactionWith(tx);
  const restoreCreated = replace(notificationService, "notifyTicketCreated", async () => null);
  const restoreMission = replace(notificationService, "notifyMissionAvailable", async () => null);
  try {
    const result = await TicketReporterService.create({
      assetCode: "ASSET-LABD-PC-001",
      reportedBy: "student-1",
      category: TicketCategory.CPU,
      title: "PC tidak menyala",
    });
    assert.equal(result.id, "ticket-qr");
    assert.equal(createdData?.pcId, "pc-canonical");
    assert.equal(createdData?.labId, "lab-canonical");
  } finally {
    restoreMission();
    restoreCreated();
    restoreTx();
  }
});

test("same active PC fault is rejected while a different fault remains allowed", async () => {
  const writes: string[] = [];
  const active = ticket({
    id: "ticket-existing",
    pcId: "pc-1",
    category: TicketCategory.CPU,
    title: "PC tidak menyala",
    reportedBy: "student-2",
  });
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
    lab: { findUnique: async () => ({ id: "lab-1" }) },
    pC: {
      findUnique: async () => ({ id: "pc-1", labId: "lab-1" }),
      update: async () => { writes.push("pc"); },
    },
    ticket: {
      findMany: async () => [active],
      create: async ({ data }: { readonly data: { readonly title: string } }) => {
        writes.push("ticket");
        return { ...ticket({ id: "ticket-new", pcId: "pc-1", title: data.title }), lab: { id: "lab-1", name: "Lab" }, pc: { id: "pc-1", pcCode: "PC-01" } };
      },
    },
    ticketEvent: { create: async () => ({ id: "event-1" }) },
    mission: { create: async () => ({ id: "mission-1", title: "Mission" }) },
  };
  const restoreTx = transactionWith(tx);
  const restoreCreated = replace(notificationService, "notifyTicketCreated", async () => null);
  const restoreMission = replace(notificationService, "notifyMissionAvailable", async () => null);
  try {
    await assert.rejects(TicketReporterService.create({
      labId: "lab-1", pcId: "pc-1", reportedBy: "student-1", category: TicketCategory.CPU,
      title: "  PC TIDAK   MENYALA!  ",
    }), TicketDuplicateError);
    assert.deepEqual(writes, []);

    tx.ticket.findMany = async () => [];
    const created = await TicketReporterService.create({
      labId: "lab-1", pcId: "pc-1", reportedBy: "student-1", category: TicketCategory.CPU,
      title: "Kipas CPU berbunyi keras",
    });
    assert.equal(created.id, "ticket-new");
    assert.deepEqual(writes, ["pc", "ticket"]);
  } finally {
    restoreMission();
    restoreCreated();
    restoreTx();
  }
});

test("unique-key race is converted to a privacy-aware duplicate error", async () => {
  const existing = { id: "ticket-existing", status: TicketStatus.OPEN, createdAt: new Date(), reportedBy: "student-2" };
  const restoreTx = replace(prisma, "$transaction", async () => {
    throw new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" });
  });
  const restoreLookup = replace(prisma.ticket, "findFirst", async () => existing);
  try {
    await assert.rejects(TicketReporterService.create({
      labId: "lab-1", pcId: "pc-1", reportedBy: "student-1", category: TicketCategory.CPU,
      title: "PC tidak menyala",
    }), (error: unknown) => error instanceof TicketDuplicateError && error.existingTicket.id === existing.id);
  } finally {
    restoreLookup();
    restoreTx();
  }
});

test("reporter title edit recomputes duplicate identity and blocks legacy null-key matches", async () => {
  const current = ticket({ pcId: "pc-1", activeDuplicateKey: "old-key" });
  let updated = false;
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
    ticket: {
      findUnique: async () => current,
      findMany: async () => [{
        id: "ticket-2", status: TicketStatus.OPEN, createdAt: new Date(), reportedBy: "student-2",
        title: "Monitor mati total", activeDuplicateKey: null,
      }],
      updateMany: async () => { updated = true; return { count: 1 }; },
    },
  };
  const restore = transactionWith(tx);
  try {
    await assert.rejects(
      TicketReporterService.update("ticket-1", { title: "MONITOR mati total!" }, "student-1"),
      TicketDuplicateError,
    );
    assert.equal(updated, false);
  } finally {
    restore();
  }
});

test("reporter creation and edit roll back when event append fails", async () => {
  const committedTicketIds: string[] = [];
  let committed = ticket();
  const restore = replace(prisma, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => {
    const stagedTicketIds: string[] = [];
    let staged = committed;
    const tx = {
      lab: { findUnique: async () => ({ id: "lab-1" }) },
      user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: true }) },
      ticket: {
        create: async () => {
          stagedTicketIds.push("ticket-2");
          return { ...ticket({ id: "ticket-2" }), lab: { id: "lab-1", name: "Lab Dasar" }, pc: null };
        },
        findUnique: async () => staged,
        updateMany: async () => { staged = { ...staged, title: "PC mati total" }; return { count: 1 }; },
        findUniqueOrThrow: async () => staged,
      },
      ticketEvent: { create: async () => { throw new Error("event write failed"); } },
      mission: { create: async () => ({ id: "mission-1" }) },
    };
    const result = await operation(tx);
    committedTicketIds.push(...stagedTicketIds);
    committed = staged;
    return result;
  });
  try {
    await assert.rejects(
      TicketReporterService.create({ labId: "lab-1", reportedBy: "student-1", category: TicketCategory.CPU, title: "PC tidak menyala" }),
      /event write failed/,
    );
    await assert.rejects(
      TicketReporterService.update("ticket-1", { title: "PC mati total" }, "student-1"),
      /event write failed/,
    );
    assert.deepEqual(committedTicketIds, []);
    assert.equal(committed.title, "PC tidak menyala");
  } finally {
    restore();
  }
});

test("reporter creation requires a persisted active reporter", async () => {
  let writes = 0;
  const tx = {
    user: { findUnique: async () => ({ id: "student-1", role: "MAHASISWA", isActive: false }) },
    lab: { findUnique: async () => { writes += 1; return { id: "lab-1" }; } },
  };
  const restore = transactionWith(tx);
  try {
    await assert.rejects(
      TicketReporterService.create({ labId: "lab-1", reportedBy: "student-1", category: TicketCategory.CPU, title: "PC tidak menyala" }),
      /Akun aktif diperlukan/,
    );
    assert.equal(writes, 0);
  } finally {
    restore();
  }
});
