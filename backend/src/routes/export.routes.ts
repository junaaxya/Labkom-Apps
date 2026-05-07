import { Router } from "express";
import { ExportController } from "../controllers/export.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/report/excel", authenticate, authorize("KOORDINATOR_LAB"), ExportController.exportMonthlyExcel);
router.get("/report/pdf", authenticate, authorize("KOORDINATOR_LAB"), ExportController.exportMonthlyPDF);
router.get("/leaderboard/excel", authenticate, authorize("KOORDINATOR_LAB"), ExportController.exportLeaderboardExcel);

export default router;
