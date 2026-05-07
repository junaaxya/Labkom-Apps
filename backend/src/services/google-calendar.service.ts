import prisma from "../config/database";
import { config } from "../config";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

let _google: any = null;
async function getGoogle() {
  if (!_google) {
    const mod = await import("googleapis");
    _google = mod.google;
  }
  return _google;
}

class GoogleCalendarService {
  private oauth2Client: any = null;

  private async getOAuth2Client() {
    if (!this.oauth2Client) {
      const google = await getGoogle();
      this.oauth2Client = new google.auth.OAuth2(
        config.googleClientId,
        config.googleClientSecret,
        config.googleRedirectUri
      );
    }
    return this.oauth2Client;
  }

  async getAuthUrl(userId: string): Promise<string> {
    const client = await this.getOAuth2Client();
    return client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      state: userId,
      prompt: "consent",
    });
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const client = await this.getOAuth2Client();
    const { tokens } = await client.getToken(code);

    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarToken: JSON.stringify(tokens) },
    });
  }

  async syncScheduleToCalendar(userId: string, schedule: {
    id: string;
    title: string;
    labName: string;
    day: string;
    startTime: string;
    endTime: string;
    semester?: string;
  }): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarToken: true },
    });

    if (!user?.googleCalendarToken) return null;

    const tokens = JSON.parse(user.googleCalendarToken);
    const client = await this.getOAuth2Client();
    client.setCredentials(tokens);

    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);
      await prisma.user.update({
        where: { id: userId },
        data: { googleCalendarToken: JSON.stringify(credentials) },
      });
    }

    const google = await getGoogle();
    const calendar = google.calendar({ version: "v3", auth: client });

    const dayMap: Record<string, number> = {
      SENIN: 1, SELASA: 2, RABU: 3, KAMIS: 4, JUMAT: 5, SABTU: 6, MINGGU: 0,
    };

    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = dayMap[schedule.day] ?? 1;
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntil);

    const [startH, startM] = schedule.startTime.split(":").map(Number);
    const [endH, endM] = schedule.endTime.split(":").map(Number);

    const startDateTime = new Date(nextDate);
    startDateTime.setHours(startH, startM, 0, 0);

    const endDateTime = new Date(nextDate);
    endDateTime.setHours(endH, endM, 0, 0);

    const event: any = {
      summary: `[Labkom] ${schedule.title}`,
      location: schedule.labName,
      description: `Jadwal Lab: ${schedule.title}\nLab: ${schedule.labName}\nSemester: ${schedule.semester || "-"}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "Asia/Jakarta",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "Asia/Jakarta",
      },
      recurrence: ["RRULE:FREQ=WEEKLY;COUNT=16"],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "popup", minutes: 10 },
        ],
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });
      return response.data.id || null;
    } catch (error) {
      console.error("[GoogleCalendar] Failed to create event:", error);
      return null;
    }
  }

  async removeEventFromCalendar(userId: string, eventId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarToken: true },
    });

    if (!user?.googleCalendarToken) return false;

    const tokens = JSON.parse(user.googleCalendarToken);
    const client = await this.getOAuth2Client();
    client.setCredentials(tokens);

    const google = await getGoogle();
    const calendar = google.calendar({ version: "v3", auth: client });

    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId,
      });
      return true;
    } catch (error) {
      console.error("[GoogleCalendar] Failed to delete event:", error);
      return false;
    }
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
