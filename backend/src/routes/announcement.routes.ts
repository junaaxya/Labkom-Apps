import { Router } from "express";
import { AnnouncementController } from "../controllers/announcement.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, AnnouncementController.getActive);
router.get(
  "/manage",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  AnnouncementController.getManage
);
router.get("/:id", authenticate, AnnouncementController.getById);
router.post(
  "/",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  AnnouncementController.create
);
router.patch(
  "/:id",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  AnnouncementController.update
);
router.delete(
  "/:id",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  AnnouncementController.remove
);
router.patch(
  "/:id/publish",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  AnnouncementController.togglePublish
);
router.patch(
  "/:id/pin",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  AnnouncementController.togglePin
);

export default router;
