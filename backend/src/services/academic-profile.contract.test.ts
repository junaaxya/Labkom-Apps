import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const service = readFileSync(path.join(__dirname, "academic-profile.service.ts"), "utf8");
const auth = readFileSync(path.join(__dirname, "../middlewares/auth.middleware.ts"), "utf8");

test("external students must complete program semester and class for the active term", () => {
  assert.match(service, /!user\.semester \|\| !user\.studyProgram \|\| !user\.className/);
  assert.match(service, /academicProfileTermId !== activeTerm\.id/);
  assert.match(service, /suggestedSemester:[\s\S]*nextSemester/);
  assert.match(service, /calendarUrl: "https:\/\/akademik\.unmuhbabel\.ac\.id\/kalender-akademik\/"/);
});

test("backend blocks feature APIs while academic onboarding is required", () => {
  assert.match(auth, /ACADEMIC_PROFILE_REQUIRED/);
  assert.match(auth, /\/api\/v1\/access-requests\/academic-profile/);
  assert.match(auth, /academicProfileRequired && !onboardingRoute/);
});
