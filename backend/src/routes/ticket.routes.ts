import { Router } from "express";
import { TicketController } from "../controllers/ticket.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, TicketController.getAllTickets);
router.get("/stats", authenticate, TicketController.getTicketStats);
router.get("/my", authenticate, TicketController.getMyTickets);
router.get("/:id", authenticate, TicketController.getTicketById);
router.post("/", authenticate, TicketController.createTicket);
router.patch("/:id", authenticate, TicketController.updateTicket);
router.patch("/:id/assign", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.assignTicket);
router.patch("/:id/resolve", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.resolveTicket);
router.patch("/:id/reject", authenticate, authorize("KOORDINATOR_LAB"), TicketController.rejectTicket);

export default router;
