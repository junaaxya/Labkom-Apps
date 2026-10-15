import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(name: string): string {
  return readFileSync(path.join(__dirname, name), "utf8");
}

function method(sourceText: string, start: string, end: string): string {
  const startIndex = sourceText.indexOf(start);
  const endIndex = sourceText.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, start);
  assert.notEqual(endIndex, -1, end);
  return sourceText.slice(startIndex, endIndex);
}

test("shared occupancy policy owns Serializable P2034 retry and operational overlap rules", () => {
  const availability = source("schedule-availability.ts");

  assert.match(availability, /export const SERIALIZABLE_RETRY_LIMIT = 2;/);
  assert.match(availability, /prisma\.\$transaction\(operation, \{ isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable \}\)/);
  assert.match(availability, /error instanceof Prisma\.PrismaClientKnownRequestError && error\.code === "P2034"/);
  assert.match(availability, /isActive: true,/);
  assert.match(availability, /status: \{ in: \[\.\.\.OPERATIONAL_SCHEDULE_STATUSES\] \}/);
  assert.match(availability, /startTime: \{ lt: candidate\.endTime \}/);
  assert.match(availability, /endTime: \{ gt: candidate\.startTime \}/);
  assert.match(availability, /\{ specificDate: candidate\.specificDate \}/);
  assert.match(availability, /\{ specificDate: null, day: candidate\.day \}/);
  assert.match(availability, /: \{ day: candidate\.day \}/);
  assert.match(availability, /status: "APPROVED"/);
  assert.match(availability, /bookings\.find\(\(item\) => weekdayForDateOnly\(item\.date\) === candidate\.day\)/);
});

test("all active occupancy writers use shared transaction protocol without local retry helpers", () => {
  const booking = source("booking.service.ts");
  const accessRequest = source("access-request.service.ts");
  const schedule = source("schedule.service.ts");
  const scheduleChange = source("schedule-change.service.ts");

  const bookingApproval = method(booking, "static async approveBooking", "static async rejectBooking");
  const accessLabApproval = method(accessRequest, "if (input.status === \"APPROVED\" && request.type === \"PEMINJAMAN_LAB\")", "if (input.status !== \"APPROVED\")");
  const scheduleCreate = method(schedule, "static async createSchedule", "static async updateSchedule");
  const scheduleUpdate = method(schedule, "static async updateSchedule", "static async updateStatus");
  const scheduleStatus = method(schedule, "static async updateStatus", "static async deleteSchedule");
  const scheduleChangeApproval = method(scheduleChange, "static async approveRequest", "static async rejectRequest");

  for (const writer of [bookingApproval, accessLabApproval, scheduleCreate, scheduleUpdate, scheduleStatus]) {
    assert.match(writer, /withSerializableRetry\(async \(tx\) =>/);
  }

  assert.match(bookingApproval, /findOccupancyConflict\(\s*tx,/);
  assert.match(accessLabApproval, /findOccupancyConflict\(tx,/);
  assert.match(scheduleCreate, /this\.checkConflict\(tx,/);
  assert.match(scheduleUpdate, /this\.checkConflict\(tx,/);
  assert.match(schedule, /const occupancyConflict = await findOccupancyConflict\(tx, occupancyCandidate/);
  assert.match(scheduleStatus, /findOccupancyConflict\(tx,/);

  assert.match(scheduleChangeApproval, /withSerializableRetry\(async \(tx\) =>/);
  assert.match(scheduleChangeApproval, /const request = await tx\.scheduleChangeRequest\.findUnique/);
  assert.match(scheduleChangeApproval, /status !== "PENDING"/);
  assert.match(scheduleChangeApproval, /excludeScheduleId: request\.schedule\.id/);
  assert.match(scheduleChangeApproval, /specificDate: request\.schedule\.specificDate/);
  assert.match(scheduleChangeApproval, /specificDate: null/);
  assert.match(scheduleStatus, /const currentSchedule = await tx\.schedule\.findUnique/);
  assert.match(scheduleStatus, /tx\.schedule\.update/);

  for (const service of [booking, accessRequest, schedule, scheduleChange]) {
    assert.doesNotMatch(service, /private static async withSerializableRetry/);
  }
});
