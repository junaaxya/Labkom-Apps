import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { ApprovalConflictError } from "./approval-conflict.error";
import { ScheduleChangeService } from "./schedule-change.service";

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

function rescheduleRequest() {
  return {
    id: "change-1",
    status: "PENDING",
    requestType: "RESCHEDULE",
    scheduleId: "schedule-1",
    newDay: "SELASA",
    newStartTime: "09:00",
    newEndTime: "10:00",
    newLabId: "lab-b",
    schedule: {
      id: "schedule-1",
      labId: "lab-a",
      specificDate: new Date("2026-10-13T00:00:00.000Z"),
    },
  };
}

test("RESCHEDULE re-reads PENDING request inside Serializable transaction and excludes source schedule", async () => {
  const request = rescheduleRequest();
  let scheduleWhere: unknown;
  let bookingWhere: unknown;
  let scheduleUpdate: unknown;
  let requestUpdate: unknown;
  const transactionOptions: unknown[] = [];
  const tx = {
    scheduleChangeRequest: {
      findUnique: async () => request,
      update: async ({ data }: { data: unknown }) => {
        requestUpdate = data;
        return { id: request.id, data };
      },
    },
    schedule: {
      findFirst: async ({ where }: { where: unknown }) => {
        scheduleWhere = where;
        return null;
      },
      update: async ({ data }: { data: unknown }) => {
        scheduleUpdate = data;
        return data;
      },
    },
    labBooking: {
      findFirst: async ({ where }: { where: unknown }) => {
        bookingWhere = where;
        return null;
      },
    },
    auditLog: { create: async () => ({ id: "audit-1" }) },
  };
  const restoreRequest = replaceProperty(prisma.scheduleChangeRequest, "findUnique", async () => ({ requestType: "RESCHEDULE" }));
  const restoreSchedules = replaceProperty(prisma.schedule, "findMany", async () => []);
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>, options: unknown) => {
      transactionOptions.push(options);
      return operation(tx);
    },
  );

  try {
    await ScheduleChangeService.approveRequest(request.id, "coordinator-1", "Approved");

    assert.deepEqual(transactionOptions, [{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }]);
    assert.deepEqual(scheduleWhere, {
      labId: "lab-b",
      isActive: true,
      status: { in: ["SCHEDULED", "ONGOING"] },
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      OR: [
        { specificDate: request.schedule.specificDate },
        { specificDate: null, day: "SELASA" },
      ],
      id: { not: "schedule-1" },
    });
    assert.deepEqual(bookingWhere, {
      labId: "lab-b",
      status: "APPROVED",
      startTime: { lt: "10:00" },
      endTime: { gt: "09:00" },
      date: request.schedule.specificDate,
    });
    assert.deepEqual(scheduleUpdate, {
      day: "SELASA",
      startTime: "09:00",
      endTime: "10:00",
      labId: "lab-b",
    });
    assert.deepEqual(requestUpdate, {
      status: "APPROVED",
      approvedById: "coordinator-1",
      adminNotes: "Approved",
      rejectionReason: null,
    });
  } finally {
    restoreTransaction();
    restoreRequest();
    restoreSchedules();
  }
});

test("RESCHEDULE rejects a request no longer PENDING after transaction re-read", async () => {
  let conflictReads = 0;
  let writes = 0;
  const tx = {
    scheduleChangeRequest: {
      findUnique: async () => ({
        id: "change-3",
        status: "APPROVED",
        requestType: "RESCHEDULE",
        scheduleId: "schedule-1",
        newDay: "SELASA",
        newStartTime: "09:00",
        newEndTime: "10:00",
        newLabId: null,
        schedule: null,
      }),
      update: async () => {
        writes += 1;
        return {};
      },
    },
    schedule: {
      findFirst: async () => {
        conflictReads += 1;
        return null;
      },
      update: async () => {
        writes += 1;
        return {};
      },
    },
    labBooking: {
      findFirst: async () => {
        conflictReads += 1;
        return null;
      },
    },
    auditLog: { create: async () => ({ id: "audit-1" }) },
  };
  const restoreRequest = replaceProperty(prisma.scheduleChangeRequest, "findUnique", async () => ({ requestType: "RESCHEDULE" }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      ScheduleChangeService.approveRequest("change-3", "coordinator-1"),
      /PENDING/,
    );
    assert.equal(conflictReads, 0);
    assert.equal(writes, 0);
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});

test("EXTRA_SLOT stops before create when shared occupancy check finds a collision", async () => {
  let scheduleCreates = 0;
  let requestUpdates = 0;
  const tx = {
    scheduleChangeRequest: {
      findUnique: async () => ({
        id: "change-2",
        status: "PENDING",
        requestType: "EXTRA_SLOT",
        scheduleId: "schedule-1",
        newDay: "SELASA",
        newStartTime: "09:00",
        newEndTime: "10:00",
        newLabId: null,
        schedule: null,
      }),
      update: async () => {
        requestUpdates += 1;
        return {};
      },
    },
    schedule: {
      findUnique: async () => ({
        labId: "lab-a",
        title: "Source class",
        semester: "Ganjil",
        className: "TI-1",
        lecturerName: "Lecturer",
        assistantId: "assistant-1",
      }),
      findFirst: async () => ({ title: "Occupied", startTime: "09:30", endTime: "10:30" }),
      create: async () => {
        scheduleCreates += 1;
        return {};
      },
    },
    labBooking: {
      findMany: async () => [],
    },
    auditLog: { create: async () => ({ id: "audit-1" }) },
  };
  const restoreRequest = replaceProperty(prisma.scheduleChangeRequest, "findUnique", async () => ({ requestType: "EXTRA_SLOT" }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await assert.rejects(
      ScheduleChangeService.approveRequest("change-2", "coordinator-1"),
      ApprovalConflictError,
    );
    assert.equal(scheduleCreates, 0);
    assert.equal(requestUpdates, 0);
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});
