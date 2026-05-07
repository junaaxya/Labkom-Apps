import { Request, Response, NextFunction } from "express";
import { faqBotService } from "../services/faq-bot.service";

export const askQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      res.status(400).json({ success: false, message: "question is required" });
      return;
    }

    const result = await faqBotService.getAnswer(question);

    if (!result) {
      res.json({
        success: true,
        data: {
          answer: "Maaf, saya belum bisa menjawab pertanyaan tersebut. Silakan hubungi Asisten Lab atau Koordinator Lab untuk bantuan lebih lanjut.",
          category: "Unknown",
          confidence: 0,
        },
      });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAllFAQs = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const faqs = faqBotService.getAllFAQs();
    res.json({ success: true, data: faqs });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = faqBotService.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const getStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await faqBotService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};
