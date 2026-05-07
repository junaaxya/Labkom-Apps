import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, authorize("KOORDINATOR_LAB"), UserController.getAllUsers);
router.get("/stats", authenticate, authorize("KOORDINATOR_LAB"), UserController.getUserStats);
router.get("/:id", authenticate, authorize("KOORDINATOR_LAB"), UserController.getUserById);
router.post("/", authenticate, authorize("KOORDINATOR_LAB"), UserController.createUser);
router.put("/:id", authenticate, authorize("KOORDINATOR_LAB"), UserController.updateUser);
router.patch("/:id/toggle-active", authenticate, authorize("KOORDINATOR_LAB"), UserController.toggleActive);
router.patch("/:id/reset-password", authenticate, authorize("KOORDINATOR_LAB"), UserController.resetPassword);

export default router;
