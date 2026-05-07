import { Router } from "express";
import { KeyController } from "../controllers/key.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, KeyController.getAllKeys);
router.get("/logs", authenticate, KeyController.getKeyLogs);
router.post("/scan", authenticate, KeyController.findByQR);
router.patch("/:id/force-return", authenticate, authorize("KOORDINATOR_LAB"), KeyController.forceReturnKey);
router.get("/:id", authenticate, KeyController.getKeyById);
router.patch("/:id/take", authenticate, KeyController.takeKey);
router.get("/:id/return-status", authenticate, KeyController.getReturnStatus);
router.patch("/:id/return", authenticate, KeyController.returnKey);

export default router;
