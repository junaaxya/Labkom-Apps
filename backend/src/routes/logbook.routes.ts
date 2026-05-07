import { Router } from "express";
import { LogbookController } from "../controllers/logbook.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/stats", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), LogbookController.getStats);
router.get("/today", authenticate, authorize("ASISTEN_LAB"), LogbookController.getTodayLogbook);
router.get("/", authenticate, LogbookController.getAllLogbooks);
router.get("/:id", authenticate, LogbookController.getLogbookById);
router.post("/checkin", authenticate, authorize("ASISTEN_LAB"), LogbookController.checkin);
router.patch("/:id/condition", authenticate, LogbookController.submitCondition);
router.patch("/conditions/:conditionId/verify", authenticate, authorize("ASISTEN_LAB", "KOORDINATOR_LAB"), LogbookController.verifyCondition);
router.patch("/:id/checkout", authenticate, authorize("ASISTEN_LAB"), LogbookController.checkout);

export default router;
