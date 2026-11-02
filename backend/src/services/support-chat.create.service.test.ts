import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { notificationService } from "./notification.service";
import { SupportChatError } from "./support-chat.error";
import { SupportChatService } from "./support-chat.service";

type Restore = () => void;

function replaceProperty(target: object, property: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  };
}

function restoreAll(restores: readonly Restore[]): void { [...restores].reverse().forEach((restore) => restore()); }

const student = { id: "student-auth", name: "Mahasiswa", role: "MAHASISWA" } as const;
const firstAssistant = { id: "assistant-first", name: "Asisten Pertama", role: "ASISTEN_LAB" } as const;
const secondAssistant = { id: "assistant-second", name: "Asisten Kedua", role: "ASISTEN_LAB" } as const;
const now = new Date("2026-10-13T03:30:00.000Z");

type DutyQuery = {
  readonly where: {
    readonly labId: string;
    readonly scheduleDate: { readonly in: readonly Date[] };
    readonly status: string;
    readonly user: { readonly role: string; readonly isActive: boolean };
    readonly shift: { readonly isActive: boolean };
  };
  readonly orderBy: readonly unknown[];
};

type CreateQuery = {
  readonly data: {
    readonly pcId: string;
    readonly labId: string;
    readonly studentId: string;
    readonly assignedAssistantId: null;
    readonly status: string;
    readonly lastMessageAt: Date;
    readonly recipients: { readonly create: readonly { readonly assistantId: string; readonly shiftScheduleId: string }[] };
    readonly messages: { readonly create: { readonly senderId: string; readonly body: string } };
  };
};

type CreateTransaction = {
  readonly pC: { readonly findUnique: (query: unknown) => Promise<unknown> };
  readonly asLabShiftSchedule: { readonly findMany: (query: DutyQuery) => Promise<readonly unknown[]> };
  readonly supportChat: { readonly create: (query: CreateQuery) => Promise<unknown> };
};

function createdChat() {
  return {
    id: "chat-1",
    status: "WAITING" as const,
    studentId: student.id,
    assignedAssistantId: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    pc: { id: "pc-1", pcCode: "LAB-PC-01", name: "PC 01" },
    lab: { id: "lab-1", name: "Lab Dasar" },
    student,
    assignedAssistant: null,
    messages: [{
      id: "message-1",
      chatId: "chat-1",
      senderId: student.id,
      body: "Perlu bantuan",
      createdAt: now,
      sender: student,
    }],
  };
}

test("createChat persists every distinct active-duty assistant as an unclaimed recipient and notifies each once after commit", async () => {
  let dutyQuery: DutyQuery | undefined;
  let createQuery: CreateQuery | undefined;
  const notifications: unknown[] = [];
  const events: string[] = [];
  const transaction: CreateTransaction = {
    pC: {
      findUnique: async () => ({
        id: "pc-1",
        labId: "lab-1",
        pcCode: "LAB-PC-01",
        lab: { id: "lab-1", name: "Lab Dasar" },
      }),
    },
    asLabShiftSchedule: {
      findMany: async (query) => {
        dutyQuery = query;
        return [
          { id: "schedule-first", userId: firstAssistant.id, scheduleDate: new Date("2026-10-13T00:00:00.000Z"), shift: { startTime: "08:00", endTime: "12:00" } },
          { id: "schedule-first-duplicate", userId: firstAssistant.id, scheduleDate: new Date("2026-10-13T00:00:00.000Z"), shift: { startTime: "08:00", endTime: "12:00" } },
          { id: "schedule-second", userId: "assistant-second", scheduleDate: new Date("2026-10-13T00:00:00.000Z"), shift: { startTime: "09:00", endTime: "12:00" } },
        ];
      },
    },
    supportChat: {
      create: async (query) => {
        createQuery = query;
        events.push("chat");
        return createdChat();
      },
    },
  };
  const restores = [
    replaceProperty(prisma, "$transaction", async (callback: (tx: CreateTransaction) => Promise<unknown>) => callback(transaction)),
    replaceProperty(notificationService, "notifySupportChatAssigned", async (input: unknown) => {
      events.push("notification");
      notifications.push(input);
      return { count: 2 };
    }),
  ];

  try {
    const created = await SupportChatService.createChat(student.id, { pcId: "pc-1", body: "Perlu bantuan" }, now);
    assert.equal(created.status, "WAITING");
    assert.deepEqual(dutyQuery?.where, {
      labId: "lab-1",
      scheduleDate: { in: [new Date("2026-10-12T00:00:00.000Z"), new Date("2026-10-13T00:00:00.000Z")] },
      status: "SCHEDULED",
      user: { role: "ASISTEN_LAB", isActive: true },
      shift: { isActive: true },
    });
    assert.deepEqual(dutyQuery?.orderBy, [{ shift: { startTime: "asc" } }, { id: "asc" }]);
    assert.deepEqual(createQuery?.data, {
      pcId: "pc-1",
      labId: "lab-1",
      studentId: student.id,
      assignedAssistantId: null,
      status: "WAITING",
      lastMessageAt: now,
      recipients: {
        create: [
          { assistantId: firstAssistant.id, shiftScheduleId: "schedule-first" },
          { assistantId: secondAssistant.id, shiftScheduleId: "schedule-second" },
        ],
      },
      messages: { create: { senderId: student.id, body: "Perlu bantuan" } },
    });
    assert.deepEqual(events, ["chat", "notification"]);
    assert.deepEqual(notifications, [
      {
        assistantIds: [firstAssistant.id, secondAssistant.id],
        chatId: "chat-1",
        studentName: student.name,
        pcCode: "LAB-PC-01",
        labName: "Lab Dasar",
      },
    ]);
  } finally {
    restoreAll(restores);
  }
});

