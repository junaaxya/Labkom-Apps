import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
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
import { consumeSseTicket, createSseTicket } from "../services/sse-ticket.service";

const router = Router();
const sseTicketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user!.userId,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/sse-ticket", authenticate, sseTicketLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await createSseTicket(req.user!);
    res.json({ success: true, data: { ticket, expiresIn: 60 } });
  } catch (error) {
    next(error);
  }
});

router.get("/stream", async (req: Request, res: Response, next: NextFunction) => {
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
  try {
    const identity = await consumeSseTicket(ticket);
    if (!identity) {
      res.status(401).json({ success: false, message: "Tiket notifikasi tidak valid atau kedaluwarsa" });
      return;
    }
    req.user = identity;
  } catch (error) {
    next(error);
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ status: "ok" })}\n\n`);

  sseManager.addClient(req.user!.userId, res);
});

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
