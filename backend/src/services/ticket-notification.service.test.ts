import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { notificationService } from "./notification.service";

type Restore = () => void;

type NotificationInput = {
  readonly userId: string;
  readonly type: string;
  readonly metadata?: Record<string, unknown>;
  readonly reminderKey?: string;
};

function replace(target: object, key: string, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("ticket status notifications use detail links and event-scoped keys", async () => {
  const inputs: NotificationInput[] = [];
  const restore = replace(notificationService, "create", async (input: NotificationInput) => {
    inputs.push(input);
    return input;
  });
  try {
    await notificationService.notifyTicketReporterInProgress("student-1", "PC mati", "ticket-1", "event-1");
    await notificationService.notifyTicketWaiting("student-1", "PC mati", "ticket-1", "event-2");
    await notificationService.notifyTicketResumed("student-1", "PC mati", "ticket-1", "event-3");
    await notificationService.notifyTicketResolved("student-1", "PC mati", "ticket-1", "event-4");
    await notificationService.notifyTicketRejected("student-1", "PC mati", "ticket-1", "event-5");
    assert.deepEqual(inputs.map(({ userId, type, metadata, reminderKey }) => ({ userId, type, metadata, reminderKey })), [
      { userId: "student-1", type: "SYSTEM", metadata: { ticketId: "ticket-1", ticketEventId: "event-1", link: "/tickets/ticket-1" }, reminderKey: "ticket:in-progress:event-1:student-1" },
      { userId: "student-1", type: "SYSTEM", metadata: { ticketId: "ticket-1", ticketEventId: "event-2", link: "/tickets/ticket-1" }, reminderKey: "ticket:waiting:event-2:student-1" },
      { userId: "student-1", type: "SYSTEM", metadata: { ticketId: "ticket-1", ticketEventId: "event-3", link: "/tickets/ticket-1" }, reminderKey: "ticket:resumed:event-3:student-1" },
      { userId: "student-1", type: "TICKET_RESOLVED", metadata: { ticketId: "ticket-1", ticketEventId: "event-4", link: "/tickets/ticket-1" }, reminderKey: "ticket:resolved:event-4:student-1" },
      { userId: "student-1", type: "SYSTEM", metadata: { ticketId: "ticket-1", ticketEventId: "event-5", link: "/tickets/ticket-1" }, reminderKey: "ticket:rejected:event-5:student-1" },
    ]);
  } finally {
    restore();
  }
});

test("created and linked mission notifications use stable ticket keys and tolerate retries", async () => {
  const inputs: NotificationInput[] = [];
  const restoreUsers = replace(prisma.user, "findMany", async () => [{ id: "assistant-1" }, { id: "assistant-2" }]);
  const restoreCreate = replace(notificationService, "create", async (input: NotificationInput) => {
    inputs.push(input);
    if (inputs.filter((item) => item.reminderKey === input.reminderKey).length > 1) {
      throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
    }
    return input;
  });
  try {
    await notificationService.notifyTicketCreated("student-1", "PC mati", "ticket-1", "event-1");
    await notificationService.notifyMissionAvailable("Perbaiki PC", "mission-1", "ticket-1");
    await notificationService.notifyMissionAvailable("Perbaiki PC", "mission-1", "ticket-1");
    assert.deepEqual(inputs.map((item) => item.reminderKey), [
      "ticket:created:event-1:student-1",
      "ticket:mission:ticket-1:assistant-1",
      "ticket:mission:ticket-1:assistant-2",
      "ticket:mission:ticket-1:assistant-1",
      "ticket:mission:ticket-1:assistant-2",
    ]);
    assert.equal(inputs[0]?.metadata?.link, "/tickets/ticket-1");
  } finally {
    restoreCreate();
    restoreUsers();
  }
});

test("assignee notification keeps ticket assignment type and event-scoped key", async () => {
  const inputs: NotificationInput[] = [];
  const restore = replace(notificationService, "create", async (input: NotificationInput) => {
    inputs.push(input);
    return input;
  });
  try {
    await notificationService.notifyTicketAssigned("assistant-1", "PC mati", "ticket-1", "event-1");
    assert.deepEqual(inputs.map(({ userId, type, metadata, reminderKey }) => ({ userId, type, metadata, reminderKey })), [{
      userId: "assistant-1",
      type: "TICKET_ASSIGNED",
      metadata: { ticketId: "ticket-1", ticketEventId: "event-1", link: "/tickets/ticket-1" },
      reminderKey: "ticket:assigned:event-1:assistant-1",
    }]);
  } finally {
    restore();
  }
});
