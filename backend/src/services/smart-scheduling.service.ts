import prisma from "../config/database";

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

interface ConflictScheduleInfo {
  title: string;
  time: string;
  lab?: string;
  lecturerName?: string;
  assistant?: string;
}

interface ScheduleConflict {
  schedule1: ConflictScheduleInfo;
  schedule2: ConflictScheduleInfo;
  type: "LAB_CONFLICT" | "LECTURER_CONFLICT" | "ASSISTANT_CONFLICT";
}

interface ScheduleInterval {
  start: number;
  end: number;
}

class SmartSchedulingService {
  private readonly DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  private readonly TIME_SLOTS = [
    "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00",
    "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  ];
  private readonly OPERATING_START_MINUTES = 7 * 60;
  private readonly OPERATING_END_MINUTES = 21 * 60;
  private readonly SLOT_SIZE_MINUTES = 30;

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
    const durationMinutes = Math.max(this.SLOT_SIZE_MINUTES, duration);

    for (const lab of labs) {
      for (const day of daysToCheck) {
        const daySchedules = existingSchedules.filter(
          (s) => s.labId === lab.id && s.day === day
        );

        for (let i = 0; i < this.TIME_SLOTS.length; i++) {
          const startTime = this.TIME_SLOTS[i];
          const endTime = this.minutesToTime(this.timeToMinutes(startTime) + durationMinutes);

          if (endTime > "21:00") continue;

          const hasConflict = daySchedules.some(
            (s) => this.timeOverlaps(startTime, endTime, s.startTime, s.endTime)
          );

          if (!hasConflict) {
            const score = this.calculateSlotScore(day, startTime, daySchedules.length);
            slots.push({
              day,
              startTime,
              endTime,
              labId: lab.id,
              labName: lab.name,
              availabilityScore: score,
              reason: this.getSlotReason(score),
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
          return this.timeOverlaps(timeStr, this.minutesToTime(this.timeToMinutes(timeStr) + 60), s.startTime, s.endTime);
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

    const totalPossibleMinutes = this.DAYS.length * (this.OPERATING_END_MINUTES - this.OPERATING_START_MINUTES);
    const totalPossibleSlots = Math.round(totalPossibleMinutes / this.SLOT_SIZE_MINUTES);

    return labs.map((lab) => {
      const dayMinutes: Record<string, number> = {};
      this.DAYS.forEach((day) => {
        const intervals = lab.schedules
          .filter((schedule) => schedule.day === day)
          .map((schedule) => ({
            start: Math.max(this.OPERATING_START_MINUTES, this.timeToMinutes(schedule.startTime)),
            end: Math.min(this.OPERATING_END_MINUTES, this.timeToMinutes(schedule.endTime)),
          }))
          .filter((interval) => interval.end > interval.start);
        dayMinutes[day] = this.mergeIntervals(intervals).reduce((sum, interval) => sum + interval.end - interval.start, 0);
      });

      const usedMinutes = Object.values(dayMinutes).reduce((sum, minutes) => sum + minutes, 0);
      const usedSlots = Math.round(usedMinutes / this.SLOT_SIZE_MINUTES);
      const utilizationPercent = Math.round((usedSlots / totalPossibleSlots) * 100);

      const peakDay = Object.entries(dayMinutes).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";
      const quietestDay = Object.entries(dayMinutes).sort(([, a], [, b]) => a - b)[0]?.[0] || "N/A";

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
    conflicts: ScheduleConflict[];
    warnings: string[];
  }> {
    const schedules = await prisma.schedule.findMany({
      where: { isActive: true },
      include: {
        lab: { select: { name: true } },
        assistant: { select: { name: true } },
      },
    });

    const conflicts: ScheduleConflict[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];

        if (s1.day !== s2.day) continue;

        if (s1.labId === s2.labId && this.timeOverlaps(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) {
          conflicts.push({
            schedule1: this.formatConflictSchedule(s1),
            schedule2: this.formatConflictSchedule(s2),
            type: "LAB_CONFLICT",
          });
        }

        if (
          s1.lecturerName &&
          s1.lecturerName === s2.lecturerName &&
          this.timeOverlaps(s1.startTime, s1.endTime, s2.startTime, s2.endTime)
        ) {
          conflicts.push({
            schedule1: this.formatConflictSchedule(s1),
            schedule2: this.formatConflictSchedule(s2),
            type: "LECTURER_CONFLICT",
          });
        }

        if (
          s1.assistantId &&
          s1.assistantId === s2.assistantId &&
          this.timeOverlaps(s1.startTime, s1.endTime, s2.startTime, s2.endTime)
        ) {
          conflicts.push({
            schedule1: this.formatConflictSchedule(s1),
            schedule2: this.formatConflictSchedule(s2),
            type: "ASSISTANT_CONFLICT",
          });
        }
      }
    }

    const labLoad: Record<string, number> = {};
    schedules.forEach((s) => {
      const key = `${s.labId}-${s.day}`;
      labLoad[key] = (labLoad[key] || 0) + this.scheduleDurationMinutes(s.startTime, s.endTime);
    });

    Object.entries(labLoad).forEach(([key, minutes]) => {
      if (minutes >= 6 * 60) {
        const [labId, day] = key.split("-");
        const lab = schedules.find((s) => s.labId === labId)?.lab.name;
        warnings.push(`${lab} terpakai ${Math.round(minutes / 60 * 10) / 10} jam pada hari ${day} — pertimbangkan redistribusi`);
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
    return this.timeToMinutes(start1) < this.timeToMinutes(end2) && this.timeToMinutes(start2) < this.timeToMinutes(end1);
  }

  private timeToMinutes(time: string): number {
    const [hour = "0", minute = "0"] = time.split(":");
    return parseInt(hour, 10) * 60 + parseInt(minute, 10);
  }

  private minutesToTime(minutes: number): string {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  private scheduleDurationMinutes(startTime: string, endTime: string): number {
    return Math.max(0, this.timeToMinutes(endTime) - this.timeToMinutes(startTime));
  }

  private mergeIntervals(intervals: ScheduleInterval[]): ScheduleInterval[] {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged: ScheduleInterval[] = [];

    sorted.forEach((interval) => {
      const last = merged[merged.length - 1];
      if (!last || interval.start > last.end) {
        merged.push({ ...interval });
        return;
      }
      last.end = Math.max(last.end, interval.end);
    });

    return merged;
  }

  private formatConflictSchedule(schedule: {
    title: string;
    startTime: string;
    endTime: string;
    lecturerName: string | null;
    lab: { name: string };
    assistant: { name: string } | null;
  }): ConflictScheduleInfo {
    return {
      title: schedule.title,
      time: `${schedule.startTime}-${schedule.endTime}`,
      lab: schedule.lab.name,
      lecturerName: schedule.lecturerName || undefined,
      assistant: schedule.assistant?.name,
    };
  }

  private calculateSlotScore(day: string, startTime: string, existingCount: number): number {
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

  private getSlotReason(score: number): string {
    if (score >= 90) return "Slot ideal — jam produktif, lab kosong";
    if (score >= 70) return "Slot bagus — waktu yang baik dengan sedikit jadwal lain";
    if (score >= 50) return "Slot tersedia — bisa digunakan meski bukan waktu optimal";
    return "Slot tersedia tapi kurang ideal — pertimbangkan alternatif lain";
  }
}

export const smartSchedulingService = new SmartSchedulingService();
