import prisma from "../config/database";
import { getJakartaClock } from "./jakarta-time";

const STAFF_ROLES = new Set(["KOORDINATOR_LAB", "ASISTEN_LAB"]);

type Occurrence = {
  schedule: { id: string; labId: string; className: string | null; semester: string | null; specificDate: Date | null; startTime: string; endTime: string };
  occurrenceDate: Date;
  bookingId: string | null;
};

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";
const minutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

function isWithinTakeWindow(now: string, startTime: string, endTime: string): boolean {
  const start = minutes(startTime);
  const early = (start - 30 + 1440) % 1440;
  const end = minutes(endTime);
  const current = minutes(now);
  if (end >= start) return current >= Math.max(0, start - 30) && current <= end;
  return current >= early || current <= end;
}

function dateOnly(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export class KeyService {
  private static async resolveOccurrence(keyId: string, userId: string, role: string, now: Date): Promise<Occurrence> {
    const [key, user] = await Promise.all([
      prisma.key.findUnique({ where: { id: keyId }, select: { id: true, labId: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isKetuaKelas: true, semester: true, className: true } }),
    ]);
    if (!key) throw new Error("Kunci tidak ditemukan");
    if (!user) throw new Error("User tidak ditemukan");
    if (user.role !== role) throw new Error("Peran akun tidak valid");
    if (!STAFF_ROLES.has(role) && (role !== "MAHASISWA" || !user.isKetuaKelas)) {
      throw new Error("Hanya Koordinator Lab, Asisten Lab, atau ketua kelas yang diizinkan mengambil kunci.");
    }

    const clock = getJakartaClock(now);
    const schedules = await prisma.schedule.findMany({
      where: {
        labId: key.labId,
        isActive: true,
        status: { in: ["SCHEDULED", "ONGOING"] },
        OR: [{ specificDate: clock.date }, { specificDate: null, day: clock.day as never }],
      },
      select: { id: true, labId: true, className: true, semester: true, specificDate: true, startTime: true, endTime: true },
    });
    const active = schedules.filter((schedule) => isWithinTakeWindow(clock.time, schedule.startTime, schedule.endTime));
    if (active.length === 0) throw new Error("Tidak ada sesi lab aktif yang memenuhi waktu pengambilan kunci.");
    if (active.length !== 1) throw new Error("Jadwal lab aktif ambigu. Hubungi Koordinator Lab.");

    const schedule = active[0];
    if (!STAFF_ROLES.has(role)) {
      const scheduleClass = normalize(schedule.className);
      const userClass = normalize(user.className);
      if (!scheduleClass || !userClass || scheduleClass !== userClass) {
        throw new Error("Otoritas ketua kelas tidak cocok dengan kelas pada jadwal aktif.");
      }
      const scheduleSemester = normalize(schedule.semester).replace(/^semester\s*/, "");
      const userSemester = normalize(user.semester).replace(/^semester\s*/, "");
      if (!scheduleSemester || !userSemester || scheduleSemester !== userSemester) {
        throw new Error("Otoritas ketua kelas tidak cocok dengan semester pada jadwal aktif.");
      }
    }

    const booking = await prisma.labBooking.findMany({
      where: { labId: key.labId, date: clock.date, startTime: schedule.startTime, endTime: schedule.endTime, status: "APPROVED" },
      select: { id: true },
      take: 2,
    });
    if (booking.length > 1) throw new Error("Peminjaman lab untuk sesi ini ambigu. Hubungi Koordinator Lab.");
    return { schedule, occurrenceDate: dateOnly(clock.date), bookingId: booking[0]?.id ?? null };
  }

  static async getAllKeys(labId?: string) {
    return prisma.key.findMany({
      where: labId ? { labId } : {},
      include: { lab: { select: { id: true, name: true } }, currentHolder: { select: { id: true, name: true } } },
      orderBy: { keyCode: "asc" },
    });
  }

  static async getKeyById(id: string) {
    const key = await prisma.key.findUnique({
      where: { id },
      include: {
        lab: true,
        currentHolder: { select: { id: true, name: true, email: true } },
        keyLogs: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!key) throw new Error("Kunci tidak ditemukan");
    return key;
  }

  static async getEligibility(keyId: string, userId: string, userRole: string, now = new Date()) {
    const key = await prisma.key.findUnique({ where: { id: keyId }, select: { id: true, status: true, currentHolderId: true } });
    if (!key) throw new Error("Kunci tidak ditemukan");
    const canReturn = key.status === "BORROWED" && key.currentHolderId === userId;
    const activeCycle = canReturn
      ? await prisma.keyBorrowCycle.findFirst({ where: { keyId, status: "ACTIVE" }, include: { returnEvidence: true } })
      : null;
    let canTake = false;
    let takeReason: string | undefined;
    let occurrence: { scheduleId: string; occurrenceDate: Date } | undefined;
    if (key.status === "AVAILABLE") {
      try {
        const resolved = await KeyService.resolveOccurrence(keyId, userId, userRole, now);
        const completed = await prisma.keyBorrowCycle.findUnique({
          where: { keyId_scheduleId_occurrenceDate: { keyId, scheduleId: resolved.schedule.id, occurrenceDate: resolved.occurrenceDate } },
          select: { id: true },
        });
        if (completed) takeReason = "Kunci sudah digunakan untuk pertemuan ini.";
        else {
          canTake = true;
          occurrence = { scheduleId: resolved.schedule.id, occurrenceDate: resolved.occurrenceDate };
        }
      } catch (error) {
        takeReason = error instanceof Error ? error.message : "Kunci belum dapat diambil.";
      }
    } else takeReason = "Kunci tidak tersedia.";
    return {
      canTake,
      takeReason,
      canReturn,
      returnReason: canReturn ? undefined : "Anda bukan pemegang kunci aktif.",
      needsCondition: Boolean(activeCycle && !activeCycle.returnEvidence),
      cycleId: activeCycle?.id ?? null,
      occurrence,
    };
  }

  static async takeKey(keyId: string, userId: string, userRole: string, notes?: string, now = new Date()) {
    const occurrence = await KeyService.resolveOccurrence(keyId, userId, userRole, now);
    return prisma.$transaction(async (tx) => {
      const key = await tx.key.findUnique({ where: { id: keyId }, select: { status: true } });
      if (!key || key.status !== "AVAILABLE") throw new Error("Kunci tidak tersedia");
      const existingCycle = await tx.keyBorrowCycle.findUnique({
        where: { keyId_scheduleId_occurrenceDate: { keyId, scheduleId: occurrence.schedule.id, occurrenceDate: occurrence.occurrenceDate } },
        select: { id: true },
      });
      if (existingCycle) throw new Error("Kunci sudah digunakan untuk pertemuan ini.");
      const cycle = await tx.keyBorrowCycle.create({
        data: {
          keyId,
          scheduleId: occurrence.schedule.id,
          occurrenceDate: occurrence.occurrenceDate,
          bookingId: occurrence.bookingId,
          borrowerId: userId,
          takenAt: now,
          takenByRole: userRole as never,
        },
      });
      const claimed = await tx.key.updateMany({ where: { id: keyId, status: "AVAILABLE" }, data: { status: "BORROWED", currentHolderId: userId } });
      if (claimed.count !== 1) throw new Error("Kunci tidak tersedia");
      await tx.keyLog.create({ data: { keyId, userId, borrowCycleId: cycle.id, action: "TAKEN", takenAt: now, notes } });
      return tx.key.findUnique({ where: { id: keyId }, include: { lab: { select: { id: true, name: true } } } });
    });
  }

  static async getReturnStatus(keyId: string, userId: string) {
    const key = await prisma.key.findUnique({ where: { id: keyId }, select: { status: true, currentHolderId: true } });
    if (!key) throw new Error("Kunci tidak ditemukan");
    if (key.status !== "BORROWED" || key.currentHolderId !== userId) throw new Error("Anda bukan peminjam kunci ini");
    const cycle = await prisma.keyBorrowCycle.findFirst({ where: { keyId, borrowerId: userId, status: "ACTIVE" }, include: { returnEvidence: true } });
    if (!cycle) throw new Error("Siklus peminjaman aktif tidak ditemukan");
    return { needsCondition: !cycle.returnEvidence, conditionSubmitted: Boolean(cycle.returnEvidence), cycleId: cycle.id, logbook: null };
  }

  static async saveReturnEvidence(keyId: string, userId: string, fotoBukti: string[]) {
    if (fotoBukti.length === 0) throw new Error("Minimal satu foto kondisi lab wajib diisi.");
    return prisma.$transaction(async (tx) => {
      const cycle = await tx.keyBorrowCycle.findFirst({ where: { keyId, borrowerId: userId, status: "ACTIVE" }, include: { key: true } });
      if (!cycle || cycle.key.status !== "BORROWED" || cycle.key.currentHolderId !== userId) throw new Error("Siklus peminjaman aktif tidak ditemukan");
      const uploads = await tx.conditionPhotoUpload.findMany({ where: { url: { in: fotoBukti }, ownerId: userId, keyBorrowCycleId: cycle.id } });
      if (uploads.length !== fotoBukti.length) throw new Error("Foto kondisi tidak terdaftar untuk siklus peminjaman ini.");
      return tx.keyBorrowEvidence.upsert({
        where: { keyBorrowCycleId: cycle.id },
        create: { keyBorrowCycleId: cycle.id, submittedById: userId, fotoBukti },
        update: { submittedById: userId, fotoBukti },
      });
    });
  }

  static async returnKey(keyId: string, userId: string, notes?: string, now = new Date()) {
    return prisma.$transaction(async (tx) => {
      const cycle = await tx.keyBorrowCycle.findFirst({
        where: { keyId, borrowerId: userId, status: "ACTIVE" },
        include: { key: true, returnEvidence: true },
      });
      if (!cycle || cycle.key.status !== "BORROWED" || cycle.key.currentHolderId !== userId) throw new Error("Anda bukan peminjam kunci aktif ini");
      if (!cycle.returnEvidence || cycle.returnEvidence.createdAt < cycle.takenAt) {
        throw new Error("Foto kondisi akhir yang terikat pada siklus peminjaman wajib dikirim sebelum pengembalian.");
      }
      const returned = await tx.key.updateMany({ where: { id: keyId, status: "BORROWED", currentHolderId: userId }, data: { status: "AVAILABLE", currentHolderId: null } });
      if (returned.count !== 1) throw new Error("Kunci tidak sedang dipinjam");
      await tx.keyBorrowCycle.update({ where: { id: cycle.id }, data: { status: "RETURNED", returnedAt: now, returnedById: userId } });
      await tx.keyLog.create({ data: { keyId, userId, borrowCycleId: cycle.id, action: "RETURNED", returnedAt: now, notes } });
      return tx.key.findUnique({ where: { id: keyId }, include: { lab: { select: { id: true, name: true } } } });
    });
  }

  static async forceReturnKey(keyId: string, adminUserId: string, reason: string, now = new Date()) {
    if (!reason.trim()) throw new Error("Alasan force return wajib diisi.");
    return prisma.$transaction(async (tx) => {
      const cycle = await tx.keyBorrowCycle.findFirst({ where: { keyId, status: "ACTIVE" }, include: { key: true } });
      if (!cycle || cycle.key.status !== "BORROWED") throw new Error("Kunci tidak sedang dipinjam");
      const returned = await tx.key.updateMany({ where: { id: keyId, status: "BORROWED", currentHolderId: cycle.borrowerId }, data: { status: "AVAILABLE", currentHolderId: null } });
      if (returned.count !== 1) throw new Error("Kunci tidak sedang dipinjam");
      await tx.keyBorrowCycle.update({ where: { id: cycle.id }, data: { status: "FORCE_RETURNED", returnedAt: now, forceReturnedById: adminUserId, reason: reason.trim() } });
      await tx.keyLog.create({ data: { keyId, userId: adminUserId, borrowCycleId: cycle.id, action: "FORCE_RETURNED", returnedAt: now, notes: reason.trim() } });
      return tx.key.findUnique({ where: { id: keyId }, include: { lab: { select: { id: true, name: true } } } });
    });
  }

  static async getKeyLogs(keyId?: string) {
    return prisma.keyLog.findMany({
      where: keyId ? { keyId } : {},
      include: { key: { include: { lab: { select: { id: true, name: true } } } }, user: { select: { id: true, name: true } }, borrowCycle: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  static async findKeyByQR(qrCode: string) {
    const key = await prisma.key.findFirst({
      where: { OR: [{ qrCode }, { keyCode: qrCode }] },
      include: { lab: { select: { id: true, name: true } }, currentHolder: { select: { id: true, name: true } } },
    });
    if (!key) throw new Error("QR Code tidak valid");
    return key;
  }
}
