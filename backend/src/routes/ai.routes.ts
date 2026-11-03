import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as aiController from "../controllers/ai.controller";

const router = Router();

const aiChatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.userId,
  message: { success: false, message: "Terlalu banyak pertanyaan. Coba lagi dalam satu menit." },
});

router.use(authenticate);

router.post("/chat", aiChatLimiter, aiController.chat);
router.get("/chat/history", aiController.getChatHistory);
router.delete("/chat/history", aiController.clearChatHistory);
router.get("/quick-actions", aiController.getQuickActions);
router.post("/feedback", aiController.submitFeedback);
router.get("/admin/metrics", authorize("KOORDINATOR_LAB"), aiController.getAiMetrics);
router.get("/insights", aiController.getInsights);

router.get("/predictive/risk-scores", authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), aiController.getRiskScores);
router.get("/predictive/maintenance-schedule", authorize("KOORDINATOR_LAB"), aiController.getMaintenanceSchedule);
router.get("/predictive/trends", authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), aiController.getTrendAnalysis);
router.get("/predictive/health", aiController.getOverallHealth);

router.get("/scheduling/suggest", authorize("KOORDINATOR_LAB"), aiController.suggestSlots);
router.get("/scheduling/usage-patterns", authorize("KOORDINATOR_LAB"), aiController.getUsagePatterns);
router.get("/scheduling/load-balance", authorize("KOORDINATOR_LAB"), aiController.getLoadBalance);
router.get("/scheduling/conflicts", authorize("KOORDINATOR_LAB"), aiController.detectConflicts);
router.get("/scheduling/workload", authorize("KOORDINATOR_LAB"), aiController.getAssistantWorkload);

export default router;
