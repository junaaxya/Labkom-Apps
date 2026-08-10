import { Router } from "express";
import { AccessRequestController } from "../controllers/access-request.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/labs", AccessRequestController.getPublicLabs);
router.post("/", AccessRequestController.create);
router.get("/check/:requestCode", AccessRequestController.getByCode);
router.get("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AccessRequestController.getAll);
router.get("/:id", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AccessRequestController.getById);
router.patch("/:id/status", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AccessRequestController.review);

export default router;
