import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

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

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Token tidak ditemukan. Silakan login.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah expired.",
    });
  }
}

export function authenticateQueryToken(req: Request, res: Response, next: NextFunction): void {
  const queryToken = req.query.token as string | undefined;

  if (!queryToken) {
    authenticate(req, res, next);
    return;
  }

  try {
    const decoded = jwt.verify(queryToken, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Token tidak valid atau sudah expired.",
    });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Tidak terautentikasi.",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses untuk resource ini.",
      });
      return;
    }

    next();
  };
}
