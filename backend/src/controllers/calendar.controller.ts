import { Request, Response, NextFunction } from "express";
import { googleCalendarService } from "../services/google-calendar.service";
import prisma from "../config/database";

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
  const { code, state: userId } = req.query as { code: string; state: string };

  if (!code || !userId) {
    res.status(400).json({ success: false, message: "Missing code or state" });
    return;
  }

  try {
    await googleCalendarService.handleCallback(code, userId);
    res.redirect(`${process.env.CORS_ORIGIN || "http://localhost:3000"}/dashboard/settings?calendar=connected`);
  } catch (error) {
    res.redirect(`${process.env.CORS_ORIGIN || "http://localhost:3000"}/dashboard/settings?calendar=error`);
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
