export type AiRole = "KOORDINATOR_LAB" | "ASISTEN_LAB" | "MAHASISWA" | "DOSEN" | string;

const ASSISTANT_INTENTS = new Set([
  "lab_status", "broken_pcs", "online_pcs", "schedule_today", "my_schedule", "available_labs",
  "my_tickets", "ticket_trends", "problematic_pcs", "my_attendance", "attendance_status",
  "key_status", "key_holder", "available_missions", "my_points", "logbook_status",
  "troubleshoot", "recommendation", "greeting", "thanks", "general",
]);

const STUDENT_INTENTS = new Set([
  "lab_status", "broken_pcs", "online_pcs", "schedule_today", "available_labs",
  "my_tickets", "troubleshoot", "greeting", "thanks", "general",
]);

export function isAiIntentAllowed(role: AiRole | undefined, intent: string): boolean {
  if (role === "KOORDINATOR_LAB") return true;
  if (role === "ASISTEN_LAB") return ASSISTANT_INTENTS.has(intent);
  return STUDENT_INTENTS.has(intent);
}

export function canViewOperationalAiInsights(role: AiRole | undefined): boolean {
  return role === "KOORDINATOR_LAB" || role === "ASISTEN_LAB";
}
