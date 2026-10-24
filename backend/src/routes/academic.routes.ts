import { Router } from "express";
import { AcademicController } from "../controllers/academic.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/dosen", authorize("KOORDINATOR_LAB"), AcademicController.listDosen);
router.post("/dosen", authorize("KOORDINATOR_LAB"), AcademicController.createDosen);
router.patch("/dosen/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateDosen);

router.get("/terms", authorize("KOORDINATOR_LAB"), AcademicController.listTerms);
router.post("/terms", authorize("KOORDINATOR_LAB"), AcademicController.createTerm);
router.patch("/terms/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateTerm);

router.get("/courses", authorize("KOORDINATOR_LAB"), AcademicController.listCourses);
router.post("/courses", authorize("KOORDINATOR_LAB"), AcademicController.createCourse);
router.patch("/courses/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateCourse);

router.get("/classes", authorize("KOORDINATOR_LAB"), AcademicController.listClasses);
router.post("/classes", authorize("KOORDINATOR_LAB"), AcademicController.createClass);
router.patch("/classes/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateClass);

router.get("/memberships", authorize("KOORDINATOR_LAB"), AcademicController.listMemberships);
router.post("/memberships", authorize("KOORDINATOR_LAB"), AcademicController.createMembership);
router.patch("/memberships/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateMembership);

router.get("/leaders", authorize("KOORDINATOR_LAB"), AcademicController.listLeaders);
router.post("/leaders", authorize("KOORDINATOR_LAB"), AcademicController.assignLeader);
router.patch("/leaders/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateLeader);

router.get("/offerings", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.listOfferings);
router.post("/offerings", authorize("KOORDINATOR_LAB"), AcademicController.createOffering);
router.patch("/offerings/:id", authorize("KOORDINATOR_LAB"), AcademicController.updateOffering);
router.post("/offerings/:id/schedule", authorize("KOORDINATOR_LAB"), AcademicController.bindSchedule);

router.get("/pjs", authorize("KOORDINATOR_LAB"), AcademicController.listPjs);
router.post("/offerings/:offeringId/pjs", authorize("KOORDINATOR_LAB", "MAHASISWA"), AcademicController.assignPj);
router.patch("/pjs/:id", authorize("KOORDINATOR_LAB", "MAHASISWA"), AcademicController.updatePj);

router.get("/reports", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.listReports);
router.post("/reports", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.createReport);
router.get("/reports/:id", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.getReport);
router.patch("/reports/:id", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.updateReport);
router.get("/occurrence-releases", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.listOccurrenceReleases);
router.post("/occurrence-releases", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.releaseOccurrence);
router.get("/slot-requests", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.listSlotRequests);
router.post("/slot-requests", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.createSlotRequest);
router.patch("/slot-requests/:id/review", authorize("KOORDINATOR_LAB"), AcademicController.reviewSlotRequest);
router.get("/actual-schedules", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.listActualSchedules);
router.get("/occurrence-swaps", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.listOccurrenceSwaps);
router.post("/occurrence-swaps", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.createOccurrenceSwap);
router.post("/occurrence-swaps/:id/confirm", authorize("DOSEN", "MAHASISWA"), AcademicController.confirmOccurrenceSwap);
router.post("/occurrence-swaps/:id/cancel", authorize("KOORDINATOR_LAB", "DOSEN", "MAHASISWA"), AcademicController.cancelOccurrenceSwap);
router.patch("/occurrence-swaps/:id/review", authorize("KOORDINATOR_LAB"), AcademicController.reviewOccurrenceSwap);

export default router;
