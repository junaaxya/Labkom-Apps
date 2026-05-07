import { Request, Response, NextFunction } from "express";
import { whatsappService } from "../services/whatsapp.service";

export const getStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = whatsappService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

export const connect = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await whatsappService.connect();
    const status = whatsappService.getStatus();
    res.json({ success: true, message: "WhatsApp connection initiated", data: status });
  } catch (error) {
    next(error);
  }
};

export const disconnect = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await whatsappService.disconnect();
    res.json({ success: true, message: "WhatsApp disconnected" });
  } catch (error) {
    next(error);
  }
};

export const resetAuth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    whatsappService.clearAuth();
    res.json({ success: true, message: "Auth cleared. Reconnect to get new QR." });
  } catch (error) {
    next(error);
  }
};

export const sendTestMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      res.status(400).json({ success: false, message: "phone and message required" });
      return;
    }

    const sent = await whatsappService.sendMessage(phone, message);
    res.json({ success: sent, message: sent ? "Message sent" : "Failed to send" });
  } catch (error) {
    next(error);
  }
};
