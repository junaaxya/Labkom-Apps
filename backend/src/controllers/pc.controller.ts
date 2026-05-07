import type { Request, Response } from "express";
import { PCService } from "../services/pc.service";

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

export class PCController {
  static async getAllPCs(req: Request, res: Response) {
    try {
      const { labId, status, isOnline, agentStatus, healthStatus, search } = req.query;
      const pcs = await PCService.getAllPCs({
        labId: labId as string,
        status: status as any,
        isOnline: isOnline === "true" ? true : isOnline === "false" ? false : undefined,
        agentStatus: agentStatus as string,
        healthStatus: healthStatus as string,
        search: search as string,
      });
      res.json({ success: true, data: pcs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPCDetail(req: Request, res: Response) {
    try {
      const id = getParam(req, "id");
      const pc = await PCService.getPCDetail(id);
      res.json({ success: true, data: pc });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async bulkUpdateStatus(req: Request, res: Response) {
    try {
      const { pcIds, status, reason } = req.body;
      if (!pcIds || !Array.isArray(pcIds) || !status) {
        return res.status(400).json({ success: false, message: "pcIds (array) dan status wajib diisi" });
      }
      const result = await PCService.bulkUpdateStatus(pcIds, status, reason || "Manual update", req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getStatusHistory(req: Request, res: Response) {
    try {
      const pcId = getParam(req, "id");
      const days = parseInt(req.query.days as string) || 30;
      const history = await PCService.getStatusHistory(pcId, days);
      res.json({ success: true, data: history });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAnalytics(req: Request, res: Response) {
    try {
      const labId = req.query.labId as string;
      const analytics = await PCService.getPCAnalytics(labId);
      res.json({ success: true, data: analytics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getUptimeStats(req: Request, res: Response) {
    try {
      const labId = req.query.labId as string;
      const days = parseInt(req.query.days as string) || 30;
      const stats = await PCService.getUptimeStats(labId, days);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async sendCommand(req: Request, res: Response) {
    try {
      const pcId = getParam(req, "id");
      const { command, payload } = req.body;
      if (!command) {
        return res.status(400).json({ success: false, message: "command wajib diisi" });
      }
      const result = await PCService.sendCommand(pcId, command, req.user!.userId, payload);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkSendCommand(req: Request, res: Response) {
    try {
      const { pcIds, command, payload } = req.body;
      if (!pcIds || !Array.isArray(pcIds) || !command) {
        return res.status(400).json({ success: false, message: "pcIds (array) dan command wajib diisi" });
      }
      const result = await PCService.bulkSendCommand(pcIds, command, req.user!.userId, payload);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getCommandQueue(req: Request, res: Response) {
    try {
      const pcId = req.query.pcId as string;
      const status = req.query.status as any;
      const commands = await PCService.getCommandQueue(pcId, status);
      res.json({ success: true, data: commands });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async cancelCommand(req: Request, res: Response) {
    try {
      const commandId = getParam(req, "commandId");
      const result = await PCService.cancelCommand(commandId, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateSpecs(req: Request, res: Response) {
    try {
      const pcId = getParam(req, "id");
      const { specs } = req.body;
      if (!specs) {
        return res.status(400).json({ success: false, message: "specs wajib diisi" });
      }
      const result = await PCService.updateSpecs(pcId, specs);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkUpdateSpecs(req: Request, res: Response) {
    try {
      const { updates } = req.body;
      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ success: false, message: "updates (array) wajib diisi" });
      }
      const result = await PCService.bulkUpdateSpecs(updates);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getInventorySummary(req: Request, res: Response) {
    try {
      const labId = req.query.labId as string;
      const summary = await PCService.getInventorySummary(labId);
      res.json({ success: true, data: summary });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getEnergyStats(req: Request, res: Response) {
    try {
      const labId = req.query.labId as string;
      const stats = await PCService.getEnergyStats(labId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async generateQRCode(req: Request, res: Response) {
    try {
      const pcId = getParam(req, "id");
      const result = await PCService.generateQRCode(pcId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async bulkGenerateQR(req: Request, res: Response) {
    try {
      const { labId } = req.body;
      if (!labId) {
        return res.status(400).json({ success: false, message: "labId wajib diisi" });
      }
      const results = await PCService.bulkGenerateQR(labId);
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async agentRegister(req: Request, res: Response) {
    try {
      const pc = (req as any).pc;
      const { hostname, os, architecture, cpuModel, ramTotalGb, storageTotalGb, ipAddress, macAddress, agentVersion } = req.body;
      const result = await PCService.registerAgent(pc.id, {
        hostname, os, architecture, cpuModel, ramTotalGb, storageTotalGb, ipAddress, macAddress, agentVersion,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async agentHeartbeat(req: Request, res: Response) {
    try {
      const pc = (req as any).pc;
      const {
        uptimeMinutes, cpuUsage, ramUsage, ramTotalGb, storageUsage, storageTotalGb,
        hostname, ipAddress, os, architecture, cpuModel, uptimeSeconds, agentVersion,
      } = req.body;
      const result = await PCService.heartbeat(pc.id, {
        uptimeMinutes, cpuUsage, ramUsage, ramTotalGb, storageUsage, storageTotalGb,
        hostname, ipAddress, os, architecture, cpuModel, uptimeSeconds, agentVersion,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async agentPickupCommands(req: Request, res: Response) {
    try {
      const pc = (req as any).pc;
      const commands = await PCService.pickupCommands(pc.id);
      res.json({ success: true, data: commands });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async agentReportResult(req: Request, res: Response) {
    try {
      const commandId = getParam(req, "commandId");
      const { success, result } = req.body;
      const cmd = await PCService.reportCommandResult(commandId, success, result);
      res.json({ success: true, data: cmd });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async agentLogs(req: Request, res: Response) {
    try {
      const pc = (req as any).pc;
      const { logs } = req.body;
      if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({ success: false, message: "logs (array) wajib diisi" });
      }
      const result = await PCService.createAgentLog(pc.id, logs);
      res.json({ success: true, data: { count: result.count } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async generateAgentToken(req: Request, res: Response) {
    try {
      const id = getParam(req, "id");
      const result = await PCService.generateAgentToken(id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
