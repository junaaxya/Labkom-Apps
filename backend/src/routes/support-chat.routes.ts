import { Router } from "express";
import { SupportChatController } from "../controllers/support-chat.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticate, authorize("MAHASISWA"), SupportChatController.create);
router.get("/", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.getAll);
router.get("/:id", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.getById);
router.post("/:id/claim", authenticate, authorize("ASISTEN_LAB"), SupportChatController.claim);
router.post("/:id/messages", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.createMessage);
router.patch("/:id/messages/:messageId/receipt", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.recordReceipt);

export default router;
