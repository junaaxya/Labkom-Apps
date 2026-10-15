import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import prisma from "../config/database";
import { ApprovalConflictError } from "../services/approval-conflict.error";
import { AccessRequestService } from "../services/access-request.service";
import { BookingService } from "../services/booking.service";
import { AccessRequestController } from "./access-request.controller";
import { BookingController } from "./booking.controller";
import { ScheduleChangeController } from "./schedule-change.controller";

type ControllerResult = {
  status?: number;
  body?: unknown;
};

function createResponse(result: ControllerResult): Response {
  return {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;
}

function coordinatorRequest(body?: unknown): Request {
  return {
    params: { id: "request-1" },
    user: { userId: "coordinator-1", role: "KOORDINATOR_LAB" },
    ...(body === undefined ? {} : { body }),
  } as unknown as Request;
}

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

test("booking approval controller maps service conflict to 409 with its stable message", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(BookingService, "approveBooking", async () => {
    throw new ApprovalConflictError("Booking conflict");
  });

  try {
    await BookingController.approveBooking(coordinatorRequest(), createResponse(result));
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { success: false, message: "Booking conflict" });
  } finally {
    restore();
  }
});

test("booking approval controller maps missing booking to 404", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(BookingService, "approveBooking", async () => {
    throw new Error("Pengajuan peminjaman tidak ditemukan");
  });

  try {
    await BookingController.approveBooking(coordinatorRequest(), createResponse(result));
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { success: false, message: "Pengajuan peminjaman tidak ditemukan" });
  } finally {
    restore();
  }
});

test("booking rejection controller maps missing booking to 404", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(BookingService, "rejectBooking", async () => {
    throw new Error("Pengajuan peminjaman tidak ditemukan");
  });

  try {
    await BookingController.rejectBooking(
      coordinatorRequest({ reason: "Tidak memenuhi syarat" }),
      createResponse(result),
    );
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { success: false, message: "Pengajuan peminjaman tidak ditemukan" });
  } finally {
    restore();
  }
});

test("booking approval controller keeps non-PENDING errors at 400", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(BookingService, "approveBooking", async () => {
    throw new Error("Hanya pengajuan berstatus PENDING yang dapat disetujui");
  });

  try {
    await BookingController.approveBooking(coordinatorRequest(), createResponse(result));
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { success: false, message: "Hanya pengajuan berstatus PENDING yang dapat disetujui" });
  } finally {
    restore();
  }
});

test("booking rejection controller keeps non-PENDING errors at 400", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(BookingService, "rejectBooking", async () => {
    throw new Error("Hanya pengajuan berstatus PENDING yang dapat ditolak");
  });

  try {
    await BookingController.rejectBooking(
      coordinatorRequest({ reason: "Tidak memenuhi syarat" }),
      createResponse(result),
    );
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { success: false, message: "Hanya pengajuan berstatus PENDING yang dapat ditolak" });
  } finally {
    restore();
  }
});

test("access-request review controller maps lab approval conflict to 409 with its stable message", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(AccessRequestService, "reviewRequest", async () => {
    throw new ApprovalConflictError("Access request conflict");
  });

  try {
    await AccessRequestController.review(
      coordinatorRequest({ status: "APPROVED", reviewerNotes: "Checked." }),
      createResponse(result),
    );
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { success: false, message: "Access request conflict" });
  } finally {
    restore();
  }
});

test("access-request review controller maps missing target to 404", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(AccessRequestService, "reviewRequest", async () => {
    throw new Error("Pengajuan tidak ditemukan");
  });

  try {
    await AccessRequestController.review(
      coordinatorRequest({ status: "APPROVED", reviewerNotes: "Checked." }),
      createResponse(result),
    );
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { success: false, message: "Pengajuan tidak ditemukan" });
  } finally {
    restore();
  }
});

test("access-request review controller keeps non-PENDING errors at 400", async () => {
  const result: ControllerResult = {};
  const restore = replaceProperty(AccessRequestService, "reviewRequest", async () => {
    throw new Error("Hanya pengajuan PENDING atau REVISION yang dapat diproses");
  });

  try {
    await AccessRequestController.review(
      coordinatorRequest({ status: "APPROVED", reviewerNotes: "Checked." }),
      createResponse(result),
    );
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, { success: false, message: "Hanya pengajuan PENDING atau REVISION yang dapat diproses" });
  } finally {
    restore();
  }
});

test("schedule-change approval controller maps occupancy conflict to 409", async () => {
  const result: ControllerResult = {};
  const tx = {
    scheduleChangeRequest: {
      findUnique: async () => ({
        id: "request-1",
        status: "PENDING",
        requestType: "RESCHEDULE",
        scheduleId: "schedule-1",
        newDay: "SELASA",
        newStartTime: "09:00",
        newEndTime: "10:00",
        newLabId: null,
        schedule: {
          id: "schedule-1",
          labId: "lab-a",
          specificDate: null,
        },
      }),
      update: async () => ({ id: "request-1" }),
    },
    schedule: {
      findFirst: async () => ({ title: "Occupied", startTime: "09:30", endTime: "10:30" }),
      update: async () => ({ id: "schedule-1" }),
    },
    labBooking: {
      findMany: async () => [],
    },
  };
  const restoreRequest = replaceProperty(prisma.scheduleChangeRequest, "findUnique", async () => ({ requestType: "RESCHEDULE" }));
  const restoreTransaction = replaceProperty(
    prisma,
    "$transaction",
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
  );

  try {
    await ScheduleChangeController.approveRequest(
      coordinatorRequest({ adminNotes: "Checked." }),
      createResponse(result),
    );
    assert.equal(result.status, 409);
    assert.deepEqual(result.body, { success: false, message: "Jadwal bentrok dengan \"Occupied\" (09:30-10:30)" });
  } finally {
    restoreTransaction();
    restoreRequest();
  }
});
