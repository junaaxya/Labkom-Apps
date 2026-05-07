import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticate } from "../middlewares/auth.middleware";

const UPLOAD_ROOT = path.join(__dirname, "../../uploads");
const ALLOWED_CATEGORIES = ["conditions", "avatars", "tickets", "tasks", "evidence", "general"] as const;
type UploadCategory = (typeof ALLOWED_CATEGORIES)[number];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const conditionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(UPLOAD_ROOT, "conditions"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `condition-${uniqueSuffix}${ext}`);
  },
});

const genericStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const category = (req.query.category as string) || "general";
    // Validate category BEFORE writing file to prevent path traversal
    if (!ALLOWED_CATEGORIES.includes(category as UploadCategory)) {
      return cb(new Error(`Kategori tidak valid. Gunakan: ${ALLOWED_CATEGORIES.join(", ")}`), "");
    }
    const dir = path.join(UPLOAD_ROOT, category);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

function imageFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = /jpeg|jpg|png|webp/;
  const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowed.test(file.mimetype);
  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error("Hanya file gambar (jpg, png, webp) yang diizinkan"));
  }
}

const conditionUpload = multer({
  storage: conditionStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const genericUpload = multer({
  storage: genericStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const router = Router();

router.post(
  "/condition-photos",
  authenticate,
  conditionUpload.array("photos", 5),
  (req: Request, res: Response): void => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }
    const urls = files.map((f) => `/uploads/conditions/${f.filename}`);
    res.json({ success: true, data: { urls } });
  }
);

router.post(
  "/photos",
  authenticate,
  genericUpload.array("photos", 5),
  (req: Request, res: Response): void => {
    const category = (req.query.category as string) || "general";
    if (!ALLOWED_CATEGORIES.includes(category as UploadCategory)) {
      res.status(400).json({ success: false, message: `Kategori tidak valid. Gunakan: ${ALLOWED_CATEGORIES.join(", ")}` });
      return;
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }
    const urls = files.map((f) => `/uploads/${category}/${f.filename}`);
    res.json({ success: true, data: { urls } });
  }
);

router.post(
  "/avatar",
  authenticate,
  genericUpload.single("photo"),
  (req: Request, res: Response): void => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }
    const category = (req.query.category as string) || "avatars";
    const url = `/uploads/${category}/${file.filename}`;
    res.json({ success: true, data: { url } });
  }
);

export default router;
