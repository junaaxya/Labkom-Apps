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

async function resolveActiveUser(token: string): Promise<JwtPayload> {
  const decoded = jwt.verify(token, config.jwtSecret) as Partial<JwtPayload>;
  if (!decoded.userId) throw new Error("INVALID_TOKEN");

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, role: true, isActive: true },
  });

  if (!user?.isActive) throw new Error("INACTIVE_USER");
  return { userId: user.id, role: user.role };
}

function authenticationFailure(res: Response): void {
  res.status(401).json({
    success: false,
    message: "Sesi tidak valid, sudah kedaluwarsa, atau akun tidak aktif. Silakan login kembali.",
  });
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

  if (!token) {
    res.status(401).json({ success: false, message: "Token tidak ditemukan. Silakan login." });
    return;
  }

  try {
    req.user = await resolveActiveUser(token);
    next();
  } catch {
    authenticationFailure(res);
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
