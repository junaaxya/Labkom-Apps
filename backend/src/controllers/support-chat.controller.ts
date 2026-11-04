import type { Request, Response } from "express";
import { ZodError } from "zod";
import { SupportChatError } from "../services/support-chat.error";
import { SupportChatService } from "../services/support-chat.service";
import {
  createSupportChatMessageSchema,
  createSupportChatSchema,
  recordSupportChatReceiptSchema,
} from "../validators/support-chat.validator";
import { hasImageSignature } from "../config/upload";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

function respondError(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, message: "Validasi gagal", errors: error.issues });
    return;
  }
  if (error instanceof SupportChatError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  res.status(500).json({ success: false, message: "Chat dukungan tidak dapat diproses" });
}

export class SupportChatController {
  static async create(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    try {
      const input = createSupportChatSchema.parse(req.body);
      const chat = await SupportChatService.createChat(req.user.userId, input);
      res.status(201).json({ success: true, message: "Chat dukungan berhasil dibuat", data: chat });
    } catch (error) {
      respondError(res, error);
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    try {
      const chats = await SupportChatService.getChatsForUser(req.user);
      res.json({ success: true, data: chats });
    } catch (error) {
      respondError(res, error);
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    try {
      const chat = await SupportChatService.getChatById(getParam(req, "id"), req.user);
      res.json({ success: true, data: chat });
    } catch (error) {
      respondError(res, error);
    }
  }

  static async createMessage(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    try {
      const input = createSupportChatMessageSchema.parse(req.body);
      if (!input.body && !req.file) {
        res.status(400).json({ success: false, message: "Pesan atau foto wajib diisi", errors: [{ message: "Pesan atau foto wajib diisi" }] });
        return;
      }
      if (req.file && !hasImageSignature(req.file.buffer, req.file.mimetype)) {
        res.status(400).json({ success: false, message: "Isi file bukan gambar yang valid" });
        return;
      }
      const message = await SupportChatService.createMessage(getParam(req, "id"), req.user, input, new Date(), req.file);
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      respondError(res, error);
    }
  }

  static async claim(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    try {
      const chat = await SupportChatService.claimChat(getParam(req, "id"), req.user);
      res.json({ success: true, data: chat });
    } catch (error) {
      respondError(res, error);
    }
  }

  static async recordReceipt(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    try {
      const input = recordSupportChatReceiptSchema.parse(req.body);
      const message = await SupportChatService.recordReceipt(getParam(req, "id"), getParam(req, "messageId"), req.user, input);
      res.json({ success: true, data: message });
    } catch (error) {
      respondError(res, error);
    }
  }
}
