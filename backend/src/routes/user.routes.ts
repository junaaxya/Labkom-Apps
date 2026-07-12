import { Router } from "express";
import multer from "multer";
import { UserController } from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    const validExtension = /\.(csv|xlsx)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || validExtension) cb(null, true);
    else cb(new Error("Format file harus CSV atau XLSX"));
  },
});

router.get("/", authenticate, authorize("KOORDINATOR_LAB"), UserController.getAllUsers);
router.get("/stats", authenticate, authorize("KOORDINATOR_LAB"), UserController.getUserStats);
router.post("/import", authenticate, authorize("KOORDINATOR_LAB"), upload.single("file"), UserController.importUsers);
router.get("/:id", authenticate, authorize("KOORDINATOR_LAB"), UserController.getUserById);
router.post("/", authenticate, authorize("KOORDINATOR_LAB"), UserController.createUser);
router.put("/:id", authenticate, authorize("KOORDINATOR_LAB"), UserController.updateUser);
router.patch("/:id/toggle-active", authenticate, authorize("KOORDINATOR_LAB"), UserController.toggleActive);
router.patch("/:id/reset-password", authenticate, authorize("KOORDINATOR_LAB"), UserController.resetPassword);

export default router;
