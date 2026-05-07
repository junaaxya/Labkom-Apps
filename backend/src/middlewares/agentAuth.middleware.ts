import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../config/database";
import { PC } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      pc?: PC;
    }
  }
}

/**
 * Agent auth middleware.
 * Expects:
 *   - Header: Authorization: Bearer <agent_token>
 *   - Body or params: pcCode (identifies which PC)
 *
 * Validates token by comparing SHA-256 hash with stored agentTokenHash.
 */
export function authenticateAgent(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Agent token tidak ditemukan.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  const pcCode = req.body?.pcCode || req.params?.pcCode || (req.query?.pcCode as string);

  if (!pcCode) {
    res.status(400).json({
      success: false,
      message: "pcCode wajib disertakan.",
    });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  prisma.pC
    .findUnique({ where: { pcCode } })
    .then((pc) => {
      if (!pc) {
        res.status(404).json({
          success: false,
          message: "PC tidak ditemukan.",
        });
        return;
      }

      if (!pc.agentTokenHash) {
        res.status(401).json({
          success: false,
          message: "PC belum memiliki agent token. Generate token terlebih dahulu.",
        });
        return;
      }

      if (pc.agentTokenHash !== tokenHash) {
        res.status(401).json({
          success: false,
          message: "Agent token tidak valid.",
        });
        return;
      }

      req.pc = pc;
      next();
    })
    .catch((err) => {
      console.error("Agent auth error:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    });
}
