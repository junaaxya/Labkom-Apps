import { randomBytes } from "node:crypto";
import prisma from "../config/database";
import { config } from "../config";
import redis from "../config/redis";
import { buildGoogleCalendarEvent, buildGoogleCalendarEventId, type CalendarSchedule } from "./google-calendar-event";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const OAUTH_STATE_PREFIX = "google-calendar:oauth-state:";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

let _google: any = null;
async function getGoogle() {
  if (!_google) {
    const mod = await import("googleapis");
    _google = mod.google;
  }
  return _google;
}

class GoogleCalendarService {
  private async createOAuth2Client() {
    const google = await getGoogle();
    return new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );
  }

  async createCalendarOAuthState(userId: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = randomBytes(32).toString("base64url");
      const stored = await redis.set(
        `${OAUTH_STATE_PREFIX}${state}`,
        userId,
        "EX",
        OAUTH_STATE_TTL_SECONDS,
        "NX"
      );
      if (stored === "OK") return state;
    }
    throw new Error("Gagal membuat sesi OAuth Google Calendar");
  }

  async consumeCalendarOAuthState(state: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
      throw new Error("State OAuth Google Calendar tidak valid");
    }
    const userId = await redis.getdel(`${OAUTH_STATE_PREFIX}${state}`);
    if (!userId) throw new Error("State OAuth Google Calendar kedaluwarsa atau sudah digunakan");
    return userId;
  }

  async getAuthUrl(userId: string): Promise<string> {
    const client = await this.createOAuth2Client();
    const state = await this.createCalendarOAuthState(userId);
    return client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      state,
      prompt: "consent",
    });
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const client = await this.createOAuth2Client();
    const { tokens } = await client.getToken(code);

    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarToken: JSON.stringify(tokens) },
    });
  }

  private errorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== "object") return undefined;
    const candidate = error as { code?: number; response?: { status?: number } };
    return candidate.code || candidate.response?.status;
  }

  private async authorizedClient(userId: string): Promise<any | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarToken: true },
    });
    if (!user?.googleCalendarToken) return null;

    const tokens = JSON.parse(user.googleCalendarToken);
    const client = await this.createOAuth2Client();
    client.setCredentials(tokens);
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await client.refreshAccessToken();
      const mergedCredentials = { ...tokens, ...credentials };
      client.setCredentials(mergedCredentials);
      await prisma.user.update({
        where: { id: userId },
        data: { googleCalendarToken: JSON.stringify(mergedCredentials) },
      });
    }
    return client;
  }

  async syncScheduleToCalendar(userId: string, schedule: CalendarSchedule): Promise<string | null> {
    let client;
    try {
      client = await this.authorizedClient(userId);
    } catch (error) {
      console.error("[GoogleCalendar] Failed to authorize sync:", error);
      return null;
    }
    if (!client) return null;

    const google = await getGoogle();
    const calendar = google.calendar({ version: "v3", auth: client });

    const event = buildGoogleCalendarEvent(userId, schedule);

    try {
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: event.id,
        requestBody: event,
      });
      return response.data.id || null;
    } catch (error) {
      if (this.errorStatus(error) !== 404) {
        console.error("[GoogleCalendar] Failed to update event:", error);
        return null;
      }
    }

    try {
      const response = await calendar.events.insert({ calendarId: "primary", requestBody: event });
      return response.data.id || event.id;
    } catch (error) {
      // A concurrent sync may have inserted the deterministic ID after our update miss.
      if (this.errorStatus(error) === 409) {
        const response = await calendar.events.update({ calendarId: "primary", eventId: event.id, requestBody: event });
        return response.data.id || event.id;
      }
      console.error("[GoogleCalendar] Failed to insert event:", error);
      return null;
    }
  }

  async removeScheduleFromCalendar(userId: string, scheduleId: string): Promise<boolean> {
    let client;
    try {
      client = await this.authorizedClient(userId);
    } catch (error) {
      console.error("[GoogleCalendar] Failed to authorize delete:", error);
      return false;
    }
    if (!client) return false;

    const google = await getGoogle();
    const calendar = google.calendar({ version: "v3", auth: client });

    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: buildGoogleCalendarEventId(userId, scheduleId),
      });
      return true;
    } catch (error) {
      if (this.errorStatus(error) === 404) return true;
      console.error("[GoogleCalendar] Failed to delete event:", error);
      return false;
    }
  }

  async reconcileScheduleCalendar(userId: string, schedule: CalendarSchedule & { status?: string; isActive?: boolean }): Promise<void> {
    if (schedule.isActive === false || (schedule.status && schedule.status !== "SCHEDULED")) {
      await this.removeScheduleFromCalendar(userId, schedule.id);
      return;
    }
    await this.syncScheduleToCalendar(userId, schedule);
  }

  async syncAllSchedulesForUser(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, googleCalendarToken: true },
    });

    if (!user?.googleCalendarToken) return 0;

    const schedules = await prisma.schedule.findMany({
      where: {
        status: "SCHEDULED",
        assistantId: userId,
      },
      include: { lab: true },
    });

    let synced = 0;
    for (const schedule of schedules) {
      const eventId = await this.syncScheduleToCalendar(userId, {
        id: schedule.id,
        title: schedule.title,
        labName: schedule.lab.name,
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        semester: schedule.semester || undefined,
      });
      if (eventId) synced++;
      await new Promise((r) => setTimeout(r, 500));
    }

    return synced;
  }

  isConnected(token: string | null): boolean {
    if (!token) return false;
    try {
      const parsed = JSON.parse(token);
      return !!parsed.refresh_token || !!parsed.access_token;
    } catch {
      return false;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
