import { randomUUID } from "crypto";
import redis from "../config/redis";
import prisma from "../config/database";
import { isAiIntentAllowed } from "./ai-access-policy";
import { getScheduleQuery } from "./ai-schedule-time";

export interface QuickAction {
  id: string;
  label: string;
  message: string;
  intent: string;
  href?: string;
}

export interface StoredChatTurn {
  responseId: string;
  user: string;
  assistant: string;
  intent: string;
  sources: string[];
  suggestions?: string[];
  quickActions?: QuickAction[];
  createdAt: string;
}

export type FeedbackRating = "UP" | "DOWN";
export type FeedbackReason = "INACCURATE" | "OUTDATED" | "UNHELPFUL" | "UNCLEAR" | "OTHER";

const PREFIX = "labkom:ai:v2";
const HISTORY_TTL = 24 * 60 * 60;
const RESPONSE_TTL = 7 * 24 * 60 * 60;
const METRICS_TTL = 90 * 24 * 60 * 60;
const MAX_TURNS = 10;

const ACTIONS: QuickAction[] = [
  { id: "schedule.today", label: "Jadwal hari ini", message: "Jadwal lab hari ini", intent: "schedule_today", href: "/schedules" },
  { id: "schedule.week", label: "Jadwal minggu ini", message: "Jadwal lab minggu ini", intent: "schedule_today", href: "/schedules" },
  { id: "lab.available", label: "Lab tersedia", message: "Lab mana yang tersedia sekarang?", intent: "available_labs", href: "/labs" },
  { id: "ticket.mine", label: "Tiket saya", message: "Tampilkan tiket saya", intent: "my_tickets", href: "/tickets/my" },
  { id: "pc.status", label: "Status PC", message: "Bagaimana status PC lab?", intent: "lab_status", href: "/pc-monitoring" },
  { id: "guide.damage", label: "Lapor kerusakan", message: "Bagaimana cara melaporkan kerusakan?", intent: "general", href: "/tickets/new" },
  { id: "attendance.mine", label: "Absensi saya", message: "Apakah saya sudah absen hari ini?", intent: "my_attendance", href: "/attendance" },
  { id: "operations.attendance", label: "Status absensi", message: "Siapa asisten yang belum absen hari ini?", intent: "attendance_status", href: "/attendance/monitoring" },
  { id: "operations.keys", label: "Status kunci", message: "Bagaimana status kunci lab?", intent: "key_status", href: "/keys" },
];

function historyKey(userId: string) { return `${PREFIX}:history:${userId}`; }
function responseKey(responseId: string) { return `${PREFIX}:response:${responseId}`; }
function feedbackKey(responseId: string) { return `${PREFIX}:feedback:${responseId}`; }

function jakartaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function metricKey(date = new Date()) { return `${PREFIX}:metrics:${jakartaDateKey(date)}`; }

export function quickActionsForRole(role?: string): QuickAction[] {
  return ACTIONS.filter((action) => isAiIntentAllowed(role, action.intent));
}

export function inferProvider(sources: string[]): "rule" | "local" | "openai" {
  if (sources.some((source) => /AI Lokal/i.test(source))) return "local";
  if (sources.some((source) => /OpenAI/i.test(source))) return "openai";
  return "rule";
}

class AiRuntimeService {
  async getHistory(userId: string): Promise<StoredChatTurn[]> {
    try {
      const rows = await redis.lrange(historyKey(userId), 0, -1);
      return rows.flatMap((row) => {
        try { return [JSON.parse(row) as StoredChatTurn]; } catch { return []; }
      });
    } catch (error) {
      console.warn("[AI Runtime] Riwayat Redis tidak tersedia");
      return [];
    }
  }

