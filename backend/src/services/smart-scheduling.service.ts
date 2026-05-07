import prisma from "../config/database";

interface ScheduleSuggestion {
  labId: string;
  labName: string;
  day: string;
  startTime: string;
  endTime: string;
  reason: string;
  score: number;
  conflicts: string[];
}

interface UsagePattern {
  day: string;
  hour: number;
  usage: number;
  label: string;
}

interface LoadBalance {
  labId: string;
  labName: string;
  totalSlots: number;
  usedSlots: number;
  utilizationPercent: number;
  peakDay: string;
  quietestDay: string;
  recommendation: string;
}

interface OptimalSlot {
  day: string;
  startTime: string;
  endTime: string;
  labId: string;
  labName: string;
  availabilityScore: number;
  reason: string;
}

class SmartSchedulingService {
  private readonly DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  private readonly TIME_SLOTS = [
    "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00",
    "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  ];

  async suggestOptimalSlots(
    duration: number = 120,
    preferredDay?: string,
    preferredLab?: string
  ): Promise<OptimalSlot[]> {
    const labs = await prisma.lab.findMany({
      where: { status: "ACTIVE", ...(preferredLab ? { id: preferredLab } : {}) },
      select: { id: true, name: true },
    });

    const existingSchedules = await prisma.schedule.findMany({
      where: { isActive: true },
      select: { labId: true, day: true, startTime: true, endTime: true },
    });

    const slots: OptimalSlot[] = [];
    const daysToCheck = preferredDay ? [preferredDay] : this.DAYS;
    const durationHours = duration / 60;

    for (const lab of labs) {
      for (const day of daysToCheck) {
        const daySchedules = existingSchedules.filter(
          (s) => s.labId === lab.id && s.day === day
        );

        for (let i = 0; i < this.TIME_SLOTS.length - 1; i++) {
          const startTime = this.TIME_SLOTS[i];
          const endHour = parseInt(startTime.split(":")[0]) + durationHours;
          const endMinute = parseInt(startTime.split(":")[1]);
          const endTime = `${String(Math.floor(endHour)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

          if (endTime > "21:00") continue;

          const hasConflict = daySchedules.some(
            (s) => this.timeOverlaps(startTime, endTime, s.startTime, s.endTime)
          );

          if (!hasConflict) {
            const score = this.calculateSlotScore(day, startTime, daySchedules.length, labs.length);
            slots.push({
              day,
              startTime,
              endTime,
              labId: lab.id,
              labName: lab.name,
              availabilityScore: score,
              reason: this.getSlotReason(score, day, startTime),
            });
          }
        }
      }
    }

    return slots.sort((a, b) => b.availabilityScore - a.availabilityScore).slice(0, 10);
  }

  async getUsagePatterns(): Promise<UsagePattern[]> {
    const schedules = await prisma.schedule.findMany({
      where: { isActive: true },
      select: { day: true, startTime: true, endTime: true },
    });

    const patterns: UsagePattern[] = [];

    for (const day of this.DAYS) {
      for (let hour = 7; hour <= 21; hour++) {
        const timeStr = `${String(hour).padStart(2, "0")}:00`;
        const usage = schedules.filter((s) => {
          if (s.day !== day) return false;
          return s.startTime <= timeStr && s.endTime > timeStr;
        }).length;

        const label = usage === 0 ? "Kosong" : usage === 1 ? "Normal" : usage >= 2 ? "Padat" : "Normal";

        patterns.push({ day, hour, usage, label });
      }
    }

    return patterns;
  }

  async getLoadBalance(): Promise<LoadBalance[]> {
    const labs = await prisma.lab.findMany({
      where: { status: "ACTIVE" },
      include: {
        schedules: { where: { isActive: true }, select: { day: true, startTime: true, endTime: true } },
      },
    });

    const maxSlotsPerDay = 13;
    const totalPossibleSlots = maxSlotsPerDay * 6;

    return labs.map((lab) => {
      const usedSlots = lab.schedules.length;
      const utilizationPercent = Math.round((usedSlots / totalPossibleSlots) * 100);

      const dayCount: Record<string, number> = {};
      this.DAYS.forEach((d) => (dayCount[d] = 0));
      lab.schedules.forEach((s) => {
        dayCount[s.day] = (dayCount[s.day] || 0) + 1;
      });

      const peakDay = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";
      const quietestDay = Object.entries(dayCount).sort(([, a], [, b]) => a - b)[0]?.[0] || "N/A";

      let recommendation: string;
      if (utilizationPercent > 80) {
        recommendation = `Lab ini hampir penuh (${utilizationPercent}%). Pertimbangkan memindahkan beberapa jadwal ke lab lain.`;
      } else if (utilizationPercent > 60) {
        recommendation = `Utilisasi baik (${utilizationPercent}%). Masih ada ruang untuk jadwal tambahan.`;
      } else if (utilizationPercent > 30) {
        recommendation = `Utilisasi sedang (${utilizationPercent}%). Lab ini bisa menampung lebih banyak jadwal.`;
      } else {
        recommendation = `Utilisasi rendah (${utilizationPercent}%). Lab ini sangat tersedia untuk jadwal baru.`;
      }

      return {
        labId: lab.id,
        labName: lab.name,
        totalSlots: totalPossibleSlots,
        usedSlots,
        utilizationPercent,
        peakDay,
        quietestDay,
        recommendation,
      };
    });
  }

  async detectConflicts(): Promise<{
    conflicts: { schedule1: any; schedule2: any; type: string }[];
    warnings: string[];
  }> {
    const schedules = await prisma.schedule.findMany({
      where: { isActive: true },
      include: {
        lab: { select: { name: true } },
        assistant: { select: { name: true } },
      },
    });

    const conflicts: { schedule1: any; schedule2: any; type: string }[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];

        if (s1.day !== s2.day) continue;

        if (s1.labId === s2.labId && this.timeOverlaps(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
          conflicts.push({
            schedule1: { title: s1.title, time: `${s1.startTime}-${s1.endTime}`, lab: s1.lab.name },
            schedule2: { title: s2.title, time: `${s2.startTime}-${s2.endTime}`, lab: s2.lab.name },
            type: "LAB_CONFLICT",
          });
        }

        if (
          s1.lecturerName &&
          s1.lecturerName === s2.lecturerName &&
          this.timeOverlaps(s1.startTime, s1.endTime, s2.startTime, s2.endTime)
        ) {
          conflicts.push({
            schedule1: { title: s1.title, time: `${s1.startTime}-${s1.endTime}`, lecturer: s1.lecturerName },
            schedule2: { title: s2.title, time: `${s2.startTime}-${s2.endTime}`, lecturer: s2.lecturerName },
            type: "LECTURER_CONFLICT",
          });
        }

        if (
          s1.assistantId &&
          s1.assistantId === s2.assistantId &&
          this.timeOverlaps(s1.startTime, s1.endTime, s2.startTime, s2.endTime)
        ) {
          conflicts.push({
            schedule1: { title: s1.title, time: `${s1.startTime}-${s1.endTime}`, assistant: s1.assistant?.name },
            schedule2: { title: s2.title, time: `${s2.startTime}-${s2.endTime}`, assistant: s2.assistant?.name },
            type: "ASSISTANT_CONFLICT",
          });
        }
      }
    }

    const labLoad: Record<string, number> = {};
    schedules.forEach((s) => {
      const key = `${s.labId}-${s.day}`;
      labLoad[key] = (labLoad[key] || 0) + 1;
    });

    Object.entries(labLoad).forEach(([key, count]) => {
      if (count >= 5) {
        const [labId, day] = key.split("-");
        const lab = schedules.find((s) => s.labId === labId)?.lab.name;
        warnings.push(`${lab} memiliki ${count} jadwal pada hari ${day} — pertimbangkan redistribusi`);
      }
    });

    return { conflicts, warnings };
  }

  async getAssistantWorkload(): Promise<{
    assistants: { id: string; name: string; totalHours: number; days: string[]; balance: string }[];
    recommendation: string;
  }> {
    const assistants = await prisma.user.findMany({
      where: { role: "ASISTEN_LAB", isActive: true },
      select: { id: true, name: true },
    });

    const schedules = await prisma.schedule.findMany({
      where: { isActive: true, assistantId: { not: null } },
      select: { assistantId: true, day: true, startTime: true, endTime: true },
    });

    const workloads = assistants.map((a) => {
      const mySchedules = schedules.filter((s) => s.assistantId === a.id);
      const totalMinutes = mySchedules.reduce((sum, s) => {
        const start = parseInt(s.startTime.split(":")[0]) * 60 + parseInt(s.startTime.split(":")[1]);
        const end = parseInt(s.endTime.split(":")[0]) * 60 + parseInt(s.endTime.split(":")[1]);
        return sum + (end - start);
      }, 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      const days = [...new Set(mySchedules.map((s) => s.day))];

      return { id: a.id, name: a.name, totalHours, days, balance: "" };
    });

    const avgHours = workloads.length > 0
      ? workloads.reduce((sum, w) => sum + w.totalHours, 0) / workloads.length
      : 0;

    workloads.forEach((w) => {
      if (w.totalHours > avgHours * 1.3) w.balance = "OVERLOADED";
      else if (w.totalHours < avgHours * 0.7) w.balance = "UNDERUTILIZED";
      else w.balance = "BALANCED";
    });

    const overloaded = workloads.filter((w) => w.balance === "OVERLOADED");
    const underutilized = workloads.filter((w) => w.balance === "UNDERUTILIZED");

    let recommendation = "Distribusi beban kerja asisten lab seimbang.";
    if (overloaded.length > 0 && underutilized.length > 0) {
      recommendation = `${overloaded.map((o) => o.name).join(", ")} kelebihan beban. Pertimbangkan memindahkan beberapa jadwal ke ${underutilized.map((u) => u.name).join(", ")}.`;
    } else if (overloaded.length > 0) {
      recommendation = `${overloaded.map((o) => o.name).join(", ")} kelebihan beban. Pertimbangkan menambah asisten lab.`;
    }

    return { assistants: workloads.sort((a, b) => b.totalHours - a.totalHours), recommendation };
  }

  private timeOverlaps(start1: string, end1: string, start2: string, end2: string): boolean {
    return start1 < end2 && start2 < end1;
  }

  private calculateSlotScore(day: string, startTime: string, existingCount: number, totalLabs: number): number {
    let score = 100;

    const hour = parseInt(startTime.split(":")[0]);
    if (hour >= 8 && hour <= 11) score += 10;
    else if (hour >= 13 && hour <= 16) score += 5;
    else if (hour >= 18) score -= 10;

    if (day === "SABTU") score -= 15;

    score -= existingCount * 5;

    if (existingCount === 0) score += 20;

    return Math.max(0, Math.min(100, score));
  }

  private getSlotReason(score: number, day: string, startTime: string): string {
    if (score >= 90) return "Slot ideal — jam produktif, lab kosong";
    if (score >= 70) return "Slot bagus — waktu yang baik dengan sedikit jadwal lain";
    if (score >= 50) return "Slot tersedia — bisa digunakan meski bukan waktu optimal";
    return "Slot tersedia tapi kurang ideal — pertimbangkan alternatif lain";
  }
}

export const smartSchedulingService = new SmartSchedulingService();
