import { Router } from "express";
import { AttendanceController } from "../controllers/attendance.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Aslab: Check-in / Check-out
router.post("/checkin", authenticate, authorize("ASISTEN_LAB"), AttendanceController.checkin);
router.post("/checkout", authenticate, authorize("ASISTEN_LAB"), AttendanceController.checkout);
router.get("/me", authenticate, AttendanceController.getMyAttendance);
router.get("/stats", authenticate, AttendanceController.getAttendanceStats);
router.get("/today-count", authenticate, AttendanceController.getTodayCount);

// Aslab: Daily Tasks
router.post("/tasks", authenticate, authorize("ASISTEN_LAB"), AttendanceController.addDailyTask);
router.patch("/tasks/:taskId", authenticate, authorize("ASISTEN_LAB"), AttendanceController.updateDailyTask);
router.get("/tasks/me", authenticate, AttendanceController.getMyDailyTasks);
router.get("/tasks/stats", authenticate, AttendanceController.getDailyTaskStats);

// Aslab: Shift Schedules
router.get("/shift-schedules/me", authenticate, AttendanceController.getMyShiftSchedules);

// Aslab: Correction Requests
router.post("/corrections", authenticate, authorize("ASISTEN_LAB"), AttendanceController.createCorrectionRequest);
router.get("/corrections/me", authenticate, AttendanceController.getMyCorrectionRequests);

// Koordinator: Monitoring & Verification
router.get("/monitoring/today", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getTodayMonitoring);
router.get("/all", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getAllAttendance);
router.get("/recap", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getMonthlyRecap);
router.patch("/:id/verify", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.verifyAttendance);
router.post("/mark-absent", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.markAbsent);
router.get("/detail/:userId", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getAslebDetail);

// Koordinator: Daily Task Review
router.get("/tasks/pending", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getPendingTasks);
router.get("/tasks/all", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getAllDailyTasks);
router.patch("/tasks/:taskId/review", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.reviewTask);

// Koordinator: Shift Schedule Management
router.get("/shift-schedules", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getShiftSchedules);
router.post("/shift-schedules", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.createShiftSchedule);
router.patch("/shift-schedules/:id", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.updateShiftSchedule);
router.delete("/shift-schedules/:id", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.deleteShiftSchedule);

// Koordinator: Correction Review
router.get("/corrections/pending", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getPendingCorrections);
router.patch("/corrections/:id/review", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.reviewCorrection);

// Koordinator: Settings
router.get("/settings", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getSettings);
router.patch("/settings", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.updateSettings);

// Koordinator: Locations
router.get("/locations", authenticate, AttendanceController.getLocations);
router.post("/locations", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.createLocation);
router.patch("/locations/:id", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.updateLocation);
router.delete("/locations/:id", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.deleteLocation);

// Koordinator: Task Categories
router.get("/task-categories", authenticate, AttendanceController.getTaskCategories);
router.post("/task-categories", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.createTaskCategory);
router.patch("/task-categories/:id", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.updateTaskCategory);
router.delete("/task-categories/:id", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.deleteTaskCategory);

// Aslab: Leave Requests
router.post("/leaves", authenticate, authorize("ASISTEN_LAB"), AttendanceController.submitLeaveRequest);
router.get("/leaves/me", authenticate, AttendanceController.getMyLeaveRequests);

// Koordinator: Leave Review
router.get("/leaves/pending", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getPendingLeaveRequests);
router.get("/leaves/all", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.getAllLeaveRequests);
router.patch("/leaves/:id/review", authenticate, authorize("KOORDINATOR_LAB"), AttendanceController.reviewLeaveRequest);

export default router;
