import { Router } from "express";
import { ScheduleChangeController } from "../controllers/schedule-change.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), ScheduleChangeController.getAllRequests);
router.get("/my", authenticate, ScheduleChangeController.getMyRequests);
router.get("/stats", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), ScheduleChangeController.getStats);
router.post("/", authenticate, ScheduleChangeController.createRequest);
router.patch(
  "/:id/approve",
  authenticate,
  authorize("KOORDINATOR_LAB", "ASISTEN_LAB"),
  ScheduleChangeController.approveRequest
);
router.patch(
  "/:id/reject",
  authenticate,
  authorize("KOORDINATOR_LAB", "ASISTEN_LAB"),
  ScheduleChangeController.rejectRequest
);

export default router;
