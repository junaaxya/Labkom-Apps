import { Request, Response, NextFunction } from "express";
import { googleCalendarService } from "../services/google-calendar.service";
import prisma from "../config/database";
import { config } from "../config";

function calendarOAuthResultUrl(status: "connected" | "error"): string {
  const resultUrl = new URL("/oauth/google-calendar/result", config.appUrl);
  resultUrl.searchParams.set("status", status);
  return resultUrl.toString();
}

export const getAuthUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const url = await googleCalendarService.getAuthUrl(userId);
    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
};

export const handleCallback = async (req: Request, res: Response, next: NextFunction) => {
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error || !code || !state) {
    res.redirect(calendarOAuthResultUrl("error"));
    return;
  }

  try {
    const userId = await googleCalendarService.consumeCalendarOAuthState(state);
    await googleCalendarService.handleCallback(code, userId);
    res.redirect(calendarOAuthResultUrl("connected"));
  } catch (error) {
    res.redirect(calendarOAuthResultUrl("error"));
  }
};

export const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarToken: true },
    });

    const connected = googleCalendarService.isConnected(user?.googleCalendarToken || null);
    res.json({ success: true, data: { connected } });
  } catch (error) {
    next(error);
  }
};

export const disconnect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    await prisma.user.update({
      where: { id: userId },
      data: { googleCalendarToken: null },
    });
    res.json({ success: true, message: "Google Calendar disconnected" });
  } catch (error) {
    next(error);
  }
};

export const syncAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const synced = await googleCalendarService.syncAllSchedulesForUser(userId);
    res.json({ success: true, data: { synced }, message: `${synced} jadwal disinkronkan ke Google Calendar` });
  } catch (error) {
    next(error);
  }
};
