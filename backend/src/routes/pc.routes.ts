import { Router } from "express";
import { PCController } from "../controllers/pc.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { authenticateAgent } from "../middlewares/agentAuth.middleware";

const router = Router();

router.get("/", authenticate, PCController.getAllPCs);
router.get("/analytics", authenticate, PCController.getAnalytics);
router.get("/uptime", authenticate, authorize("KOORDINATOR_LAB"), PCController.getUptimeStats);
router.get("/inventory", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.getInventorySummary);
router.get("/energy", authenticate, authorize("KOORDINATOR_LAB"), PCController.getEnergyStats);
router.get("/commands", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.getCommandQueue);

router.get("/:id", authenticate, PCController.getPCDetail);
router.get("/:id/history", authenticate, PCController.getStatusHistory);

router.post("/bulk-status", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.bulkUpdateStatus);
router.post("/bulk-command", authenticate, authorize("KOORDINATOR_LAB"), PCController.bulkSendCommand);
router.post("/bulk-specs", authenticate, authorize("KOORDINATOR_LAB"), PCController.bulkUpdateSpecs);
router.post("/bulk-qr", authenticate, authorize("KOORDINATOR_LAB"), PCController.bulkGenerateQR);

router.post("/:id/command", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.sendCommand);
router.post("/:id/specs", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.updateSpecs);
router.post("/:id/qr", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), PCController.generateQRCode);
router.post("/:id/generate-token", authenticate, authorize("KOORDINATOR_LAB"), PCController.generateAgentToken);

router.patch("/commands/:commandId/cancel", authenticate, authorize("KOORDINATOR_LAB"), PCController.cancelCommand);

router.post("/agent/register", authenticateAgent, PCController.agentRegister);
router.post("/agent/heartbeat", authenticateAgent, PCController.agentHeartbeat);
router.get("/agent/commands", authenticateAgent, PCController.agentPickupCommands);
router.post("/agent/commands/:commandId/result", authenticateAgent, PCController.agentReportResult);
router.post("/agent/logs", authenticateAgent, PCController.agentLogs);

export default router;
