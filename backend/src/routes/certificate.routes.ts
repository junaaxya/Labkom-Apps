import { Router, Request, Response } from "express";
import multer from "multer";
import { CertificateController } from "../controllers/certificate.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { createUploadFilename, getImageExtension, getUploadCategoryDir, uploadLimits } from "../config/upload";

const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadCategoryDir("templates"));
  },
  filename: (_req, file, cb) => {
    cb(null, createUploadFilename("template", file.mimetype));
  },
});

const uploadTemplate = multer({
  storage: templateStorage,
  limits: { fileSize: uploadLimits.templates },
  fileFilter: (_req, file, cb) => {
    if (getImageExtension(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar JPG, PNG, atau WebP yang diizinkan"));
    }
  },
});

const router = Router();

router.get("/", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.getAllCertificates);
router.get("/templates", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.getTemplates);
router.post(
  "/templates",
  authenticate,
  authorize("KOORDINATOR_LAB"),
  uploadTemplate.single("image"),
  CertificateController.uploadTemplate
);
router.delete("/templates/:templateId", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.deleteTemplate);
router.get("/user/:userId", authenticate, CertificateController.getUserCertificates);
router.get("/:id/download", authenticate, CertificateController.downloadCertificate);
router.post("/monthly-best", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.generateMonthlyBest);
router.post("/attendance-perfect", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.generateAttendancePerfect);
router.post("/mission-master", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.generateMissionMaster);
router.post("/skill-master", authenticate, authorize("KOORDINATOR_LAB"), CertificateController.generateSkillMaster);

export default router;