test("createChat rejects a missing PC before duty lookup and writes nothing", async () => {
  let dutyLookups = 0;
  let chatWrites = 0;
  let notifications = 0;
  const transaction: CreateTransaction = {
    pC: { findUnique: async () => null },
    asLabShiftSchedule: { findMany: async () => { dutyLookups += 1; return []; } },
    supportChat: { create: async () => { chatWrites += 1; return createdChat(); } },
  };
  const restores = [
    replaceProperty(prisma, "$transaction", async (callback: (tx: CreateTransaction) => Promise<unknown>) => callback(transaction)),
    replaceProperty(notificationService, "notifySupportChatAssigned", async () => { notifications += 1; }),
  ];

  try {
    await assert.rejects(
      SupportChatService.createChat(student.id, { pcId: "missing-pc", body: "Perlu bantuan" }, now),
      (error: unknown) => error instanceof SupportChatError && error.code === "PC_NOT_FOUND",
    );
    assert.equal(dutyLookups, 0);
    assert.equal(chatWrites, 0);
    assert.equal(notifications, 0);
  } finally {
    restoreAll(restores);
  }
});

test("createChat rejects an inactive shift window with no chat, message, or notification write", async () => {
  let chatWrites = 0;
  let notifications = 0;
  const transaction: CreateTransaction = {
    pC: {
      findUnique: async () => ({
        id: "pc-1",
        labId: "lab-1",
        pcCode: "LAB-PC-01",
        lab: { id: "lab-1", name: "Lab Dasar" },
      }),
    },
    asLabShiftSchedule: {
      findMany: async () => [{
        id: "future-schedule",
        userId: firstAssistant.id,
        scheduleDate: new Date("2026-10-13T00:00:00.000Z"),
        shift: { startTime: "11:00", endTime: "12:00" },
      }],
    },
    supportChat: { create: async () => { chatWrites += 1; return createdChat(); } },
  };
  const restores = [
    replaceProperty(prisma, "$transaction", async (callback: (tx: CreateTransaction) => Promise<unknown>) => callback(transaction)),
    replaceProperty(notificationService, "notifySupportChatAssigned", async () => { notifications += 1; }),
  ];

  try {
    await assert.rejects(
      SupportChatService.createChat(student.id, { pcId: "pc-1", body: "Perlu bantuan" }, now),
      (error: unknown) => error instanceof SupportChatError && error.code === "NO_CURRENT_DUTY",
    );
    assert.equal(chatWrites, 0);
    assert.equal(notifications, 0);
  } finally {
    restoreAll(restores);
  }
});

test("createChat resolves an active overnight duty from the prior Jakarta date", async () => {
  const overnightNow = new Date("2026-10-12T18:00:00.000Z");
  let dutyQuery: DutyQuery | undefined;
  let createQuery: CreateQuery | undefined;
  const transaction: CreateTransaction = {
    pC: {
      findUnique: async () => ({
        id: "pc-1",
        labId: "lab-1",
        pcCode: "LAB-PC-01",
        lab: { id: "lab-1", name: "Lab Dasar" },
      }),
    },
    asLabShiftSchedule: {
      findMany: async (query) => {
        dutyQuery = query;
        return [{
          id: "overnight-schedule",
          userId: firstAssistant.id,
          scheduleDate: new Date("2026-10-12T00:00:00.000Z"),
          shift: { startTime: "22:00", endTime: "06:00" },
        }];
      },
    },
    supportChat: {
      create: async (query) => {
        createQuery = query;
        return createdChat();
      },
    },
  };
  const restores = [
    replaceProperty(prisma, "$transaction", async (callback: (tx: CreateTransaction) => Promise<unknown>) => callback(transaction)),
    replaceProperty(notificationService, "notifySupportChatAssigned", async () => ({ id: "notification-1" })),
  ];

  try {
    await SupportChatService.createChat(student.id, { pcId: "pc-1", body: "Perlu bantuan" }, overnightNow);
    assert.deepEqual(dutyQuery?.where.scheduleDate, {
      in: [new Date("2026-10-12T00:00:00.000Z"), new Date("2026-10-13T00:00:00.000Z")],
    });
    assert.deepEqual(createQuery?.data.recipients, { create: [{ assistantId: firstAssistant.id, shiftScheduleId: "overnight-schedule" }] });
  } finally {
    restoreAll(restores);
  }
});
