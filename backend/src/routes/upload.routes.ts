import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware";
import prisma from "../config/database";
import {
  createUploadFilename,
  ensureUploadDirectories,
  getImageExtension,
  hasImageSignature,
  getUploadCategoryDir,
  getUploadPath,
  isUploadCategory,
  toUploadUrl,
  uploadCategories,
  uploadLimits,
  type UploadCategory,
} from "../config/upload";
import { registerTemporaryUploadOwner } from "../services/protected-file-access.service";

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

async function rememberOwners(req: Request, category: UploadCategory, files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((file) => registerTemporaryUploadOwner(req.user!.userId, category, file.filename)));
}

const router = Router();

async function removeFiles(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
}

router.post(
  "/condition-photos",
  authenticate,
  conditionUpload.array("photos", 5),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    const files = (req.files as Express.Multer.File[]) || [];
    try {
      if (!req.user) throw new Error("Unauthorized");
      if (files.length === 0) throw new Error("Tidak ada file yang diupload");
      const keyBorrowCycleId = typeof req.body.keyBorrowCycleId === "string" ? req.body.keyBorrowCycleId : "";
      if (!keyBorrowCycleId) throw new Error("Siklus peminjaman wajib diisi");
      const cycle = await prisma.keyBorrowCycle.findFirst({
        where: { id: keyBorrowCycleId, borrowerId: req.user.userId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!cycle) throw new Error("Siklus peminjaman aktif tidak ditemukan");
      const uploads = await Promise.all(files.map(async (file) => {
        const content = await fs.readFile(getUploadPath("conditions", file.filename));
        if (!hasImageSignature(content, file.mimetype)) throw new Error("Isi file bukan gambar yang valid");
        return { url: toUploadUrl("conditions", file.filename), sha256: crypto.createHash("sha256").update(content).digest("hex") };
      }));
      await prisma.conditionPhotoUpload.createMany({
        data: uploads.map((upload) => ({ ...upload, ownerId: req.user!.userId, keyBorrowCycleId: cycle.id })),
      });
      await rememberOwners(req, "conditions", files);
      res.json({ success: true, data: { urls: uploads.map((upload) => upload.url) } });
    } catch (error) {
      await removeFiles(files);
      const message = error instanceof Error ? error.message : "Upload gagal";
      res.status(message === "Unauthorized" ? 401 : 400).json({ success: false, message });
    }
  }
);

router.post(
  "/photos",
  authenticate,
  genericUpload.array("photos", 5),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const category = resolveCategory(req, "general");
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }

    try {
      await Promise.all(files.map(async (file) => {
        const content = await fs.readFile(file.path);
        if (!hasImageSignature(content, file.mimetype)) {
          throw new Error("Isi file bukan gambar yang valid");
        }
      }));
      await rememberOwners(req, category, files);
      const urls = files.map((file) => toUploadUrl(category, file.filename));
      res.json({ success: true, data: { urls } });
    } catch (error) {
      await removeFiles(files);
      const message = error instanceof Error ? error.message : "Upload gagal";
      res.status(400).json({ success: false, message });
    }
  }
);

router.post(
  "/avatar",
  authenticate,
  avatarUpload.single("photo"),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: "Tidak ada file yang diupload" });
      return;
    }

    try {
      const content = await fs.readFile(file.path);
      if (!hasImageSignature(content, file.mimetype)) throw new Error("Isi file bukan gambar yang valid");
      res.json({ success: true, data: { url: toUploadUrl("avatars", file.filename) } });
    } catch (error) {
      await removeFiles([file]);
      const message = error instanceof Error ? error.message : "Upload gagal";
      res.status(400).json({ success: false, message });
    }
  }
);

export default router;
