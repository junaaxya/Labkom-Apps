import { Router } from "express";
import { SmartAcademicController } from "../controllers/smart-academic.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);
router.get("/schedules", authorize("KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"), SmartAcademicController.schedules);
router.get("/schedules/:scheduleId/classmates", authorize("KOORDINATOR_LAB", "MAHASISWA"), SmartAcademicController.classmates);
router.post("/schedules/:scheduleId/pjs", authorize("KOORDINATOR_LAB", "MAHASISWA"), SmartAcademicController.assignPj);
router.delete("/schedules/:scheduleId/pjs/:studentId", authorize("KOORDINATOR_LAB", "MAHASISWA"), SmartAcademicController.removePj);
router.get("/reports", authorize("KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"), SmartAcademicController.reports);
router.post("/reports", authorize("KOORDINATOR_LAB", "MAHASISWA"), SmartAcademicController.report);
router.get("/moves", authorize("KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"), SmartAcademicController.moves);
router.post("/moves", authorize("KOORDINATOR_LAB", "MAHASISWA"), SmartAcademicController.requestMove);
router.patch("/moves/:id/review", authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), SmartAcademicController.review);
export default router;
