import { canViewOperationalAiInsights, isAiIntentAllowed } from "../src/services/ai-access-policy";

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

for (const intent of ["lab_status", "schedule_today", "available_labs", "my_tickets", "troubleshoot", "general"]) {
  expectEqual(isAiIntentAllowed("MAHASISWA", intent), true, `student allows ${intent}`);
}

for (const intent of ["attendance_status", "key_holder", "logbook_status", "analytics", "trends", "recommendation", "my_points", "available_missions"]) {
  expectEqual(isAiIntentAllowed("MAHASISWA", intent), false, `student denies ${intent}`);
}
expectEqual(canViewOperationalAiInsights("MAHASISWA"), false, "student operational insights");

expectEqual(isAiIntentAllowed("ASISTEN_LAB", "attendance_status"), true, "assistant attendance status");
expectEqual(isAiIntentAllowed("ASISTEN_LAB", "key_holder"), true, "assistant key holder");
expectEqual(isAiIntentAllowed("ASISTEN_LAB", "analytics"), false, "assistant analytics");
expectEqual(canViewOperationalAiInsights("ASISTEN_LAB"), true, "assistant operational insights");

expectEqual(isAiIntentAllowed("KOORDINATOR_LAB", "analytics"), true, "coordinator analytics");
expectEqual(isAiIntentAllowed("KOORDINATOR_LAB", "unknown_future_intent"), true, "coordinator future intent");
expectEqual(canViewOperationalAiInsights("KOORDINATOR_LAB"), true, "coordinator operational insights");

console.log("AI access policy tests passed");
