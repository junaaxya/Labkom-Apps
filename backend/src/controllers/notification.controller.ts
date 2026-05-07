import { Request, Response, NextFunction } from "express";
import { notificationService } from "../services/notification.service";

function getParam(params: Record<string, unknown>, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : (val as string);
}

export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    const result = await notificationService.getUserNotifications(
      req.user!.userId,
      page,
      limit,
      unreadOnly
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.userId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req.params, "id");
    await notificationService.markAsRead(id, req.user!.userId);
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllAsRead(req.user!.userId);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = getParam(req.params, "id");
    await notificationService.delete(id, req.user!.userId);
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
};
