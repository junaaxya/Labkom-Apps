import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import { authenticate } from "../middlewares/auth.middleware";
import { getUploadPath, isProtectedUploadCategory, isUploadCategory, type UploadCategory } from "../config/upload";
import { authorizeProtectedFileAccess } from "../services/protected-file-access.service";
import {
  authenticateProtectedFileSession,
  createProtectedFileSession,
  revokeProtectedFileSession,
  setProtectedFileSessionCookie,
} from "../services/protected-file-session.service";

const router = Router();
const fileSessionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

router.post("/session", authenticate, fileSessionLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await createProtectedFileSession(req.user!.userId);
    setProtectedFileSessionCookie(res, token);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete("/session", fileSessionLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeProtectedFileSession(req, res);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

function authenticateFileRequest(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    void authenticate(req, res, next);
    return;
  }
  void authenticateProtectedFileSession(req, res, next);
}

router.get("/:category/:filename", authenticateFileRequest, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
    const allowed = await authorizeProtectedFileAccess(req.user!.userId, req.user!.role, category, filename);
    if (!allowed) {
      res.status(404).json({ success: false, message: "File tidak ditemukan" });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "File tidak ditemukan" });
      return;
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

export default router;
