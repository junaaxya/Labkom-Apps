import { Router } from "express";
import { TicketController } from "../controllers/ticket.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.getAllTickets);
router.get("/stats", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.getTicketStats);
router.get("/my", authenticate, TicketController.getMyTickets);
router.get("/:id/history", authenticate, TicketController.getTicketHistory);
router.get("/:id", authenticate, TicketController.getTicketById);
router.post("/", authenticate, TicketController.createTicket);
router.post("/qr/:assetCode", authenticate, TicketController.createQrTicket);
router.patch("/:id", authenticate, TicketController.updateTicket);
router.patch("/:id/claim", authenticate, authorize("ASISTEN_LAB"), TicketController.claimTicket);
router.patch("/:id/assign", authenticate, authorize("KOORDINATOR_LAB"), TicketController.assignTicket);
router.patch("/:id/status", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.transitionTicket);
router.post("/:id/actions", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.addTicketAction);
router.patch("/:id/resolve", authenticate, authorize("KOORDINATOR_LAB", "ASISTEN_LAB"), TicketController.resolveTicket);
router.patch("/:id/reject", authenticate, authorize("KOORDINATOR_LAB"), TicketController.rejectTicket);

export default router;
