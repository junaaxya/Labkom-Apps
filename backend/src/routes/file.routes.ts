import { Router, Request, Response } from "express";
import fs from "fs";
import { authenticate } from "../middlewares/auth.middleware";
import { getUploadPath, isProtectedUploadCategory, isUploadCategory, type UploadCategory } from "../config/upload";

const router = Router();

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

router.get("/:category/:filename", authenticate, (req: Request, res: Response): void => {
  const rawCategory = getParam(req.params.category);
  const filename = getParam(req.params.filename);

  if (!rawCategory || !isUploadCategory(rawCategory)) {
    res.status(400).json({ success: false, message: "Kategori file tidak valid" });
    return;
  }

  const category = rawCategory as UploadCategory;
  if (!isProtectedUploadCategory(category)) {
    res.status(404).json({ success: false, message: "File tidak ditemukan" });
    return;
  }

  try {
    const filePath = getUploadPath(category, filename || "");
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "File tidak ditemukan" });
      return;
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch {
    res.status(400).json({ success: false, message: "Path file tidak valid" });
  }
});

export default router;
