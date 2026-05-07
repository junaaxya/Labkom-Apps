import { Router } from "express";
import { LabController } from "../controllers/lab.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, LabController.getAllLabs);
router.get("/stats", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), LabController.getLabStats);
router.get("/:id", authenticate, LabController.getLabById);
router.post("/", authenticate, authorize("KOORDINATOR_LAB"), LabController.createLab);
router.put("/:id", authenticate, authorize("KOORDINATOR_LAB"), LabController.updateLab);
router.delete("/:id", authenticate, authorize("KOORDINATOR_LAB"), LabController.deleteLab);

router.get("/:labId/pcs", authenticate, LabController.getPCsByLab);
router.post("/pcs", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), LabController.createPC);
router.get("/pcs/:id", authenticate, LabController.getPCById);
router.put("/pcs/:id", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), LabController.updatePC);
router.delete("/pcs/:id", authenticate, authorize("KOORDINATOR_LAB"), LabController.deletePC);

export default router;
