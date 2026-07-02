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

const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Terlalu banyak pengecekan status. Coba lagi nanti." },
  standardHeaders: true,
  legacyHeaders: false,
});

const callbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  statusCode: 200,
  message: { success: true },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/plans", HostingController.getPlans);
router.get("/payment-methods", statusLimiter, HostingController.getPaymentMethods);
router.post("/transactions", checkoutLimiter, HostingController.createTransaction);
router.get("/transactions/:orderId", statusLimiter, HostingController.getTransactionStatus);
router.post("/callback", callbackLimiter, HostingController.handleCallback);

export default router;
