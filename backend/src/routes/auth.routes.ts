import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Terlalu banyak registrasi. Coba lagi dalam 1 jam." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", registerLimiter, authenticate, authorize("KOORDINATOR_LAB"), AuthController.register);
router.post("/login", authLimiter, AuthController.login);
router.get("/profile", authenticate, AuthController.getProfile);
router.patch("/profile", authenticate, AuthController.updateProfile);
router.patch("/change-password", authenticate, AuthController.changePassword);

export default router;
