import { Router } from "express";
import rateLimit from "express-rate-limit";
import { LeaveController } from "../controllers/leave.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
const leaveMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.userId,
  message: { success: false, message: "Terlalu banyak permintaan izin. Coba lagi nanti." },
});

router.post("/", authenticate, authorize("ASISTEN_LAB"), leaveMutationLimiter, LeaveController.createRequest);
router.get("/my", authenticate, LeaveController.getMyRequests);
router.get("/", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.getAllRequests);
router.get("/pending-count", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.getPendingCount);
router.get("/user/:userId", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.getRequestsByUser);
router.patch("/:id/approve", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.approveRequest);
router.patch("/:id/reject", authenticate, authorize("KOORDINATOR_LAB"), LeaveController.rejectRequest);

export default router;
