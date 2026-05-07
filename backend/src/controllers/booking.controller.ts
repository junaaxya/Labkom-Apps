import { Request, Response } from "express";
import { BookingService } from "../services/booking.service";
import {
  createBookingSchema,
  getAllBookingsQuerySchema,
  rejectBookingSchema,
} from "../validators/booking.validator";

function getParam(params: Record<string, string | string[]>, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}

export class BookingController {
  static async getAllBookings(req: Request, res: Response): Promise<void> {
    try {
      const filters = getAllBookingsQuerySchema.parse(req.query);
      const bookings = await BookingService.getAllBookings(filters);
      res.json({ success: true, data: bookings });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyBookings(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const bookings = await BookingService.getMyBookings(req.user.userId);
      res.json({ success: true, data: bookings });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBookingById(req: Request, res: Response): Promise<void> {
    try {
      const booking = await BookingService.getBookingById(getParam(req.params, "id"));

      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const canAccess =
        req.user.role === "KOORDINATOR_LAB" ||
        req.user.role === "ASISTEN_LAB" ||
        booking.requestedBy === req.user.userId;

      if (!canAccess) {
        res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke data ini" });
        return;
      }

      res.json({ success: true, data: booking });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validated = createBookingSchema.parse(req.body);
      const booking = await BookingService.createBooking(validated, req.user.userId);
      res.status(201).json({ success: true, message: "Pengajuan peminjaman berhasil dibuat", data: booking });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async approveBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const booking = await BookingService.approveBooking(getParam(req.params, "id"), req.user.userId);
      res.json({ success: true, message: "Pengajuan peminjaman disetujui", data: booking });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async rejectBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const validated = rejectBookingSchema.parse(req.body);
      const booking = await BookingService.rejectBooking(getParam(req.params, "id"), req.user.userId, validated.reason);
      res.json({ success: true, message: "Pengajuan peminjaman ditolak", data: booking });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ success: false, message: "Validasi gagal", errors: error.errors });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const booking = await BookingService.cancelBooking(getParam(req.params, "id"), req.user.userId);
      res.json({ success: true, message: "Pengajuan peminjaman dibatalkan", data: booking });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
