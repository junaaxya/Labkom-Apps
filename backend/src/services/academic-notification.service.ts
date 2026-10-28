import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { notificationService } from "./notification.service";

type AcademicEvent = "report" | "release" | "allocation" | "swap";

export async function notifyAcademicOffering(input: {
  offeringId: string;
  actorId: string;
  event: AcademicEvent;
  eventId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const offering = await prisma.academicOffering.findUnique({
    where: { id: input.offeringId },
    select: {
      termId: true,
      classId: true,
      dosenId: true,
      pjs: { where: { isActive: true }, select: { membership: { select: { userId: true } } } },
    },
  });
  if (!offering) return;

  const leaders = await prisma.academicClassLeader.findMany({
    where: {
      termId: offering.termId,
      classId: offering.classId,
      isActive: true,
    },
    select: { membership: { select: { userId: true } } },
  });

  const recipients = [...new Set([
    offering.dosenId,
    ...offering.pjs.map((pj) => pj.membership.userId),
    ...leaders.map((leader) => leader.membership.userId),
  ])].filter((userId) => userId !== input.actorId);

  await Promise.all(recipients.map(async (userId) => {
    try {
      await notificationService.create({
        userId,
        type: "SYSTEM",
        title: input.title,
        message: input.message,
        metadata: { academicEvent: input.event, academicEventId: input.eventId, ...input.metadata },
        reminderKey: `academic:${input.event}:${input.eventId}:${userId}`,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
  }));
}
