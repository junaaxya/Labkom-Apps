import type { Request, Response } from "express";
import { ZodError } from "zod";
import { TicketService } from "../services/ticket.service";
import {
  TicketAuthorizationError,
  TicketConflictError,
  TicketDuplicateError,
  TicketNotFoundError,
  TicketValidationError,
} from "../services/ticket-workflow.error";
import {
  assignTicketSchema,
  createTicketSchema,
  createQrTicketSchema,
  rejectTicketSchema,
  resolveTicketSchema,
  ticketActionSchema,
  ticketIdParamSchema,
  ticketListQuerySchema,
  transitionTicketSchema,
  updateTicketSchema,
} from "../validators/ticket.validator";

function getTicketId(req: Request): string {
  return ticketIdParamSchema.parse({ id: req.params.id }).id;
}

function getActor(req: Request): { readonly userId: string } {
  if (!req.user) throw new TicketAuthorizationError("Tidak terautentikasi.");
  return { userId: req.user.userId };
}

function sendWorkflowError(req: Request, res: Response, error: unknown): void {
  if (error instanceof ZodError || error instanceof TicketValidationError) {
    res.status(400).json({ success: false, message: error instanceof ZodError ? "Validasi gagal" : error.message });
    return;
  }
  if (error instanceof TicketAuthorizationError) {
    res.status(403).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof TicketNotFoundError) {
    res.status(404).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof TicketDuplicateError) {
    const canViewTicket = req.user?.role === "KOORDINATOR_LAB"
      || req.user?.role === "ASISTEN_LAB"
      || req.user?.userId === error.existingTicket.reportedBy;
    res.status(409).json({
      success: false,
      message: canViewTicket
        ? `Laporan aktif serupa sudah ada pada ticket ${error.existingTicket.id}.`
        : error.message,
      data: {
        existingTicket: {
          ...(canViewTicket ? { id: error.existingTicket.id, link: `/tickets/${error.existingTicket.id}` } : {}),
          status: error.existingTicket.status,
          createdAt: error.existingTicket.createdAt,
        },
      },
    });
    return;
  }
  if (error instanceof TicketConflictError) {
    res.status(409).json({ success: false, message: error.message });
    return;
  }
  res.status(500).json({ success: false, message: "Operasi ticket gagal" });
}

export class TicketController {
  static async getAllTickets(req: Request, res: Response): Promise<void> {
    try {
      const filters = ticketListQuerySchema.parse(req.query);
      const tickets = await TicketService.getAllTickets(filters);
      res.json({ success: true, data: tickets });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async getTicketById(req: Request, res: Response): Promise<void> {
    try {
      const ticket = await TicketService.getTicketById(getTicketId(req), getActor(req));
      res.json({ success: true, data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async getTicketHistory(req: Request, res: Response): Promise<void> {
    try {
      const history = await TicketService.getTicketHistory(getTicketId(req), getActor(req));
      res.json({ success: true, data: history });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const input = createTicketSchema.parse(req.body);
      const ticket = await TicketService.createTicket({ ...input, reportedBy: getActor(req).userId });
      res.status(201).json({ success: true, message: "Ticket berhasil dibuat", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async createQrTicket(req: Request, res: Response): Promise<void> {
    try {
      const input = createQrTicketSchema.parse({ ...req.body, assetCode: req.params.assetCode });
      const ticket = await TicketService.createTicket({ ...input, reportedBy: getActor(req).userId });
      res.status(201).json({ success: true, message: "Ticket berhasil dibuat", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async assignTicket(req: Request, res: Response): Promise<void> {
    try {
      const { assignedTo } = assignTicketSchema.parse(req.body);
      const ticket = await TicketService.assignTicket(getTicketId(req), assignedTo, getActor(req));
      res.json({ success: true, message: "Ticket berhasil di-assign", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async claimTicket(req: Request, res: Response): Promise<void> {
    try {
      const ticket = await TicketService.claimTicket(getTicketId(req), getActor(req));
      res.json({ success: true, message: "Ticket berhasil diambil", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async transitionTicket(req: Request, res: Response): Promise<void> {
    try {
      const input = transitionTicketSchema.parse(req.body);
      const ticket = await TicketService.transitionTicket(
        getTicketId(req),
        input.status,
        getActor(req),
        input.status === "WAITING" ? input.waitingReason : undefined
      );
      res.json({ success: true, message: "Status ticket berhasil diperbarui", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async addTicketAction(req: Request, res: Response): Promise<void> {
    try {
      const { note } = ticketActionSchema.parse(req.body);
      const ticket = await TicketService.addTicketAction(getTicketId(req), note, getActor(req));
      res.status(201).json({ success: true, message: "Catatan perbaikan berhasil ditambahkan", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async resolveTicket(req: Request, res: Response): Promise<void> {
    try {
      const { resolution, resolutionNotes } = resolveTicketSchema.parse(req.body);
      const ticket = await TicketService.resolveTicket(
        getTicketId(req),
        getActor(req),
        resolutionNotes ?? resolution
      );
      res.json({ success: true, message: "Ticket berhasil di-resolve", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async rejectTicket(req: Request, res: Response): Promise<void> {
    try {
      const { reason, rejectionReason } = rejectTicketSchema.parse(req.body);
      const ticket = await TicketService.rejectTicket(
        getTicketId(req),
        getActor(req),
        rejectionReason ?? reason
      );
      res.json({ success: true, message: "Ticket ditolak", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async getTicketStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await TicketService.getTicketStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async getMyTickets(req: Request, res: Response): Promise<void> {
    try {
      const tickets = await TicketService.getMyTickets(getActor(req).userId);
      res.json({ success: true, data: tickets });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }

  static async updateTicket(req: Request, res: Response): Promise<void> {
    try {
      const input = updateTicketSchema.parse(req.body);
      const ticket = await TicketService.updateTicket(
        getTicketId(req),
        input,
        getActor(req).userId
      );
      res.json({ success: true, message: "Ticket berhasil diperbarui", data: ticket });
    } catch (error) {
      sendWorkflowError(req, res, error);
    }
  }
}
