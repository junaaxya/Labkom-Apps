import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import * as faqController from "../controllers/faq.controller";

const router = Router();

router.use(authenticate);
router.post("/ask", faqController.askQuestion);
router.get("/list", faqController.getAllFAQs);
router.get("/categories", faqController.getCategories);
router.get("/stats", faqController.getStats);

export default router;
