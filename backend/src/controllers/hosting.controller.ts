import { Request, Response } from "express";
import { ZodError } from "zod";
import { HostingService } from "../services/hosting.service";
import { createHostingTransactionSchema } from "../validators/hosting.validator";

export class HostingController {
  static getPlans(_req: Request, res: Response): void {
    res.json({
      success: true,
      data: HostingService.getPlans(),
    });
  }

  static async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      const validated = createHostingTransactionSchema.parse(req.body);
      const transaction = await HostingService.createDuitkuTransaction(
        validated.planId,
        validated.customer,
        validated.paymentMethod
      );

      res.status(201).json({
        success: true,
        message: "Transaksi pembayaran berhasil dibuat",
        data: transaction,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: "Validasi gagal",
          errors: error.issues,
        });
        return;
      }

      const message = error.message || "Gagal membuat transaksi pembayaran";
      const statusCode = message.includes("DUITKU_") ? 500 : 400;
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  static handleCallback(req: Request, res: Response): void {
    try {
      const isValid = HostingService.verifyDuitkuCallbackSignature(req.body);
      const payload = {
        merchantOrderId: req.body?.merchantOrderId,
        reference: req.body?.reference,
        resultCode: req.body?.resultCode,
        amount: req.body?.amount,
        paymentCode: req.body?.paymentCode,
      };

      if (isValid) {
        console.log("[Duitku Callback] valid", payload);
      } else {
        console.warn("[Duitku Callback] invalid signature", payload);
      }
    } catch (error) {
      console.error("[Duitku Callback] handler error", error);
    }

    res.status(200).json({ success: true });
  }

  static async getTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const orderIdParam = req.params.orderId;
      const orderId = Array.isArray(orderIdParam) ? orderIdParam[0] : orderIdParam;
      if (!orderId) {
        res.status(400).json({ success: false, message: "Order ID wajib diisi" });
        return;
      }

      const status = await HostingService.getTransactionStatusLive(orderId);
      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      const message = error.message || "Gagal mengecek status transaksi";
      const statusCode = message.includes("DUITKU_") ? 500 : 400;
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  static async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const amount = Number(req.query.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ success: false, message: "Amount wajib berupa angka positif" });
        return;
      }

      const methods = await HostingService.getActivePaymentMethods(amount);
      res.json({
        success: true,
        data: methods,
      });
    } catch (error: any) {
      const message = error.message || "Gagal mengambil metode pembayaran";
      const statusCode = message.includes("DUITKU_") ? 500 : 400;
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
}
