import { Router } from "express";
import { AssetController } from "../controllers/asset.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AssetController.list);
router.get("/summary", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AssetController.summary);
router.post("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AssetController.create);
router.post("/backfill-pcs", authenticate, authorize("KOORDINATOR_LAB"), AssetController.backfillPCs);
router.get("/:id", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AssetController.getById);
router.patch("/:id", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AssetController.update);
router.delete("/:id", authenticate, authorize("KOORDINATOR_LAB"), AssetController.remove);
router.post("/:id/maintenance", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), AssetController.addMaintenance);
router.get("/:id/audit", authenticate, authorize("KOORDINATOR_LAB"), AssetController.audit);

export default router;
