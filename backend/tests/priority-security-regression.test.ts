import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createTicketSchema } from "../src/validators/ticket.validator";

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Google Calendar OAuth uses an opaque one-time Redis state instead of a raw user id", () => {
  const service = read("src/services/google-calendar.service.ts");
  const controller = read("src/controllers/calendar.controller.ts");

  assert.match(service, /createCalendarOAuthState/);
  assert.match(service, /consumeCalendarOAuthState/);
  assert.match(service, /randomBytes\(/);
  assert.match(service, /redis\.set\([\s\S]*"EX"[\s\S]*"NX"/);
  assert.match(service, /redis\.getdel\(/);
  assert.doesNotMatch(service, /state:\s*userId/);
  assert.doesNotMatch(service, /private\s+oauth2Client/);
  assert.match(controller, /consumeCalendarOAuthState\(state\)/);
});

test("ticket creation validates input and atomically updates PC, ticket, and mission", () => {
  const controller = read("src/controllers/ticket.controller.ts");
  const service = read("src/services/ticket.service.ts");

  assert.match(controller, /createTicketSchema\.parse\(req\.body\)/);
  assert.match(service, /prisma\.\$transaction\(async\s*\(tx\)/);
  assert.match(service, /PC tidak berada di lab yang dipilih/);
  assert.doesNotMatch(service, /mission\.create\([\s\S]*?\.catch\(\(\)\s*=>\s*\{\}\)/);
});

test("ticket schema rejects invalid input and strips identity fields supplied by clients", () => {
  assert.throws(() => createTicketSchema.parse({ labId: "lab-1", category: "INVALID", title: "ok" }));
  assert.throws(() => createTicketSchema.parse({ labId: "lab-1", category: "MOUSE", title: "   " }));
  assert.throws(() => createTicketSchema.parse({ labId: "lab-1", category: "MOUSE", title: "Valid", photo: ["https://example.com/tracker.jpg"] }));

  const parsed = createTicketSchema.parse({
    labId: "lab-1",
    category: "MOUSE",
    title: "Mouse tidak berfungsi",
    reportedBy: "user-palsu",
  });
  assert.equal("reportedBy" in parsed, false);
});

test("cron is explicitly scheduled in WIB and attendance reminders use assigned shifts", () => {
  const cronSource = read("src/services/cron.service.ts");
  const attendanceSource = read("src/services/attendance.service.ts");
  const notificationSource = read("src/services/notification.service.ts");

  assert.match(cronSource, /const CRON_OPTIONS = \{ timezone: "Asia\/Jakarta" \}/);
  const schedules = cronSource.match(/cron\.schedule\(/g) ?? [];
  const timezoneOptions = cronSource.match(/CRON_OPTIONS\s*\)/g) ?? [];
  assert.equal(timezoneOptions.length, schedules.length, "setiap node-cron schedule harus memakai timezone WIB");
  assert.match(cronSource, /asLabShiftSchedule\.findMany/);
  assert.match(cronSource, /scheduleDate:/);
  assert.match(cronSource, /checkAttendanceReminder\(\)[\s\S]*evaluateShiftWindow/);

  const picketReminderFunction = attendanceSource.match(/static async getUpcomingPicketReminders[\s\S]*?\n  }/)?.[0] ?? "";
  assert.match(picketReminderFunction, /evaluateShiftWindow/);
  assert.doesNotMatch(picketReminderFunction, /\.setHours\(|\.getHours\(/);
  assert.match(notificationSource, /reminderKey: `schedule:\$\{scheduleId\}:\$\{businessDate\}:15m`/);
});
