import { Router } from "express";
import { LeaveController } from "../controllers/leave.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticate, authorize("ASISTEN_LAB"), LeaveController.createRequest);
router.get("/my", authenticate, LeaveController.getMyRequests);
router.get("/", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.getAllRequests);
router.get("/pending-count", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.getPendingCount);
router.get("/user/:userId", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.getRequestsByUser);
router.patch("/:id/approve", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.approveRequest);
router.patch("/:id/reject", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.rejectRequest);

export default router;
