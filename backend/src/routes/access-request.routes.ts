import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AccessRequestController } from "../controllers/access-request.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { bodyIdentityRateLimitKey } from "../middlewares/rate-limit-key";

const router = Router();
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => bodyIdentityRateLimitKey(req, "external-student", ["email", "token"]),
});

router.get("/labs", AccessRequestController.getPublicLabs);
router.post("/external-student", registrationLimiter, AccessRequestController.registerExternalStudent);
router.post("/external-student/resend", registrationLimiter, AccessRequestController.resendExternalStudent);
router.post("/external-student/verify", registrationLimiter, AccessRequestController.verifyExternalStudent);
router.post("/", AccessRequestController.create);
router.post("/verify-email", AccessRequestController.verifyMagangEmail);
router.post("/resend-verification", AccessRequestController.resendMagangVerification);
router.get("/check/:requestCode", AccessRequestController.getByCode);
router.get("/academic-profile", authenticate, authorize("MAHASISWA"), AccessRequestController.getAcademicProfileStatus);
router.patch("/academic-profile", authenticate, authorize("MAHASISWA"), AccessRequestController.completeAcademicProfile);
router.get("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AccessRequestController.getAll);
router.get("/:id", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AccessRequestController.getById);
router.patch("/:id/status", authenticate, authorize("KOORDINATOR_LAB"), AccessRequestController.review);
router.post("/:id/requeue-approval-email", authenticate, authorize("KOORDINATOR_LAB"), AccessRequestController.requeueApprovalEmail);

export default router;
