import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { CertificateController } from "../controllers/certificate.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../../uploads/templates"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `template-${uniqueSuffix}${ext}`);
  },
});

const uploadTemplate = multer({
  storage: templateStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (jpg, png) yang diizinkan"));
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
