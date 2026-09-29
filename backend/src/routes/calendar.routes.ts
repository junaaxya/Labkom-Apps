import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as calendarController from "../controllers/calendar.controller";

const router = Router();

router.get("/callback", calendarController.handleCallback);

router.use(authenticate);
router.use(authorize("KOORDINATOR_LAB", "ASISTEN_LAB"));
router.get("/auth-url", calendarController.getAuthUrl);
router.get("/status", calendarController.getStatus);
router.post("/disconnect", calendarController.disconnect);
router.post("/sync", calendarController.syncAll);

export default router;
