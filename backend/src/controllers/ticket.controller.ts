import { Request, Response } from "express";
import { TicketService } from "../services/ticket.service";

const getParam = (p: string | string[]) => (Array.isArray(p) ? p[0] : p);

export class TicketController {
  static async getAllTickets(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        labId: typeof req.query.labId === "string" ? req.query.labId : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
        pcId: typeof req.query.pcId === "string" ? req.query.pcId : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        reportedBy: typeof req.query.reportedBy === "string" ? req.query.reportedBy : undefined,
        page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
        limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
      };
      const tickets = await TicketService.getAllTickets(filters);
      res.json({ success: true, data: tickets });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTicketById(req: Request, res: Response): Promise<void> {
    try {
      const ticket = await TicketService.getTicketById(getParam(req.params.id));
      res.json({ success: true, data: ticket });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createTicket(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, message: "Unauthorized" }); return; }
      const ticket = await TicketService.createTicket({ ...req.body, reportedBy: req.user.userId });
      res.status(201).json({ success: true, message: "Ticket berhasil dibuat", data: ticket });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async assignTicket(req: Request, res: Response): Promise<void> {
    try {
      const { assignedTo } = req.body;
      const ticket = await TicketService.assignTicket(getParam(req.params.id), assignedTo);
      res.json({ success: true, message: "Ticket berhasil di-assign", data: ticket });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async resolveTicket(req: Request, res: Response): Promise<void> {
    try {
      const { resolution } = req.body;
      const ticket = await TicketService.resolveTicket(getParam(req.params.id), resolution);
      res.json({ success: true, message: "Ticket berhasil di-resolve", data: ticket });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async rejectTicket(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body;
      const ticket = await TicketService.rejectTicket(getParam(req.params.id), reason);
      res.json({ success: true, message: "Ticket ditolak", data: ticket });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getTicketStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await TicketService.getTicketStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyTickets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const tickets = await TicketService.getMyTickets(req.user.userId);
      res.json({ success: true, data: tickets });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateTicket(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const ticket = await TicketService.updateTicket(
        getParam(req.params.id),
        {
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          priority: req.body.priority,
        },
        req.user.userId
      );

      res.json({ success: true, message: "Ticket berhasil diperbarui", data: ticket });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
