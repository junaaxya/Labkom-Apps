import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../config/database";

interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
  if (!token) {
    res.status(401).json({ success: false, message: "Token tidak ditemukan. Silakan login." });
    return;
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    if (typeof decoded.userId !== "string") throw new Error("Invalid token payload");
  } catch {
    res.status(401).json({ success: false, message: "Token tidak valid atau sudah expired." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true, mustChangePassword: true, registrationSource: true, semester: true, studyProgram: true, className: true, academicProfileCompletedAt: true, academicProfileTermId: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: "Sesi tidak valid. Silakan login kembali." });
      return;
    }

    const path = req.originalUrl.split("?")[0];
    const passwordChangeRoute =
      (req.method === "GET" && path === "/api/v1/auth/profile") ||
      (req.method === "PATCH" && path === "/api/v1/auth/change-password");
    if (user.mustChangePassword && !passwordChangeRoute) {
      res.status(403).json({ success: false, message: "Anda wajib mengganti password sebelum mengakses fitur lain." });
      return;
    }

    if (user.registrationSource === "EXTERNAL_SELF_REGISTRATION") {
      const activeTerm = await prisma.academicTerm.findFirst({ where: { isActive: true }, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }], select: { id: true } });
      const academicProfileRequired = !user.academicProfileCompletedAt || !user.semester || !user.studyProgram || !user.className || Boolean(activeTerm && user.academicProfileTermId !== activeTerm.id);
      const onboardingRoute =
        path === "/api/v1/auth/profile" ||
        path === "/api/v1/files/session" ||
        path === "/api/v1/access-requests/academic-profile";
      if (academicProfileRequired && !onboardingRoute) {
        res.status(403).json({ success: false, message: "Lengkapi atau konfirmasi profil akademik sebelum mengakses fitur lain.", data: { code: "ACADEMIC_PROFILE_REQUIRED" } });
        return;
      }
    }

    req.user = { userId: user.id, role: user.role };
    next();
  } catch (error) {
    console.error("Auth user lookup error:", error);
    res.status(500).json({ success: false, message: "Gagal memverifikasi sesi." });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Tidak terautentikasi." });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Anda tidak memiliki akses untuk resource ini." });
      return;
    }
    next();
  };
}
