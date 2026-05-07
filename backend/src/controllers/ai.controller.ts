import { Request, Response, NextFunction } from "express";
import { aiAssistantService } from "../services/ai-assistant.service";
import { predictiveMaintenanceService } from "../services/predictive-maintenance.service";
import { smartSchedulingService } from "../services/smart-scheduling.service";

export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ success: false, message: "message is required" });
      return;
    }
    const result = await aiAssistantService.chat(req.user!.userId, message);
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
    aiAssistantService.clearMemory(req.user!.userId);
    res.json({ success: true, message: "Chat history cleared" });
  } catch (error) {
    next(error);
  }
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
    const duration = parseInt(req.query.duration as string) || 120;
    const preferredDay = req.query.day as string | undefined;
    const preferredLab = req.query.labId as string | undefined;
    const slots = await smartSchedulingService.suggestOptimalSlots(duration, preferredDay, preferredLab);
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
