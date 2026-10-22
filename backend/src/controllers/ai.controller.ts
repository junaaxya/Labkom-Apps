import { Request, Response, NextFunction } from "express";
import { aiAssistantService } from "../services/ai-assistant.service";
import { predictiveMaintenanceService } from "../services/predictive-maintenance.service";
import { smartSchedulingService } from "../services/smart-scheduling.service";
import { smartSchedulingSuggestionQuerySchema } from "../validators/smart-scheduling.validator";
import { aiRuntimeService, FeedbackRating, FeedbackReason } from "../services/ai-runtime.service";
import prisma from "../config/database";

export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, actionId } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive) {
      res.status(403).json({ success: false, message: "Akun tidak aktif" });
      return;
    }

    let resolvedMessage = message;
    if (actionId && typeof actionId === "string") {
      const action = await aiRuntimeService.resolveAction(actionId, user.role);
      if (!action) {
        res.status(403).json({ success: false, message: "Aksi cepat tidak tersedia untuk peran akun kamu" });
        return;
      }
      resolvedMessage = action.message;
    }

    if (!resolvedMessage || typeof resolvedMessage !== "string") {
      res.status(400).json({ success: false, message: "Pesan atau aksi cepat diperlukan" });
      return;
    }
    const normalizedMessage = resolvedMessage.trim();
    if (!normalizedMessage || normalizedMessage.length > 1000) {
      res.status(400).json({ success: false, message: "Pesan harus berisi 1 sampai 1000 karakter" });
      return;
    }
    const result = await aiAssistantService.chat(req.user!.userId, normalizedMessage);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const insights = await aiAssistantService.getProactiveInsights(req.user!.userId);
    res.json({ success: true, data: insights });
  } catch (error) {
    next(error);
  }
};

export const clearChatHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await aiAssistantService.clearMemory(req.user!.userId);
    res.json({ success: true, message: "Riwayat percakapan dihapus" });
  } catch (error) {
    next(error);
  }
};

export const getChatHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const turns = await aiAssistantService.getHistory(req.user!.userId);
    res.json({ success: true, data: turns });
  } catch (error) { next(error); }
};

export const getQuickActions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { role: true, isActive: true } });
    if (!user?.isActive) { res.status(403).json({ success: false, message: "Akun tidak aktif" }); return; }
    res.json({ success: true, data: aiRuntimeService.getQuickActions(user.role) });
  } catch (error) { next(error); }
};

export const submitFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { responseId, rating, reason, comment } = req.body as {
      responseId?: string; rating?: FeedbackRating; reason?: FeedbackReason; comment?: string;
    };
    if (!responseId || !/^[0-9a-f-]{36}$/i.test(responseId) || !rating || !["UP", "DOWN"].includes(rating)) {
      res.status(400).json({ success: false, message: "Feedback tidak valid" }); return;
    }
    if (comment && (typeof comment !== "string" || comment.trim().length > 500)) {
      res.status(400).json({ success: false, message: "Komentar maksimal 500 karakter" }); return;
    }
    const result = await aiRuntimeService.submitFeedback(req.user!.userId, responseId, rating, reason, comment?.trim());
    const statuses = { created: 201, duplicate: 409, missing: 404, forbidden: 403 } as const;
    const messages = { created: "Terima kasih atas feedback kamu", duplicate: "Feedback sudah dikirim", missing: "Jawaban tidak ditemukan atau sudah kedaluwarsa", forbidden: "Feedback bukan milik akun kamu" } as const;
    res.status(statuses[result]).json({ success: result === "created", message: messages[result] });
  } catch (error) { next(error); }
};

export const getAiMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const data = await aiRuntimeService.getMetrics(req.user!.userId, days);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getRiskScores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const labId = req.query.labId as string | undefined;
    const scores = await predictiveMaintenanceService.getPCRiskScores(labId);
    res.json({ success: true, data: scores });
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceSchedule = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await predictiveMaintenanceService.getMaintenanceSchedule();
    res.json({ success: true, data: schedule });
  } catch (error) {
    next(error);
  }
};

export const getTrendAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = parseInt(req.query.months as string) || 3;
    const trends = await predictiveMaintenanceService.getTrendAnalysis(months);
    res.json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
};

export const getOverallHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await predictiveMaintenanceService.getOverallHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    next(error);
  }
};

export const suggestSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = smartSchedulingSuggestionQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Parameter Smart Scheduling tidak valid",
        errors: parsed.error.issues,
      });
      return;
    }

    const slots = await smartSchedulingService.suggestOptimalSlots(
      parsed.data.duration,
      parsed.data.day,
      parsed.data.labId,
      parsed.data.targetDate
    );
    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

export const getUsagePatterns = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const patterns = await smartSchedulingService.getUsagePatterns();
    res.json({ success: true, data: patterns });
  } catch (error) {
    next(error);
  }
};

export const getLoadBalance = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await smartSchedulingService.getLoadBalance();
    res.json({ success: true, data: balance });
  } catch (error) {
    next(error);
  }
};

export const detectConflicts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await smartSchedulingService.detectConflicts();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAssistantWorkload = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await smartSchedulingService.getAssistantWorkload();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
