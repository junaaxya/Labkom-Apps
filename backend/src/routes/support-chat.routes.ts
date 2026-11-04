import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { SupportChatController } from "../controllers/support-chat.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { getImageExtension, uploadLimits } from "../config/upload";

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadLimits["support-chats"], files: 1 },
  fileFilter: (_req, file, callback) => {
    if (getImageExtension(file.mimetype)) callback(null, true);
    else callback(new Error("Hanya gambar JPG, PNG, atau WebP yang diizinkan"));
  },
});
const uploadImage = (req: Request, res: Response, next: NextFunction) => imageUpload.single("image")(req, res, (error) => {
  if (!error) return next();
  const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "Ukuran foto maksimal 2 MB" : error.message;
  res.status(400).json({ success: false, message });
});

router.post("/", authenticate, authorize("MAHASISWA"), SupportChatController.create);
router.get("/", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.getAll);
router.get("/:id", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.getById);
router.post("/:id/claim", authenticate, authorize("ASISTEN_LAB"), SupportChatController.claim);
router.post("/:id/messages", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), uploadImage, SupportChatController.createMessage);
router.patch("/:id/messages/:messageId/receipt", authenticate, authorize("MAHASISWA", "ASISTEN_LAB"), SupportChatController.recordReceipt);

export default router;
