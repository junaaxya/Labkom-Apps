import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware";
import {
  createUploadFilename,
  ensureUploadDirectories,
  getImageExtension,
  getUploadCategoryDir,
  isUploadCategory,
  toUploadUrl,
  uploadCategories,
  uploadLimits,
  type UploadCategory,
} from "../config/upload";

ensureUploadDirectories();

function resolveCategory(req: Request, fallback: UploadCategory): UploadCategory {
  const rawCategory = (req.query.category as string | undefined) || fallback;
  if (!isUploadCategory(rawCategory)) {
    throw new Error(`Kategori tidak valid. Gunakan: ${uploadCategories.join(", ")}`);
  }
  return rawCategory;
}

function createImageUpload(fallbackCategory: UploadCategory, maxFiles: number) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        try {
          const category = resolveCategory(req, fallbackCategory);
          cb(null, getUploadCategoryDir(category));
        } catch (error) {
          cb(error as Error, "");
        }
      },
      filename: (req, file, cb) => {
        try {
          const category = resolveCategory(req, fallbackCategory);
          cb(null, createUploadFilename(category.slice(0, -1) || category, file.mimetype));
        } catch (error) {
          cb(error as Error, "");
        }
      },
    }),
    limits: {
      fileSize: uploadLimits[fallbackCategory],
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (getImageExtension(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new Error("Hanya file gambar JPG, PNG, atau WebP yang diizinkan"));
    },
  });
}

function handleMulterError(error: Error, _req: Request, res: Response, next: NextFunction): void {
  if (!error) {
    next();
    return;
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Ukuran file terlalu besar" : error.message;
    res.status(400).json({ success: false, message });
    return;
  }

  res.status(400).json({ success: false, message: error.message || "Upload gagal" });
}

const conditionUpload = createImageUpload("conditions", 5);
const genericUpload = createImageUpload("general", 5);
const avatarUpload = createImageUpload("avatars", 1);

const router = Router();

router.post(
  "/condition-photos",
  authenticate,
  conditionUpload.array("photos", 5),
  handleMulterError,
  (req: Request, res: Response): void => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }

    const urls = files.map((file) => toUploadUrl("conditions", file.filename));
    res.json({ success: true, data: { urls } });
  }
);

router.post(
  "/photos",
  authenticate,
  genericUpload.array("photos", 5),
  handleMulterError,
  (req: Request, res: Response): void => {
    const category = resolveCategory(req, "general");
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }

    const urls = files.map((file) => toUploadUrl(category, file.filename));
    res.json({ success: true, data: { urls } });
  }
);

router.post(
  "/avatar",
  authenticate,
  avatarUpload.single("photo"),
  handleMulterError,
  (req: Request, res: Response): void => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }

    res.json({ success: true, data: { url: toUploadUrl("avatars", file.filename) } });
  }
);

export default router;
