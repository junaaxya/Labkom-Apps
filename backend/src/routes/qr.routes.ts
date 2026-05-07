import { Router } from "express";
import { QRController } from "../controllers/qr.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/scan/key/:code", authenticate, QRController.scanKey);
router.get("/scan/pc/:code", authenticate, QRController.scanPC);

router.get("/keys/:id/image", authenticate, QRController.getKeyQRImage);
router.get("/keys/:id/png", authenticate, QRController.getKeyQRPng);
router.post("/keys/:id/generate", authenticate, authorize("KOORDINATOR_LAB"), QRController.generateKeyQR);
router.post("/keys/bulk-generate", authenticate, authorize("KOORDINATOR_LAB"), QRController.bulkGenerateKeyQR);

router.get("/pcs/:id/image", authenticate, QRController.getPCQRImage);
router.get("/pcs/:id/png", authenticate, QRController.getPCQRPng);
router.post("/pcs/:id/generate", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), QRController.generatePCQR);
router.post("/pcs/bulk-generate", authenticate, authorize("KOORDINATOR_LAB"), QRController.bulkGeneratePCQR);
router.post("/pcs/bulk-asset-codes", authenticate, authorize("KOORDINATOR_LAB"), QRController.bulkGenerateAssetCodes);

router.get("/print-sheet", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), QRController.getPrintSheet);

export default router;
