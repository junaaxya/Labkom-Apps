import { Router } from "express";
import { ReportController } from "../controllers/report.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/monthly", authenticate, authorize("KOORDINATOR_LAB"), ReportController.getMonthlyReport);

export default router;
