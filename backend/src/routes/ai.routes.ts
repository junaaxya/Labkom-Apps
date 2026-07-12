import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as aiController from "../controllers/ai.controller";

const router = Router();

router.use(authenticate);

router.post("/chat", aiController.chat);
router.get("/insights", aiController.getInsights);
router.delete("/chat/history", aiController.clearChatHistory);

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