  async appendTurn(userId: string, role: string | undefined, intent: string, message: string, response: {
    answer: string; sources: string[]; suggestions?: string[];
  }, latencyMs: number): Promise<{ responseId: string; quickActions: QuickAction[]; createdAt: string }> {
    const responseId = randomUUID();
    const createdAt = new Date().toISOString();
    const provider = inferProvider(response.sources);
    const quickActions = quickActionsForRole(role).slice(0, 5);
    const turn: StoredChatTurn = {
      responseId, user: message, assistant: response.answer, intent,
      sources: response.sources, suggestions: response.suggestions, quickActions, createdAt,
    };
    try {
      const history = historyKey(userId);
      const responseMeta = responseKey(responseId);
      const metrics = metricKey();
      await redis.multi()
        .rpush(history, JSON.stringify(turn)).ltrim(history, -MAX_TURNS, -1).expire(history, HISTORY_TTL)
        .set(responseMeta, JSON.stringify({ userId, intent, provider, role, createdAt }), "EX", RESPONSE_TTL)
        .hincrby(metrics, "chat.total", 1)
        .hincrby(metrics, `intent.${intent}`, 1)
        .hincrby(metrics, `provider.${provider}`, 1)
        .hincrby(metrics, `role.${role || "UNKNOWN"}`, 1)
        .hincrby(metrics, "latency.sum_ms", Math.max(0, Math.round(latencyMs)))
        .hincrby(metrics, "latency.count", 1)
        .expire(metrics, METRICS_TTL)
        .exec();
    } catch {
      console.warn("[AI Runtime] Penyimpanan riwayat/metrik Redis gagal");
    }
    return { responseId, quickActions, createdAt };
  }

  async clearHistory(userId: string): Promise<void> {
    await redis.del(historyKey(userId));
  }

  async resolveAction(actionId: string, role?: string): Promise<QuickAction | null> {
    const action = ACTIONS.find((item) => item.id === actionId);
    if (!action || !isAiIntentAllowed(role, action.intent)) return null;
    return action;
  }

  async submitFeedback(userId: string, responseId: string, rating: FeedbackRating, reason?: FeedbackReason, comment?: string): Promise<"created" | "duplicate" | "missing" | "forbidden"> {
    const raw = await redis.get(responseKey(responseId));
    if (!raw) return "missing";
    const metadata = JSON.parse(raw) as { userId: string; intent: string; provider: string };
    if (metadata.userId !== userId) return "forbidden";
    const value = JSON.stringify({ rating, reason, comment: comment?.slice(0, 500), createdAt: new Date().toISOString() });
    const created = await redis.set(feedbackKey(responseId), value, "EX", METRICS_TTL, "NX");
    if (!created) return "duplicate";
    const metrics = metricKey();
    const pipeline = redis.multi()
      .hincrby(metrics, `feedback.${rating}`, 1)
      .hincrby(metrics, `feedback.intent.${metadata.intent}.${rating}`, 1);
    if (reason) pipeline.hincrby(metrics, `feedback.reason.${reason}`, 1);
    await pipeline.expire(metrics, METRICS_TTL).exec();
    return "created";
  }

  async getMetrics(userId: string, days: number): Promise<Array<{ date: string; metrics: Record<string, number> }>> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
    if (!user?.isActive || user.role !== "KOORDINATOR_LAB") throw Object.assign(new Error("Akses koordinator diperlukan"), { statusCode: 403 });
    const clampedDays = Math.min(90, Math.max(1, days));
    const dates = Array.from({ length: clampedDays }, (_, index) => {
      const date = new Date(); date.setUTCDate(date.getUTCDate() - (clampedDays - 1 - index)); return jakartaDateKey(date);
    });
    const pipeline = redis.pipeline();
    dates.forEach((date) => pipeline.hgetall(`${PREFIX}:metrics:${date}`));
    const results = await pipeline.exec();
    return dates.map((date, index) => {
      const raw = (results?.[index]?.[1] || {}) as Record<string, string>;
      return { date, metrics: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value)])) };
    });
  }

  getQuickActions(role?: string): QuickAction[] { return quickActionsForRole(role); }
}

export const aiRuntimeService = new AiRuntimeService();
