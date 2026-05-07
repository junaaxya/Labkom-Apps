import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as whatsappController from "../controllers/whatsapp.controller";

const router = Router();

router.use(authenticate);
router.use(authorize("KOORDINATOR_LAB"));

router.get("/status", whatsappController.getStatus);
router.post("/connect", whatsappController.connect);
router.post("/disconnect", whatsappController.disconnect);
router.post("/reset", whatsappController.resetAuth);
router.post("/send-test", whatsappController.sendTestMessage);

export default router;
