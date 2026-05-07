import prisma from "../config/database";

interface PCRiskScore {
  pcId: string;
  pcCode: string;
  pcName: string;
  labName: string;
  riskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
  prediction: string;
  recommendedAction: string;
  estimatedFailureDays: number | null;
}

interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  detail: string;
}

interface MaintenanceScheduleItem {
  pcId: string;
  pcCode: string;
  labName: string;
  priority: "URGENT" | "HIGH" | "NORMAL" | "LOW";
  reason: string;
  suggestedDate: Date;
  estimatedDuration: number; // minutes
}

interface TrendAnalysis {
  period: string;
  totalTickets: number;
  trend: "INCREASING" | "STABLE" | "DECREASING";
  percentChange: number;
  topCategories: { category: string; count: number; trend: string }[];
  hotspots: { labName: string; count: number }[];
}

class PredictiveMaintenanceService {
  async getPCRiskScores(labId?: string): Promise<PCRiskScore[]> {
    const pcs = await prisma.pC.findMany({
      where: labId ? { labId } : undefined,
      include: {
        lab: { select: { name: true } },
        tickets: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, category: true, priority: true, status: true, createdAt: true, resolvedAt: true },
        },
        statusLogs: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { fromStatus: true, toStatus: true, createdAt: true, reason: true },
        },
      },
    });

    const riskScores: PCRiskScore[] = [];

    for (const pc of pcs) {
      const factors: RiskFactor[] = [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const recentTickets = pc.tickets.filter((t) => t.createdAt >= thirtyDaysAgo);
      const ticketFrequencyScore = Math.min(recentTickets.length * 15, 100);
      factors.push({
        name: "Frekuensi Kerusakan",
        weight: 0.3,
        score: ticketFrequencyScore,
        detail: `${recentTickets.length} tiket dalam 30 hari terakhir`,
      });

      const criticalTickets = recentTickets.filter((t) => t.priority === "CRITICAL" || t.priority === "HIGH");
      const severityScore = Math.min(criticalTickets.length * 25, 100);
      factors.push({
        name: "Severity Kerusakan",
        weight: 0.25,
        score: severityScore,
        detail: `${criticalTickets.length} tiket high/critical`,
      });

      const statusChanges = pc.statusLogs.filter((s) => s.createdAt >= thirtyDaysAgo);
      const instabilityScore = Math.min(statusChanges.length * 10, 100);
      factors.push({
        name: "Instabilitas Status",
        weight: 0.15,
        score: instabilityScore,
        detail: `${statusChanges.length} perubahan status dalam 30 hari`,
      });

      const allTickets90d = pc.tickets.filter((t) => t.createdAt >= ninetyDaysAgo);
      const categories = allTickets90d.map((t) => t.category);
      const uniqueCategories = new Set(categories);
      const diversityScore = Math.min(uniqueCategories.size * 20, 100);
      factors.push({
        name: "Diversitas Masalah",
        weight: 0.15,
        score: diversityScore,
        detail: `${uniqueCategories.size} kategori masalah berbeda`,
      });

      let ageScore = 0;
      if (pc.uptimeMinutes > 50000) ageScore = 80;
      else if (pc.uptimeMinutes > 30000) ageScore = 50;
      else if (pc.uptimeMinutes > 10000) ageScore = 20;
      factors.push({
        name: "Akumulasi Uptime",
        weight: 0.15,
        score: ageScore,
        detail: `${Math.round(pc.uptimeMinutes / 60)} jam total uptime`,
      });

      const riskScore = Math.round(
        factors.reduce((sum, f) => sum + f.score * f.weight, 0)
      );

      const riskLevel: PCRiskScore["riskLevel"] =
        riskScore >= 75 ? "CRITICAL" : riskScore >= 50 ? "HIGH" : riskScore >= 25 ? "MEDIUM" : "LOW";

      const prediction = this.generatePrediction(riskLevel, recentTickets.length, factors);
      const recommendedAction = this.generateRecommendation(riskLevel, factors);
      const estimatedFailureDays = this.estimateFailureDays(riskScore, recentTickets.length);

      riskScores.push({
        pcId: pc.id,
        pcCode: pc.pcCode,
        pcName: pc.name,
        labName: pc.lab.name,
        riskScore,
        riskLevel,
        factors,
        prediction,
        recommendedAction,
        estimatedFailureDays,
      });
    }

    return riskScores.sort((a, b) => b.riskScore - a.riskScore);
  }

  async getMaintenanceSchedule(): Promise<MaintenanceScheduleItem[]> {
    const riskScores = await this.getPCRiskScores();
    const schedule: MaintenanceScheduleItem[] = [];
    const now = new Date();

    for (const pc of riskScores) {
      if (pc.riskLevel === "LOW") continue;

      let priority: MaintenanceScheduleItem["priority"];
      let daysFromNow: number;
      let duration: number;

      switch (pc.riskLevel) {
        case "CRITICAL":
          priority = "URGENT";
          daysFromNow = 1;
          duration = 120;
          break;
        case "HIGH":
          priority = "HIGH";
          daysFromNow = 3;
          duration = 90;
          break;
        case "MEDIUM":
          priority = "NORMAL";
          daysFromNow = 7;
          duration = 60;
          break;
        default:
          priority = "LOW";
          daysFromNow = 14;
          duration = 45;
      }

      const suggestedDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
      if (suggestedDate.getDay() === 0) suggestedDate.setDate(suggestedDate.getDate() + 1);
      if (suggestedDate.getDay() === 6) suggestedDate.setDate(suggestedDate.getDate() + 2);

      schedule.push({
        pcId: pc.pcId,
        pcCode: pc.pcCode,
        labName: pc.labName,
        priority,
        reason: pc.prediction,
        suggestedDate,
        estimatedDuration: duration,
      });
    }

    return schedule.sort((a, b) => {
      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async getTrendAnalysis(months: number = 3): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);

      const [currentTickets, prevTickets] = await Promise.all([
        prisma.ticket.findMany({
          where: { createdAt: { gte: periodStart, lte: periodEnd } },
          include: { lab: { select: { name: true } } },
        }),
        prisma.ticket.count({
          where: { createdAt: { gte: prevPeriodStart, lt: periodStart } },
        }),
      ]);

      const totalTickets = currentTickets.length;
      const percentChange = prevTickets > 0 ? Math.round(((totalTickets - prevTickets) / prevTickets) * 100) : 0;
      const trend: TrendAnalysis["trend"] =
        percentChange > 10 ? "INCREASING" : percentChange < -10 ? "DECREASING" : "STABLE";

      const categoryMap: Record<string, number> = {};
      const labMap: Record<string, number> = {};

      currentTickets.forEach((t) => {
        categoryMap[t.category] = (categoryMap[t.category] || 0) + 1;
        labMap[t.lab.name] = (labMap[t.lab.name] || 0) + 1;
      });

      const topCategories = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([category, count]) => ({ category, count, trend: "STABLE" }));

      const hotspots = Object.entries(labMap)
        .sort(([, a], [, b]) => b - a)
        .map(([labName, count]) => ({ labName, count }));

      trends.push({
        period: periodStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
        totalTickets,
        trend,
        percentChange,
        topCategories,
        hotspots,
      });
    }

    return trends;
  }

  async getOverallHealth(): Promise<{
    score: number;
    level: string;
    summary: string;
    metrics: Record<string, any>;
  }> {
    const [totalPCs, brokenPCs, maintenancePCs, openTickets, criticalTickets] = await Promise.all([
      prisma.pC.count(),
      prisma.pC.count({ where: { status: "BROKEN" } }),
      prisma.pC.count({ where: { status: "MAINTENANCE" } }),
      prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.ticket.count({ where: { status: "OPEN", priority: "CRITICAL" } }),
    ]);

    const healthyPCs = totalPCs - brokenPCs - maintenancePCs;
    const healthPercent = totalPCs > 0 ? Math.round((healthyPCs / totalPCs) * 100) : 100;

    let ticketPenalty = 0;
    if (criticalTickets > 0) ticketPenalty += criticalTickets * 5;
    if (openTickets > 5) ticketPenalty += (openTickets - 5) * 2;

    const score = Math.max(0, Math.min(100, healthPercent - ticketPenalty));
    const level = score >= 80 ? "EXCELLENT" : score >= 60 ? "GOOD" : score >= 40 ? "FAIR" : "POOR";

    const summaryMap: Record<string, string> = {
      EXCELLENT: "Lab dalam kondisi sangat baik. Semua sistem berjalan normal.",
      GOOD: "Lab dalam kondisi baik. Ada beberapa hal yang perlu diperhatikan.",
      FAIR: "Lab perlu perhatian. Beberapa PC bermasalah dan tiket menumpuk.",
      POOR: "Lab dalam kondisi kritis. Perlu tindakan segera.",
    };

    return {
      score,
      level,
      summary: summaryMap[level],
      metrics: {
        totalPCs,
        healthyPCs,
        brokenPCs,
        maintenancePCs,
        openTickets,
        criticalTickets,
        healthPercent,
      },
    };
  }

  private generatePrediction(riskLevel: string, recentTickets: number, factors: RiskFactor[]): string {
    const topFactor = factors.sort((a, b) => b.score * b.weight - a.score * a.weight)[0];

    switch (riskLevel) {
      case "CRITICAL":
        return `PC ini sangat berisiko mengalami kegagalan dalam waktu dekat. Faktor utama: ${topFactor.detail}. Perlu maintenance segera.`;
      case "HIGH":
        return `PC ini menunjukkan tanda-tanda degradasi. ${recentTickets} kerusakan baru-baru ini mengindikasikan masalah yang berulang.`;
      case "MEDIUM":
        return `PC ini memiliki risiko sedang. Monitoring lebih ketat disarankan untuk mencegah kerusakan.`;
      default:
        return `PC ini dalam kondisi stabil. Lanjutkan maintenance rutin.`;
    }
  }

  private generateRecommendation(riskLevel: string, factors: RiskFactor[]): string {
    const topFactor = factors.sort((a, b) => b.score * b.weight - a.score * a.weight)[0];

    switch (riskLevel) {
      case "CRITICAL":
        return `SEGERA: Jadwalkan maintenance dalam 24 jam. Fokus pada ${topFactor.name.toLowerCase()}. Pertimbangkan penggantian komponen.`;
      case "HIGH":
        return `Jadwalkan maintenance dalam 3 hari. Periksa ${topFactor.name.toLowerCase()} dan lakukan diagnostik menyeluruh.`;
      case "MEDIUM":
        return `Jadwalkan pemeriksaan rutin minggu depan. Monitor ${topFactor.name.toLowerCase()}.`;
      default:
        return `Lanjutkan jadwal maintenance rutin. Tidak ada tindakan khusus diperlukan.`;
    }
  }

  private estimateFailureDays(riskScore: number, recentTickets: number): number | null {
    if (riskScore < 25) return null;
    const baseDays = Math.max(1, Math.round((100 - riskScore) / 3));
    const ticketFactor = Math.max(0.5, 1 - recentTickets * 0.1);
    return Math.round(baseDays * ticketFactor);
  }
}

export const predictiveMaintenanceService = new PredictiveMaintenanceService();
