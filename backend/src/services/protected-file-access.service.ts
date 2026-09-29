import prisma from "../config/database";
import redis from "../config/redis";
import type { UploadCategory } from "../config/upload";

const TEMP_OWNER_PREFIX = "protected-upload-owner:";
const TEMP_OWNER_TTL_SECONDS = 60 * 60;

function uploadUrl(category: UploadCategory, filename: string): string {
  return `/uploads/${category}/${filename}`;
}

export async function registerTemporaryUploadOwner(
  userId: string,
  category: UploadCategory,
  filename: string,
): Promise<void> {
  await redis.set(`${TEMP_OWNER_PREFIX}${category}:${filename}`, userId, "EX", TEMP_OWNER_TTL_SECONDS);
}

export async function authorizeProtectedFileAccess(
  userId: string,
  role: string,
  category: UploadCategory,
  filename: string,
): Promise<boolean> {
  if (role === "KOORDINATOR_LAB") return true;

  const temporaryOwner = await redis.get(`${TEMP_OWNER_PREFIX}${category}:${filename}`);
  if (temporaryOwner === userId) return true;

  const url = uploadUrl(category, filename);
  const [ticket, claims, leave, correction, task, condition, avatar, template] = await Promise.all([
    prisma.ticket.findFirst({
      where: { photo: { has: url }, OR: [{ reportedBy: userId }, { assignedTo: userId }] },
      select: { id: true },
    }),
    prisma.missionClaim.findMany({
      where: { aslebId: userId, proof: { contains: url } },
      select: { proof: true },
    }),
    prisma.leaveRequest.findFirst({ where: { userId, evidenceUrl: url }, select: { id: true } }),
    prisma.attendanceCorrectionRequest.findFirst({ where: { userId, evidenceUrl: url }, select: { id: true } }),
    prisma.dailyTaskLog.findFirst({ where: { userId, photoUrl: url }, select: { id: true } }),
    prisma.logbookCondition.findFirst({
      where: { submittedById: userId, fotoBukti: { has: url } },
      select: { id: true },
    }),
    prisma.user.findFirst({ where: { avatar: url, isActive: true }, select: { id: true } }),
    prisma.certificateTemplate.findFirst({ where: { imageUrl: url, isActive: true }, select: { id: true } }),
  ]);

  const claim = claims.some((item) => item.proof?.trim() === url);

  return Boolean(ticket || claim || leave || correction || task || condition || avatar || template);
}
