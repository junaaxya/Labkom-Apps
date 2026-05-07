import { Router } from "express";
import { BookingController } from "../controllers/booking.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), BookingController.getAllBookings);
router.get("/my", authenticate, BookingController.getMyBookings);
router.get("/:id", authenticate, BookingController.getBookingById);
router.post("/", authenticate, authorize("MAHASISWA"), BookingController.createBooking);
router.patch("/:id/approve", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), BookingController.approveBooking);
router.patch("/:id/reject", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), BookingController.rejectBooking);
router.patch("/:id/cancel", authenticate, BookingController.cancelBooking);

export default router;
