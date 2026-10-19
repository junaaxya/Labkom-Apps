import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
} from "../controllers/notification.controller";
import { sseManager } from "../services/sse.service";

const router = Router();

export function streamNotifications(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "ok" })}\n\n`);
  sseManager.addClient(req.user!.userId, res);
}

router.get("/stream", authenticate, streamNotifications);
router.use(authenticate);
router.get("/", getMyNotifications);
router.get("/unread-count", getUnreadCount);
router.get("/push/public-key", getPushPublicKey);
router.post("/push/subscribe", subscribePush);
router.post("/push/unsubscribe", unsubscribePush);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;
