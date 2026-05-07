import { Router } from "express";
import { ScheduleController } from "../controllers/schedule.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, ScheduleController.getAllSchedules);
router.get("/today", authenticate, ScheduleController.getTodaySchedules);
router.get("/stats", authenticate, ScheduleController.getStats);
router.get("/lab/:labId/day/:day", authenticate, ScheduleController.getSchedulesByDay);
router.get("/:id", authenticate, ScheduleController.getScheduleById);
router.post("/", authenticate, authorize("KOORDINATOR_LAB"), ScheduleController.createSchedule);
router.put("/:id", authenticate, authorize("KOORDINATOR_LAB"), ScheduleController.updateSchedule);
router.patch("/:id/status", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), ScheduleController.updateStatus);
router.post("/bulk-delete", authenticate, authorize("KOORDINATOR_LAB"), ScheduleController.bulkDeleteSchedules);
router.delete("/all", authenticate, authorize("KOORDINATOR_LAB"), ScheduleController.deleteAllSchedules);
router.delete("/:id", authenticate, authorize("KOORDINATOR_LAB"), ScheduleController.deleteSchedule);

export default router;
