import { Router } from "express";
import { ShiftController } from "../controllers/shift.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, ShiftController.getAllShifts);
router.get("/today", authenticate, ShiftController.getTodayShifts);
router.get("/asleb/:aslebId", authenticate, ShiftController.getAslebSchedule);
router.get("/:id", authenticate, ShiftController.getShiftById);
router.post("/", authenticate, authorize("KOORDINATOR_LAB"), ShiftController.createShift);
router.put("/:id", authenticate, authorize("KOORDINATOR_LAB"), ShiftController.updateShift);
router.delete("/:id", authenticate, authorize("KOORDINATOR_LAB"), ShiftController.deleteShift);

export default router;
