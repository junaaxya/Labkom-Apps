import crypto from "crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import prisma from "../config/database";
import redis from "../config/redis";
import { config } from "../config";

const AUDIENCE = "labkom-attendance";
const QR_TTL_SECONDS = 30;

type AttendanceQrPayload = {
  type: "ATTENDANCE_QR";
  locationId: string;
  nonce: string;
  iat: number;
  exp: number;
};

async function ensureRedis(): Promise<void> {
  if (redis.status === "wait") await redis.connect();
  if (redis.status !== "ready" && redis.status !== "connecting" && redis.status !== "connect") {
    throw new Error("Penyimpanan anti-replay QR belum tersedia");
  }
}

export class AttendanceQrService {
  static async createChallenge(locationId: string) {
    const location = await prisma.attendanceLocation.findFirst({
      where: { id: locationId, isActive: true },
      select: { id: true, name: true },
    });
    if (!location) throw new Error("Lokasi absensi aktif tidak ditemukan");

    const nonce = crypto.randomUUID();
    const token = jwt.sign(
      { type: "ATTENDANCE_QR", locationId: location.id, nonce },
      config.jwtSecret,
      { audience: AUDIENCE, expiresIn: QR_TTL_SECONDS, algorithm: "HS256" },
    );
    const qrDataUrl = await QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 2, width: 360 });
    return {
      token,
      qrDataUrl,
      location,
      expiresAt: new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString(),
      ttlSeconds: QR_TTL_SECONDS,
    };
  }

  static verify(token: string): AttendanceQrPayload {
    if (!token?.trim()) throw new Error("QR absensi wajib dipindai");
    try {
      const payload = jwt.verify(token, config.jwtSecret, { audience: AUDIENCE, algorithms: ["HS256"] }) as AttendanceQrPayload;
      if (payload.type !== "ATTENDANCE_QR" || !payload.locationId || !payload.nonce) throw new Error("invalid");
      return payload;
    } catch {
      throw new Error("QR absensi tidak valid atau sudah kedaluwarsa. Pindai QR terbaru");
    }
  }

  static async assertNotUsed(payload: AttendanceQrPayload, userId: string): Promise<void> {
    await ensureRedis();
    const used = await redis.exists(`attendance:qr:used:${payload.nonce}:${userId}`);
    if (used) throw new Error("QR absensi ini sudah pernah digunakan. Pindai QR terbaru");
  }

  static async markUsed(payload: AttendanceQrPayload, userId: string): Promise<void> {
    await ensureRedis();
    const remainingSeconds = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
    const result = await redis.set(`attendance:qr:used:${payload.nonce}:${userId}`, "1", "EX", remainingSeconds, "NX");
    if (result !== "OK") throw new Error("QR absensi ini sudah pernah digunakan. Pindai QR terbaru");
  }
}
