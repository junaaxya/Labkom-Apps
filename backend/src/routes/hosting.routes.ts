import { Router } from "express";
import rateLimit from "express-rate-limit";
import { HostingController } from "../controllers/hosting.controller";
import { bodyIdentityRateLimitKey } from "../middlewares/rate-limit-key";

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Terlalu banyak percobaan checkout. Coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => bodyIdentityRateLimitKey(req, "hosting-checkout", ["customer.email"]),
});

router.get("/plans", HostingController.getPlans);
router.post("/transactions", checkoutLimiter, HostingController.createTransaction);

export default router;
