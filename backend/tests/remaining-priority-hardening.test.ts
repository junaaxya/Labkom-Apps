import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(process.cwd());
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("Calendar builds stable event IDs and explicit WIB timestamps", async () => {
  const calendar = await import("../src/services/google-calendar-event");
  const schedule = {
    id: "schedule-1",
    title: "Praktikum Basis Data",
    labName: "Lab 1",
    day: "SENIN",
    startTime: "08:00",
    endTime: "10:00",
  };

  const first = calendar.buildGoogleCalendarEvent("user-1", schedule, new Date("2026-09-06T03:00:00.000Z"));
  const second = calendar.buildGoogleCalendarEvent("user-1", schedule, new Date("2026-09-06T04:00:00.000Z"));

  assert.equal(first.id, second.id);
  assert.match(first.id, /^[0-9a-v]{5,1024}$/);
  assert.equal(first.start.dateTime, "2026-09-07T08:00:00+07:00");
  assert.equal(first.end.dateTime, "2026-09-07T10:00:00+07:00");
  assert.equal(first.start.timeZone, "Asia/Jakarta");
});

test("Calendar uses today when a same-day schedule is still upcoming in WIB", async () => {
  const calendar = await import("../src/services/google-calendar-event");
  const event = calendar.buildGoogleCalendarEvent("user-1", {
    id: "schedule-2",
    title: "Piket",
    labName: "Lab 2",
    day: "SENIN",
    startTime: "16:00",
    endTime: "17:00",
  }, new Date("2026-09-07T03:00:00.000Z")); // 10:00 WIB

  assert.equal(event.start.dateTime, "2026-09-07T16:00:00+07:00");
});

test("Calendar sync is upsert-based and schedule lifecycle triggers reconciliation", () => {
  const calendar = read("src/services/google-calendar.service.ts");
  const schedules = read("src/services/schedule.service.ts");
  assert.match(calendar, /events\.update\(/);
  assert.match(calendar, /events\.insert\(/);
  assert.match(calendar, /buildGoogleCalendarEvent/);
  assert.match(schedules, /reconcileScheduleCalendar/);
});

test("Mission claim uses one serializable transaction with a conditional OPEN gate", () => {
  const source = read("src/services/mission.service.ts");
  const claim = source.slice(source.indexOf("static async claimMission"), source.indexOf("static async submitMission"));
  assert.match(claim, /\$transaction/);
  assert.match(claim, /updateMany/);
  assert.match(claim, /status:\s*"OPEN"/);
  assert.match(claim, /updated\.count\s*!==\s*1/);
});

test("Protected file downloads call object-level authorization", () => {
  const source = read("src/routes/file.routes.ts");
  const session = read("src/services/protected-file-session.service.ts");
  const access = read("src/services/protected-file-access.service.ts");
  const frontendApi = read("../frontend/src/services/api.ts");
  assert.match(source, /authorizeProtectedFileAccess/);
  assert.match(source, /req\.user!\.userId/);
  assert.match(source, /req\.user!\.role/);
  assert.match(source, /createProtectedFileSession/);
  assert.match(session, /HttpOnly; SameSite=Strict/);
  assert.match(session, /revokeProtectedFileSession/);
  assert.match(frontendApi, /credentials:\s*"include"/);
  assert.match(access, /item\.proof\?\.trim\(\) === url/);
});

test("SSE uses bearer authentication without query-string JWTs", () => {
  const middleware = read("src/middlewares/auth.middleware.ts");
  const routes = read("src/routes/notification.routes.ts");
  const panel = read("../frontend/src/components/notifications/notification-panel.tsx");
  assert.doesNotMatch(middleware, /authenticateQueryToken/);
  assert.match(routes, /router\.get\("\/stream", authenticate/);
  assert.doesNotMatch(routes, /sse-ticket/);
  assert.doesNotMatch(routes, /consumeSseTicket/);
  assert.doesNotMatch(panel, /stream\?token=/);
  assert.match(panel, /Authorization/);
  assert.doesNotMatch(panel, /EventSource/);
});

test("Calendar reconciles approved schedule changes and restricts settings by role", () => {
  const changes = read("src/services/schedule-change.service.ts");
  const roleGuard = read("../frontend/src/components/auth/role-guard.tsx");
  assert.match(changes, /affectedScheduleIds/);
  assert.match(changes, /ScheduleService\.reconcileScheduleCalendar/);
  assert.match(roleGuard, /"\/settings": \["KOORDINATOR_LAB", "ASISTEN_LAB"\]/);
});

test("Production deploy uses separate migration credentials and never auto-touches dependencies", () => {
  const deploy = read("../deploy/scripts/deploy-labkom.sh");
  const rollback = read("../deploy/scripts/rollback-labkom.sh");
  const candidate = read("../deploy/scripts/deploy-labkom-candidate.sh");
  assert.match(deploy, /MIGRATION_ENV_FILE/);
  assert.match(deploy, /run --rm --no-deps -e DATABASE_URL backend/);
  assert.match(deploy, /up -d --no-deps backend frontend/);
  assert.match(deploy, /PROXY_RESTART_ATTEMPTS:-0/);
  assert.match(rollback, /up -d --no-deps backend frontend/);
  assert.match(candidate, /up -d --no-deps backend-candidate frontend-candidate/);
  assert.match(candidate, /up -d --no-deps backend frontend/);
});
