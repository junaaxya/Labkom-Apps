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
      const transaction = await HostingService.createMidtransTransaction(
        validated.planId,
        validated.customer
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
      const statusCode = message.includes("MIDTRANS_SERVER_KEY") ? 500 : 400;
      res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }
}
