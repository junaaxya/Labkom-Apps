import prisma from "../config/database";

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const subtractMinutes = (time: string, minutes: number): string => {
  const [h, m] = time.split(":").map(Number);
  const totalMin = h * 60 + m - minutes;
  const adjMin = totalMin < 0 ? totalMin + 24 * 60 : totalMin;
  return `${String(Math.floor(adjMin / 60)).padStart(2, "0")}:${String(adjMin % 60).padStart(2, "0")}`;
};

const normalizeSemester = (s: string) => s.replace(/^semester\s*/i, "").trim();

export class KeyService {
  static async getAllKeys(labId?: string) {
    return prisma.key.findMany({
      where: labId ? { labId } : {},
      include: {
        lab: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, name: true } },
      },
      orderBy: { keyCode: "asc" },
    });
  }

  static async getKeyById(id: string) {
    const key = await prisma.key.findUnique({
      where: { id },
      include: {
        lab: true,
        currentHolder: { select: { id: true, name: true, email: true } },
        keyLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    if (!key) throw new Error("Kunci tidak ditemukan");
    return key;
  }

  static async takeKey(keyId: string, userId: string, userRole: string, notes?: string) {
    const key = await prisma.key.findUnique({ where: { id: keyId } });
    if (!key) throw new Error("Kunci tidak ditemukan");
    if (key.status !== "AVAILABLE") throw new Error("Kunci tidak tersedia");

    if (userRole === "KOORDINATOR_LAB") {
      // admin bypass
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("User tidak ditemukan");
      if (!user.isKetuaKelas) throw new Error("Hanya ketua kelas yang diizinkan mengambil kunci.");

      const now = new Date();
      const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
      const today = dayNames[now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const todaySchedules = await prisma.schedule.findMany({
        where: {
          labId: key.labId,
          day: today as never,
          status: { in: ["SCHEDULED", "ONGOING"] },
          isActive: true,
        },
        orderBy: { startTime: "asc" },
      });

      if (todaySchedules.length === 0) {
        throw new Error("Tidak ada jadwal aktif untuk lab ini hari ini.");
      }

      const activeSchedule = todaySchedules.find((s) => {
        const earlyAccess = subtractMinutes(s.startTime, 30);
        const wraps = earlyAccess > s.startTime;
        return wraps
          ? currentTime >= earlyAccess || currentTime <= s.endTime
          : currentTime >= earlyAccess && currentTime <= s.endTime;
      });

      if (!activeSchedule) {
        const slots = todaySchedules.map((s) => `${s.startTime}-${s.endTime}`).join(", ");
        throw new Error(
          `Belum waktunya mengambil kunci. Jadwal hari ini: ${slots}. Kunci bisa diambil 30 menit sebelum jadwal. Waktu sekarang: ${currentTime}.`
        );
      }

      const scheduleSem = normalizeSemester(activeSchedule.semester || "");
      const userSem = normalizeSemester(user.semester || "");
      if (scheduleSem && userSem && scheduleSem !== userSem) {
        throw new Error(
          `Anda adalah ketua kelas semester ${userSem}, tetapi jadwal aktif untuk semester ${scheduleSem}.`
        );
      }

      // Block retake: only block if returned during THIS schedule's time window
      const todayStart = todayDate();
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);

      // Parse schedule start/end into Date objects for today
      const [startH, startM] = activeSchedule.startTime.split(":").map(Number);
      const [endH, endM] = activeSchedule.endTime.split(":").map(Number);
      const scheduleStart = new Date(todayStart);
      scheduleStart.setHours(startH, startM, 0, 0);
      const scheduleEnd = new Date(todayStart);
      scheduleEnd.setHours(endH, endM, 59, 999);

      // Check if user already returned this key during THIS schedule window
      const alreadyReturned = await prisma.keyLog.findFirst({
        where: {
          keyId,
          userId,
          action: "RETURNED",
          createdAt: { gte: scheduleStart, lte: scheduleEnd },
        },
      });
      if (alreadyReturned) {
        throw new Error("Anda sudah mengembalikan kunci untuk sesi ini. Kunci bisa diambil lagi pada jadwal berikutnya.");
      }

      // Check Asleb has checked in today (daily logbook exists)
      const dailyLogbook = await prisma.logbook.findFirst({
        where: { date: todayStart, status: "CHECKED_IN" },
      });
      if (!dailyLogbook) {
        throw new Error("Asisten Lab belum check-in hari ini. Kunci hanya bisa diambil setelah Asleb membuka sesi.");
      }
    }

    await prisma.keyLog.create({
      data: { keyId, userId, action: "TAKEN", takenAt: new Date(), notes },
    });

    return prisma.key.update({
      where: { id: keyId },
      data: { status: "BORROWED", currentHolderId: userId },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  static async getReturnStatus(keyId: string, userId: string) {
    const key = await prisma.key.findUnique({ where: { id: keyId } });
    if (!key) throw new Error("Kunci tidak ditemukan");
    if (key.status !== "BORROWED") throw new Error("Kunci tidak sedang dipinjam");
    if (key.currentHolderId !== userId) throw new Error("Anda bukan peminjam kunci ini");

    const date = todayDate();
    const dailyLogbook = await prisma.logbook.findFirst({
      where: { date, status: "CHECKED_IN" },
    });

    if (!dailyLogbook) {
      return { needsCondition: false, logbook: null, conditionSubmitted: false };
    }

    const existingCondition = await prisma.logbookCondition.findUnique({
      where: { logbookId_labId: { logbookId: dailyLogbook.id, labId: key.labId } },
    });

    return {
      needsCondition: !existingCondition,
      logbook: { id: dailyLogbook.id, labId: key.labId },
      conditionSubmitted: Boolean(existingCondition),
    };
  }

  static async returnKey(keyId: string, userId: string, notes?: string) {
    const key = await prisma.key.findUnique({ where: { id: keyId } });
    if (!key) throw new Error("Kunci tidak ditemukan");
    if (key.status !== "BORROWED") throw new Error("Kunci tidak sedang dipinjam");
    if (key.currentHolderId !== userId) throw new Error("Anda bukan peminjam kunci ini");

    const date = todayDate();
    const dailyLogbook = await prisma.logbook.findFirst({
      where: { date, status: "CHECKED_IN" },
    });

    if (dailyLogbook) {
      const condition = await prisma.logbookCondition.findUnique({
        where: { logbookId_labId: { logbookId: dailyLogbook.id, labId: key.labId } },
      });
      if (!condition) {
        throw new Error("Anda harus melakukan validasi kondisi lab (foto kondisi akhir) sebelum mengembalikan kunci.");
      }
    }

    await prisma.keyLog.create({
      data: { keyId, userId, action: "RETURNED", returnedAt: new Date(), notes },
    });

    return prisma.key.update({
      where: { id: keyId },
      data: { status: "AVAILABLE", currentHolderId: null },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  static async forceReturnKey(keyId: string, adminUserId: string, reason?: string) {
    const key = await prisma.key.findUnique({ where: { id: keyId } });
    if (!key) throw new Error("Kunci tidak ditemukan");
    if (key.status !== "BORROWED") throw new Error("Kunci tidak sedang dipinjam");

    await prisma.keyLog.create({
      data: {
        keyId,
        userId: adminUserId,
        action: "RETURNED",
        returnedAt: new Date(),
        notes: `[FORCE RETURN] ${reason || "Dikembalikan paksa oleh Koordinator"}`,
      },
    });

    return prisma.key.update({
      where: { id: keyId },
      data: { status: "AVAILABLE", currentHolderId: null },
      include: { lab: { select: { id: true, name: true } } },
    });
  }

  static async getKeyLogs(keyId?: string) {
    return prisma.keyLog.findMany({
      where: keyId ? { keyId } : {},
      include: {
        key: { include: { lab: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  static async findKeyByQR(qrCode: string) {
    const key = await prisma.key.findFirst({
      where: { OR: [{ qrCode }, { keyCode: qrCode }] },
      include: {
        lab: { select: { id: true, name: true } },
        currentHolder: { select: { id: true, name: true } },
      },
    });
    if (!key) throw new Error("QR Code tidak valid");
    return key;
  }
}
