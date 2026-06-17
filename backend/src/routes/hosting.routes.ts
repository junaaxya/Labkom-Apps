import { Router } from "express";
import rateLimit from "express-rate-limit";
import { HostingController } from "../controllers/hosting.controller";

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Terlalu banyak percobaan checkout. Coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/plans", HostingController.getPlans);
router.post("/transactions", checkoutLimiter, HostingController.createTransaction);

export default router;
