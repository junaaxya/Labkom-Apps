import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { authenticatedUserRateLimitKey } from "../middlewares/rate-limit-key";
import { loginAccountLimiterOptions, loginIpLimiterOptions } from "./auth-rate-limit";

const router = Router();

const loginIpLimiter = rateLimit(loginIpLimiterOptions);
const loginAccountLimiter = rateLimit(loginAccountLimiterOptions);

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Terlalu banyak registrasi. Coba lagi dalam 1 jam." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => authenticatedUserRateLimitKey(req, "coordinator-register"),
});

router.post("/register", authenticate, authorize("KOORDINATOR_LAB"), registerLimiter, AuthController.register);
router.post("/login", loginIpLimiter, loginAccountLimiter, AuthController.login);
router.get("/profile", authenticate, AuthController.getProfile);
router.patch("/profile", authenticate, AuthController.updateProfile);
router.patch("/change-password", authenticate, AuthController.changePassword);

export default router;
