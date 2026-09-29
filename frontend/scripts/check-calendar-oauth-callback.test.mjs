import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(frontendRoot, "..");

const backendControllerPath = path.join(
  repoRoot,
  "backend/src/controllers/calendar.controller.ts",
);
const settingsPath = path.join(
  frontendRoot,
  "src/app/(dashboard)/settings/page.tsx",
);
const resultPagePath = path.join(
  frontendRoot,
  "src/app/oauth/google-calendar/result/page.tsx",
);

test("Calendar OAuth callback uses a public result page", () => {
  const controller = readFileSync(backendControllerPath, "utf8");

  assert.match(controller, /\/oauth\/google-calendar\/result/);
  assert.match(controller, /config\.appUrl/);
  assert.doesNotMatch(controller, /process\.env\.CORS_ORIGIN/);
});

test("public Calendar OAuth result page exists with success and error states", () => {
  assert.equal(existsSync(resultPagePath), true);
  const resultPage = readFileSync(resultPagePath, "utf8");

  assert.match(resultPage, /calendar=connected|status.*connected/s);
  assert.match(resultPage, /berhasil terhubung/i);
  assert.match(resultPage, /gagal/i);
  assert.match(resultPage, /window\.close\(\)/);
});

test("settings refreshes Calendar status when the app regains focus", () => {
  const settings = readFileSync(settingsPath, "utf8");

  assert.match(settings, /addEventListener\(["']focus["']/);
  assert.match(settings, /visibilitychange/);
  assert.match(settings, /fetchCalendarStatus\(\)/);
});
