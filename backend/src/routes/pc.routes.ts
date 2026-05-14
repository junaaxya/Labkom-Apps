import { Router } from "express";
import { PCController } from "../controllers/pc.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import {
  authenticateAgent,
  agentHeartbeatLimiter,
  agentCommandLimiter,
} from "../middlewares/agentAuth.middleware";

const router = Router();

router.get("/", authenticate, PCController.getAllPCs);
router.get("/analytics", authenticate, PCController.getAnalytics);
router.get("/uptime", authenticate, authorize("KOORDINATOR_LAB"), PCController.getUptimeStats);
router.get("/inventory", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.getInventorySummary);
router.get("/energy", authenticate, authorize("KOORDINATOR_LAB"), PCController.getEnergyStats);
router.get("/commands", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.getCommandQueue);

router.post("/agent/register", agentHeartbeatLimiter, authenticateAgent, PCController.agentRegister);
router.post("/agent/heartbeat", agentHeartbeatLimiter, authenticateAgent, PCController.agentHeartbeat);
router.get("/agent/commands", agentCommandLimiter, authenticateAgent, PCController.agentPickupCommands);
router.post("/agent/commands/:commandId/result", agentCommandLimiter, authenticateAgent, PCController.agentReportResult);
router.post("/agent/logs", agentHeartbeatLimiter, authenticateAgent, PCController.agentLogs);

router.post("/bulk-status", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.bulkUpdateStatus);
router.post("/bulk-command", authenticate, authorize("KOORDINATOR_LAB"), PCController.bulkSendCommand);
router.post("/bulk-specs", authenticate, authorize("KOORDINATOR_LAB"), PCController.bulkUpdateSpecs);
router.post("/bulk-qr", authenticate, authorize("KOORDINATOR_LAB"), PCController.bulkGenerateQR);

router.post("/:id/command", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.sendCommand);
router.post("/:id/specs", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.updateSpecs);
router.post("/:id/qr", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.generateQRCode);
router.post("/:id/generate-token", authenticate, authorize("KOORDINATOR_LAB"), PCController.generateAgentToken);

router.patch("/commands/:commandId/cancel", authenticate, authorize("KOORDINATOR_LAB"), PCController.cancelCommand);

router.get("/:id", authenticate, PCController.getPCDetail);
router.get("/:id/history", authenticate, PCController.getStatusHistory);

export default router;
