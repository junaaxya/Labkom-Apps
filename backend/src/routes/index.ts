import { Router } from "express";
import authRoutes from "./auth.routes";
import labRoutes from "./lab.routes";
import scheduleRoutes from "./schedule.routes";
import logbookRoutes from "./logbook.routes";
import keyRoutes from "./key.routes";
import attendanceRoutes from "./attendance.routes";
import ticketRoutes from "./ticket.routes";
import missionRoutes from "./mission.routes";
import reportRoutes from "./report.routes";
import userRoutes from "./user.routes";
import leaderboardRoutes from "./leaderboard.routes";
import exportRoutes from "./export.routes";
import certificateRoutes from "./certificate.routes";
import notificationRoutes from "./notification.routes";
import whatsappRoutes from "./whatsapp.routes";
import calendarRoutes from "./calendar.routes";
import faqRoutes from "./faq.routes";
import pcRoutes from "./pc.routes";
import aiRoutes from "./ai.routes";
import shiftRoutes from "./shift.routes";
import bookingRoutes from "./booking.routes";
import uploadRoutes from "./upload.routes";
import qrRoutes from "./qr.routes";
import scheduleChangeRoutes from "./schedule-change.routes";
import leaveRoutes from "./leave.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Labkom API is running",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/labs", labRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/logbooks", logbookRoutes);
router.use("/keys", keyRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/tickets", ticketRoutes);
router.use("/missions", missionRoutes);
router.use("/reports", reportRoutes);
router.use("/users", userRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/export", exportRoutes);
router.use("/certificates", certificateRoutes);
router.use("/notifications", notificationRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/calendar", calendarRoutes);
router.use("/faq", faqRoutes);
router.use("/pcs", pcRoutes);
router.use("/ai", aiRoutes);
router.use("/shifts", shiftRoutes);
router.use("/bookings", bookingRoutes);
router.use("/upload", uploadRoutes);
router.use("/qr", qrRoutes);
router.use("/schedule-changes", scheduleChangeRoutes);
router.use("/leaves", leaveRoutes);

export default router;
