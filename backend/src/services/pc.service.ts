import prisma from "../config/database";
import type { PCStatus, PCCommandType, CommandStatus } from "@prisma/client";
import crypto from "crypto";
import dgram from "dgram";
import os from "os";

const AGENT_OFFLINE_AFTER_MS = 2 * 60 * 1000;

/**
 * Send Wake-on-LAN magic packet to a MAC address.
 * Magic packet = 6x 0xFF + 16x MAC address bytes, sent as UDP broadcast on port 9.
 */
function getLocalBroadcastAddresses() {
  const addresses = new Set<string>(["255.255.255.255"]);

  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (iface.family !== "IPv4" || iface.internal || !iface.address || !iface.netmask) {
        continue;
      }

      const ip = iface.address.split(".").map((part) => Number(part));
      const mask = iface.netmask.split(".").map((part) => Number(part));
      if (ip.length !== 4 || mask.length !== 4 || ip.some(Number.isNaN) || mask.some(Number.isNaN)) {
        continue;
      }

      const broadcast = ip.map((octet, index) => (octet | (~mask[index] & 255))).join(".");
      addresses.add(broadcast);
    }
  }

  return [...addresses];
}

function sendWolPacketToAddress(macAddress: string, broadcastAddr: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Parse MAC: accept AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
    const macBytes = macAddress
      .replace(/[:\-]/g, "")
      .match(/.{2}/g);

    if (!macBytes || macBytes.length !== 6) {
      return reject(new Error(`Invalid MAC address: ${macAddress}`));
    }

    const macBuffer = Buffer.from(macBytes.map((b) => parseInt(b, 16)));

    // Magic packet: 6 bytes of 0xFF + 16 repetitions of MAC
    const magicPacket = Buffer.alloc(6 + 16 * 6);
    magicPacket.fill(0xff, 0, 6);
    for (let i = 0; i < 16; i++) {
      macBuffer.copy(magicPacket, 6 + i * 6);
    }

    const socket = dgram.createSocket("udp4");
    socket.once("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(magicPacket, 0, magicPacket.length, port, broadcastAddr, (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function sendWolPackets(macAddress: string, broadcastAddrs?: string[]) {
  const targets = broadcastAddrs?.length ? broadcastAddrs : getLocalBroadcastAddresses();
  const uniqueTargets = [...new Set(targets.filter((target): target is string => typeof target === "string").map((target) => target.trim()).filter(Boolean))];
  const sentTargets: string[] = [];
  const errors: string[] = [];

  for (const target of uniqueTargets) {
    for (const port of [9, 7]) {
      try {
        await sendWolPacketToAddress(macAddress, target, port);
        sentTargets.push(`${target}:${port}`);
      } catch (error) {
        errors.push(`${target}:${port} ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (sentTargets.length === 0) {
    throw new Error(`Gagal mengirim magic packet. ${errors.join("; ")}`);
  }

  return sentTargets;
}

export class PCService {
  static async markStaleAgentsOffline(labId?: string) {
    const staleBefore = new Date(Date.now() - AGENT_OFFLINE_AFTER_MS);

    const stalePCs = await prisma.pC.findMany({
      where: {
        agentStatus: "ONLINE",
        lastSeen: { lt: staleBefore },
        ...(labId ? { labId } : {}),
      },
      select: {
        id: true,
        pcCode: true,
        name: true,
        lastSeen: true,
        lab: { select: { id: true, name: true } },
      },
    });

    if (stalePCs.length === 0) {
      return [];
    }

    await prisma.pC.updateMany({
      where: { id: { in: stalePCs.map((pc) => pc.id) } },
      data: {
        agentStatus: "OFFLINE",
        isOnline: false,
      },
    });

    return stalePCs;
  }

  private static async refreshStaleAgentStatusForPC(pcId: string) {
    const staleBefore = new Date(Date.now() - AGENT_OFFLINE_AFTER_MS);

    await prisma.pC.updateMany({
      where: {
        id: pcId,
        agentStatus: "ONLINE",
        lastSeen: { lt: staleBefore },
      },
      data: {
        agentStatus: "OFFLINE",
        isOnline: false,
      },
    });
  }

  // ============================================
  // PC MONITORING & DETAILS
  // ============================================

  static async getAllPCs(filters?: {
    labId?: string;
    status?: PCStatus;
    isOnline?: boolean;
    agentStatus?: string;
    healthStatus?: string;
    search?: string;
  }) {
    await this.markStaleAgentsOffline(filters?.labId);

    const where: any = {};

    if (filters?.labId) where.labId = filters.labId;
    if (filters?.status) where.status = filters.status;
    if (filters?.isOnline !== undefined) where.isOnline = filters.isOnline;
    if (filters?.agentStatus) where.agentStatus = filters.agentStatus;
    if (filters?.healthStatus) where.healthStatus = filters.healthStatus;
    if (filters?.search) {
      where.OR = [
        { pcCode: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
        { ipAddress: { contains: filters.search, mode: "insensitive" } },
        { hostname: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return prisma.pC.findMany({
      where,
      include: {
        lab: { select: { id: true, name: true } },
        _count: { select: { tickets: true, statusLogs: true, commands: true, warnings: true } },
      },
      orderBy: [{ lab: { name: "asc" } }, { pcCode: "asc" }],
    });
  }

  static async getPCDetail(id: string) {
    await this.refreshStaleAgentStatusForPC(id);

    const pc = await prisma.pC.findUnique({
      where: { id },
      include: {
        lab: true,
        tickets: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            reporter: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        },
        statusLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        commands: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        agentLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        warnings: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!pc) throw new Error("PC tidak ditemukan");
    return pc;
  }

  // ============================================
  // BULK STATUS UPDATE
  // ============================================

  static async bulkUpdateStatus(
    pcIds: string[],
    status: PCStatus,
    reason: string,
    changedBy: string
  ) {
    const pcs = await prisma.pC.findMany({
      where: { id: { in: pcIds } },
      select: { id: true, status: true },
    });

    if (pcs.length === 0) throw new Error("Tidak ada PC yang ditemukan");

    // Create status logs for each PC
    const statusLogs = pcs.map((pc) => ({
      pcId: pc.id,
      fromStatus: pc.status,
      toStatus: status,
      reason,
      changedBy,
    }));

    await prisma.$transaction([
      prisma.pCStatusLog.createMany({ data: statusLogs }),
      prisma.pC.updateMany({
        where: { id: { in: pcIds } },
        data: { status },
      }),
    ]);

    return { updated: pcs.length };
  }

  // ============================================
  // STATUS HISTORY & ANALYTICS
  // ============================================

  static async getStatusHistory(pcId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.pCStatusLog.findMany({
      where: {
        pcId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getUptimeStats(labId?: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = { createdAt: { gte: since } };
    if (labId) where.pc = { labId };

    // Get all status changes in period
    const logs = await prisma.pCStatusLog.findMany({
      where,
      include: { pc: { select: { id: true, pcCode: true, labId: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Calculate time in each status per PC
    const pcStats: Record<string, { available: number; broken: number; maintenance: number; total: number }> = {};

    for (const log of logs) {
      if (!pcStats[log.pcId]) {
        pcStats[log.pcId] = { available: 0, broken: 0, maintenance: 0, total: 0 };
      }
      pcStats[log.pcId].total++;
      if (log.toStatus === "AVAILABLE" || log.toStatus === "IN_USE") {
        pcStats[log.pcId].available++;
      } else if (log.toStatus === "BROKEN") {
        pcStats[log.pcId].broken++;
      } else if (log.toStatus === "MAINTENANCE") {
        pcStats[log.pcId].maintenance++;
      }
    }

    return pcStats;
  }

  static async getPCAnalytics(labId?: string) {
    await this.markStaleAgentsOffline(labId);

    const where: any = labId ? { labId } : {};

    const [totalPCs, statusCounts, agentStatusCounts, healthStatusCounts, recentIssues, warningCount] = await Promise.all([
      prisma.pC.count({ where }),
      prisma.pC.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),
      prisma.pC.groupBy({
        by: ["agentStatus"],
        where,
        _count: { agentStatus: true },
      }),
      prisma.pC.groupBy({
        by: ["healthStatus"],
        where,
        _count: { healthStatus: true },
      }),
      prisma.ticket.findMany({
        where: {
          ...(labId ? { labId } : {}),
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { category: true },
      }),
      prisma.pcWarning.count({
        where: {
          isResolved: false,
          ...(labId ? { pc: { labId } } : {}),
        },
      }),
    ]);

    // Count issues by category
    const issuesByCategory: Record<string, number> = {};
    for (const ticket of recentIssues) {
      issuesByCategory[ticket.category] = (issuesByCategory[ticket.category] || 0) + 1;
    }

    // Agent status counts
    const onlineCount = agentStatusCounts.find((s) => s.agentStatus === "ONLINE")?._count.agentStatus || 0;
    const offlineCount = agentStatusCounts.find((s) => s.agentStatus === "OFFLINE")?._count.agentStatus || 0;
    const unknownCount = agentStatusCounts.find((s) => s.agentStatus === "UNKNOWN")?._count.agentStatus || 0;

    // Health status counts
    const needsCheckCount = healthStatusCounts.find((s) => s.healthStatus === "NEEDS_CHECK")?._count.healthStatus || 0;

    return {
      totalPCs,
      onlineCount,
      offlineCount,
      unknownCount,
      warningCount,
      needsCheckCount,
      statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count.status })),
      agentStatusCounts: agentStatusCounts.map((s) => ({ status: s.agentStatus, count: s._count.agentStatus })),
      healthStatusCounts: healthStatusCounts.map((s) => ({ status: s.healthStatus, count: s._count.healthStatus })),
      issuesByCategory,
    };
  }

  // ============================================
  // REMOTE COMMANDS (Queue for PC Agent)
  // ============================================

  static async sendCommand(
    pcId: string,
    command: PCCommandType,
    issuedBy: string,
    payload?: any
  ) {
    await this.refreshStaleAgentStatusForPC(pcId);

    const pc = await prisma.pC.findUnique({ where: { id: pcId } });
    if (!pc) throw new Error("PC tidak ditemukan");

    if (command === "WAKE_ON_LAN") {
      if (!pc.macAddress) {
        throw new Error("MAC address belum diset untuk PC ini. WoL tidak bisa dilakukan.");
      }
      const broadcastAddrs = Array.isArray(payload?.broadcastAddresses)
        ? payload.broadcastAddresses
        : payload?.broadcastAddress
          ? [payload.broadcastAddress]
          : undefined;
      const sentTargets = await sendWolPackets(pc.macAddress, broadcastAddrs);

      return prisma.pCCommand.create({
        data: {
          pcId,
          command,
          status: "EXECUTED",
          payload: { ...(payload || {}), sentTargets },
          issuedBy,
          executedAt: new Date(),
          result: `Magic packet sent to ${pc.macAddress} via ${sentTargets.join(", ")}`,
        },
      });
    }

    if (["SHUTDOWN", "RESTART", "SLEEP", "LOCK"].includes(command) && !pc.isOnline) {
      throw new Error("PC sedang offline. Command tidak bisa dikirim.");
    }

    return prisma.pCCommand.create({
      data: {
        pcId,
        command,
        status: "PENDING",
        payload: payload || undefined,
        issuedBy,
      },
    });
  }

  static async bulkSendCommand(
    pcIds: string[],
    command: PCCommandType,
    issuedBy: string,
    payload?: any
  ) {
    await this.markStaleAgentsOffline();

    const pcs = await prisma.pC.findMany({
      where: { id: { in: pcIds } },
      select: { id: true, isOnline: true, macAddress: true },
    });

    if (pcs.length === 0) throw new Error("Tidak ada PC yang ditemukan");

    let validPCs = pcs;
    if (command === "WAKE_ON_LAN") {
      validPCs = pcs.filter((pc) => pc.macAddress);
    } else {
      validPCs = pcs.filter((pc) => pc.isOnline);
    }

    if (validPCs.length === 0) {
      throw new Error("Tidak ada PC yang valid untuk command ini");
    }

    if (command === "WAKE_ON_LAN") {
      const broadcastAddrs = Array.isArray(payload?.broadcastAddresses)
        ? payload.broadcastAddresses
        : payload?.broadcastAddress
          ? [payload.broadcastAddress]
          : undefined;
      const wolPromises = validPCs.map((pc) =>
        sendWolPackets(pc.macAddress!, broadcastAddrs).catch(() => null)
      );
      const wolResults = await Promise.all(wolPromises);

      await prisma.pCCommand.createMany({
        data: validPCs.map((pc, index) => ({
          pcId: pc.id,
          command,
          status: "EXECUTED" as CommandStatus,
          payload: { ...(payload || {}), sentTargets: wolResults[index] || [] },
          issuedBy,
          executedAt: new Date(),
          result: `Magic packet sent to ${pc.macAddress} via ${(wolResults[index] || []).join(", ")}`,
        })),
      });

      return { sent: validPCs.length, skipped: pcs.length - validPCs.length };
    }

    const commands = validPCs.map((pc) => ({
      pcId: pc.id,
      command,
      status: "PENDING" as CommandStatus,
      payload: payload || undefined,
      issuedBy,
    }));

    await prisma.pCCommand.createMany({ data: commands });

    return { sent: validPCs.length, skipped: pcs.length - validPCs.length };
  }

  static async getCommandQueue(pcId?: string, status?: CommandStatus) {
    const where: any = {};
    if (pcId) where.pcId = pcId;
    if (status) where.status = status;

    return prisma.pCCommand.findMany({
      where,
      include: {
        pc: { select: { id: true, pcCode: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  static async cancelCommand(commandId: string, userId: string) {
    const cmd = await prisma.pCCommand.findUnique({ where: { id: commandId } });
    if (!cmd) throw new Error("Command tidak ditemukan");
    if (!["PENDING", "SENT"].includes(cmd.status)) throw new Error("Hanya command PENDING/SENT yang bisa dibatalkan");

    return prisma.pCCommand.update({
      where: { id: commandId },
      data: { status: "CANCELLED" },
    });
  }

  // Agent endpoint: pick up pending commands
  static async pickupCommands(pcId: string) {
    const commands = await prisma.pCCommand.findMany({
      where: { pcId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    // Mark as SENT
    if (commands.length > 0) {
      await prisma.pCCommand.updateMany({
        where: { id: { in: commands.map((c) => c.id) } },
        data: { status: "SENT" },
      });
    }

    return commands;
  }

  // Agent endpoint: report command result
  static async reportCommandResult(pcId: string, commandId: string, success: boolean, result?: string) {
    const command = await prisma.pCCommand.findFirst({
      where: { id: commandId, pcId },
    });

    if (!command) throw new Error("Command tidak ditemukan untuk PC ini");

    return prisma.pCCommand.update({
      where: { id: commandId },
      data: {
        status: success ? "EXECUTED" : "FAILED",
        result,
        executedAt: new Date(),
      },
    });
  }

  // Agent endpoint: heartbeat (PC reports it's alive with full metrics)
  static async heartbeat(pcId: string, data?: {
    uptimeMinutes?: number;
    isOnline?: boolean;
    cpuUsage?: number;
    ramUsage?: number;
    ramTotalGb?: number;
    storageUsage?: number;
    storageTotalGb?: number;
    hostname?: string;
    ipAddress?: string;
    os?: string;
    architecture?: string;
    cpuModel?: string;
    uptimeSeconds?: number;
    agentVersion?: string;
  }) {
    const updateData: Record<string, any> = {
      lastSeen: new Date(),
      isOnline: true,
      agentStatus: "ONLINE",
    };

    if (data) {
      if (data.uptimeMinutes !== undefined) updateData.uptimeMinutes = data.uptimeMinutes;
      if (data.cpuUsage !== undefined) updateData.cpuUsage = data.cpuUsage;
      if (data.ramUsage !== undefined) updateData.ramUsage = data.ramUsage;
      if (data.ramTotalGb !== undefined) updateData.ramTotalGb = data.ramTotalGb;
      if (data.storageUsage !== undefined) updateData.storageUsage = data.storageUsage;
      if (data.storageTotalGb !== undefined) updateData.storageTotalGb = data.storageTotalGb;
      if (data.hostname !== undefined) updateData.hostname = data.hostname;
      if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
      if (data.os !== undefined) updateData.os = data.os;
      if (data.architecture !== undefined) updateData.architecture = data.architecture;
      if (data.cpuModel !== undefined) updateData.cpuModel = data.cpuModel;
      if (data.uptimeSeconds !== undefined) updateData.uptimeSeconds = data.uptimeSeconds;
      if (data.agentVersion !== undefined) updateData.agentVersion = data.agentVersion;
    }

    const warnings: Array<{ warningType: string; severity: string; message: string }> = [];
    if (data?.cpuUsage !== undefined && data.cpuUsage > 90) {
      warnings.push({ warningType: "CPU_HIGH", severity: "HIGH", message: `CPU usage ${data.cpuUsage}%` });
    }
    if (data?.ramUsage !== undefined && data.ramUsage > 90) {
      warnings.push({ warningType: "RAM_HIGH", severity: "HIGH", message: `RAM usage ${data.ramUsage}%` });
    }
    if (data?.storageUsage !== undefined && data.storageUsage > 90) {
      warnings.push({ warningType: "STORAGE_HIGH", severity: "MEDIUM", message: `Storage usage ${data.storageUsage}%` });
    }

    if (warnings.length > 0) {
      await Promise.all(
        warnings.map((w) => prisma.pcWarning.create({ data: { pcId, ...w } }))
      );
    }

    return prisma.pC.update({
      where: { id: pcId },
      data: updateData,
    });
  }

  static async registerAgent(pcId: string, data: {
    hostname?: string;
    os?: string;
    architecture?: string;
    cpuModel?: string;
    ramTotalGb?: number;
    storageTotalGb?: number;
    ipAddress?: string;
    macAddress?: string;
    agentVersion?: string;
  }) {
    const pc = await prisma.pC.update({
      where: { id: pcId },
      data: {
        isAgentInstalled: true,
        agentStatus: "ONLINE",
        lastSeen: new Date(),
        isOnline: true,
        ...(data.hostname && { hostname: data.hostname }),
        ...(data.os && { os: data.os }),
        ...(data.architecture && { architecture: data.architecture }),
        ...(data.cpuModel && { cpuModel: data.cpuModel }),
        ...(data.ramTotalGb !== undefined && { ramTotalGb: data.ramTotalGb }),
        ...(data.storageTotalGb !== undefined && { storageTotalGb: data.storageTotalGb }),
        ...(data.ipAddress && { ipAddress: data.ipAddress }),
        ...(data.macAddress && { macAddress: data.macAddress }),
        ...(data.agentVersion && { agentVersion: data.agentVersion }),
      },
    });

    await prisma.pcAgentLog.create({
      data: {
        pcId,
        eventType: "AGENT_REGISTERED",
        level: "INFO",
        message: `Agent v${data.agentVersion || "unknown"} registered from ${data.hostname || "unknown"}`,
      },
    });

    return pc;
  }

  static async createAgentLog(pcId: string, logs: Array<{
    eventType: string;
    level: string;
    message?: string;
  }>) {
    return prisma.pcAgentLog.createMany({
      data: logs.map((log) => ({ pcId, ...log })),
    });
  }

  static async generateAgentToken(pcId: string) {
    const pc = await prisma.pC.findUnique({ where: { id: pcId } });
    if (!pc) throw new Error("PC tidak ditemukan");

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.pC.update({
      where: { id: pcId },
      data: { agentTokenHash: tokenHash },
    });

    return { token, pcCode: pc.pcCode };
  }

  // ============================================
  // HARDWARE INVENTORY
  // ============================================

  static async updateSpecs(pcId: string, specs: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
    gpu?: string;
    monitor?: string;
    peripherals?: string[];
  }) {
    const pc = await prisma.pC.findUnique({ where: { id: pcId } });
    if (!pc) throw new Error("PC tidak ditemukan");

    return prisma.pC.update({
      where: { id: pcId },
      data: { specs: JSON.stringify(specs) },
    });
  }

  static async bulkUpdateSpecs(updates: Array<{ pcId: string; specs: any }>) {
    const results = await prisma.$transaction(
      updates.map((u) =>
        prisma.pC.update({
          where: { id: u.pcId },
          data: { specs: JSON.stringify(u.specs) },
        })
      )
    );
    return { updated: results.length };
  }

  static async getInventorySummary(labId?: string) {
    const where: any = labId ? { labId } : {};
    const pcs = await prisma.pC.findMany({
      where,
      select: { id: true, pcCode: true, name: true, specs: true, status: true, labId: true },
      orderBy: { pcCode: "asc" },
    });

    // Parse specs and aggregate
    const inventory = pcs.map((pc) => {
      let parsedSpecs: any = {};
      try {
        parsedSpecs = pc.specs ? JSON.parse(pc.specs) : {};
      } catch {
        parsedSpecs = {};
      }
      return { ...pc, parsedSpecs };
    });

    // Aggregate by component
    const ramCounts: Record<string, number> = {};
    const cpuCounts: Record<string, number> = {};
    const osCounts: Record<string, number> = {};

    for (const pc of inventory) {
      const s = pc.parsedSpecs;
      if (s.ram) ramCounts[s.ram] = (ramCounts[s.ram] || 0) + 1;
      if (s.cpu) cpuCounts[s.cpu] = (cpuCounts[s.cpu] || 0) + 1;
      if (s.os) osCounts[s.os] = (osCounts[s.os] || 0) + 1;
    }

    return {
      totalPCs: pcs.length,
      inventory,
      aggregation: { ramCounts, cpuCounts, osCounts },
    };
  }

  // ============================================
  // ENERGY ESTIMATION
  // ============================================

  static async getEnergyStats(labId?: string) {
    const where: any = labId ? { labId } : {};

    const pcs = await prisma.pC.findMany({
      where,
      select: {
        id: true,
        pcCode: true,
        powerWatt: true,
        isOnline: true,
        uptimeMinutes: true,
        lab: { select: { id: true, name: true } },
      },
    });

    // Group by lab
    const labStats: Record<string, {
      labName: string;
      totalPCs: number;
      onlinePCs: number;
      totalWatt: number;
      activeWatt: number;
      dailyKwh: number;
      monthlyKwh: number;
      monthlyCost: number;
    }> = {};

    const COST_PER_KWH = 1500; // Rp per kWh (tarif PLN)
    const HOURS_PER_DAY = 10; // Estimasi jam operasional

    for (const pc of pcs) {
      const labId = pc.lab.id;
      if (!labStats[labId]) {
        labStats[labId] = {
          labName: pc.lab.name,
          totalPCs: 0,
          onlinePCs: 0,
          totalWatt: 0,
          activeWatt: 0,
          dailyKwh: 0,
          monthlyKwh: 0,
          monthlyCost: 0,
        };
      }

      labStats[labId].totalPCs++;
      labStats[labId].totalWatt += pc.powerWatt;

      if (pc.isOnline) {
        labStats[labId].onlinePCs++;
        labStats[labId].activeWatt += pc.powerWatt;
      }
    }

    // Calculate energy estimates
    for (const lab of Object.values(labStats)) {
      lab.dailyKwh = (lab.activeWatt * HOURS_PER_DAY) / 1000;
      lab.monthlyKwh = lab.dailyKwh * 22; // 22 hari kerja
      lab.monthlyCost = Math.round(lab.monthlyKwh * COST_PER_KWH);
    }

    const totalActiveWatt = Object.values(labStats).reduce((sum, l) => sum + l.activeWatt, 0);
    const totalMonthlyKwh = Object.values(labStats).reduce((sum, l) => sum + l.monthlyKwh, 0);
    const totalMonthlyCost = Object.values(labStats).reduce((sum, l) => sum + l.monthlyCost, 0);

    return {
      labs: labStats,
      total: {
        totalPCs: pcs.length,
        onlinePCs: pcs.filter((p) => p.isOnline).length,
        totalActiveWatt,
        totalMonthlyKwh: Math.round(totalMonthlyKwh * 100) / 100,
        totalMonthlyCost,
        costPerKwh: COST_PER_KWH,
      },
      recommendations: generateEnergyRecommendations(labStats),
    };
  }

  // ============================================
  // QR CODE GENERATION
  // ============================================

  static async generateQRCode(pcId: string) {
    const pc = await prisma.pC.findUnique({ where: { id: pcId } });
    if (!pc) throw new Error("PC tidak ditemukan");

    const qrData = JSON.stringify({
      type: "PC",
      id: pc.id,
      code: pc.pcCode,
      lab: pc.labId,
    });

    // Store QR data in PC record
    await prisma.pC.update({
      where: { id: pcId },
      data: { qrCode: qrData },
    });

    return { pcId: pc.id, pcCode: pc.pcCode, qrData };
  }

  static async bulkGenerateQR(labId: string) {
    const pcs = await prisma.pC.findMany({
      where: { labId },
      select: { id: true, pcCode: true, labId: true },
      orderBy: { pcCode: "asc" },
    });

    const results = [];
    for (const pc of pcs) {
      const qrData = JSON.stringify({
        type: "PC",
        id: pc.id,
        code: pc.pcCode,
        lab: pc.labId,
      });

      await prisma.pC.update({
        where: { id: pc.id },
        data: { qrCode: qrData },
      });

      results.push({ pcId: pc.id, pcCode: pc.pcCode, qrData });
    }

    return results;
  }
}

// Helper: Generate energy saving recommendations
function generateEnergyRecommendations(labStats: Record<string, any>): string[] {
  const recommendations: string[] = [];

  for (const [labId, stats] of Object.entries(labStats)) {
    const usageRatio = stats.onlinePCs / stats.totalPCs;

    if (usageRatio > 0.8) {
      recommendations.push(
        `${stats.labName}: Penggunaan tinggi (${Math.round(usageRatio * 100)}%). Pertimbangkan jadwal shift untuk hemat energi.`
      );
    }

    if (stats.monthlyCost > 500000) {
      recommendations.push(
        `${stats.labName}: Estimasi biaya listrik Rp ${stats.monthlyCost.toLocaleString()}/bulan. Aktifkan auto-shutdown di luar jam operasional.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Konsumsi energi dalam batas normal. Tetap monitor penggunaan di luar jam operasional.");
  }

  return recommendations;
}
