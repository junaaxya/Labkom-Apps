import { Prisma, TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import type { TicketPriority as TicketPriorityType } from "@prisma/client";
import prisma from "../config/database";
import { appendTicketEvent, TicketEventType } from "./ticket-event.service";
import {
  requireActiveActor,
  requireTicket,
  runTicketTransaction,
} from "./ticket-workflow.support";
import {
  TicketAuthorizationError,
  TicketConflictError,
  TicketDuplicateError,
  TicketNotFoundError,
  TicketValidationError,
} from "./ticket-workflow.error";
import { notificationService } from "./notification.service";
import { createHash } from "node:crypto";
import { assertTemporaryUploadOwnership } from "./protected-file-access.service";

function normalizeIssue(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function duplicateKey(pcId: string, category: TicketCategory, title: string): string {
  const fingerprint = createHash("sha256").update(normalizeIssue(title)).digest("hex");
  return `${pcId}:${category}:${fingerprint}`;
}

export type TicketCreateInput = {
  readonly pcId?: string;
  readonly labId?: string;
  readonly assetCode?: string;
  readonly reportedBy: string;
  readonly category: TicketCategory;
  readonly title: string;
  readonly description?: string;
  readonly photo?: readonly string[];
  readonly priority?: TicketPriorityType;
  readonly sourceLogbookConditionId?: string;
};

export type TicketUpdateInput = {
  readonly title?: string;
  readonly description?: string | null;
  readonly category?: TicketCategory;
  readonly priority?: TicketPriorityType;
};

export class TicketReporterService {
  static async create(data: TicketCreateInput) {
    await assertTemporaryUploadOwnership(data.reportedBy, data.photo ?? [], "tickets");
    let canonicalPcId = data.pcId;
    let canonicalLabId = data.labId;
    let activeDuplicateKey = canonicalPcId ? duplicateKey(canonicalPcId, data.category, data.title) : null;
    try {
      const result = await runTicketTransaction(async (tx) => {
        await requireActiveActor(tx, { userId: data.reportedBy });
        if (!Object.values(TicketCategory).includes(data.category)) {
          throw new TicketValidationError("Kategori ticket tidak valid");
        }
        if (data.assetCode) {
          const pcFromAsset = await tx.pC.findUnique({
            where: { assetCode: data.assetCode },
            select: { id: true, labId: true },
          });
          if (!pcFromAsset) throw new TicketNotFoundError("PC tidak ditemukan. Asset code tidak valid.");
          canonicalPcId = pcFromAsset.id;
          canonicalLabId = pcFromAsset.labId;
          activeDuplicateKey = duplicateKey(pcFromAsset.id, data.category, data.title);
        }
        if (!canonicalLabId) throw new TicketValidationError("Lab wajib diisi");
        const lab = await tx.lab.findUnique({
          where: { id: canonicalLabId },
          select: { id: true },
        });
        if (!lab) throw new TicketNotFoundError("Lab tidak ditemukan");

        if (canonicalPcId) {
          const pc = await tx.pC.findUnique({
            where: { id: canonicalPcId },
            select: { id: true, labId: true },
          });
          if (!pc) throw new TicketNotFoundError("PC tidak ditemukan");
          if (pc.labId !== canonicalLabId) {
            throw new TicketValidationError("PC tidak berada di lab yang dipilih");
          }
          const candidates = await tx.ticket.findMany({
            where: {
              pcId: canonicalPcId,
              category: data.category,
              status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING] },
            },
            select: { id: true, status: true, createdAt: true, reportedBy: true, title: true, activeDuplicateKey: true },
          });
          const duplicate = candidates.find((candidate) =>
            candidate.activeDuplicateKey === activeDuplicateKey
            || normalizeIssue(candidate.title) === normalizeIssue(data.title)
          );
          if (duplicate) throw new TicketDuplicateError(duplicate);
          await tx.pC.update({ where: { id: canonicalPcId }, data: { status: "BROKEN" } });
        }

        if (data.sourceLogbookConditionId) {
          const existingSource = await tx.ticket.findUnique({
            where: { sourceLogbookConditionId: data.sourceLogbookConditionId },
            select: { id: true, status: true, createdAt: true, reportedBy: true },
          });
          if (existingSource) throw new TicketDuplicateError(existingSource);
        }

        const ticket = await tx.ticket.create({
          data: {
            pcId: canonicalPcId,
            labId: canonicalLabId,
            reportedBy: data.reportedBy,
            category: data.category,
            title: data.title,
            description: data.description,
            photo: [...(data.photo ?? [])],
            priority: data.priority ?? TicketPriority.MEDIUM,
            activeDuplicateKey,
            sourceLogbookConditionId: data.sourceLogbookConditionId,
          },
          include: {
            lab: { select: { id: true, name: true } },
            pc: { select: { id: true, pcCode: true } },
          },
        });
        const event = await appendTicketEvent(tx, {
          ticketId: ticket.id,
          actorId: data.reportedBy,
          eventType: TicketEventType.CREATED,
          fromStatus: null,
          toStatus: TicketStatus.OPEN,
          fromAssigneeId: ticket.assignedTo,
          toAssigneeId: ticket.assignedTo,
          note: null,
        });

        const missionPoints: Record<TicketPriorityType, number> = {
          LOW: 10,
          MEDIUM: 20,
          HIGH: 30,
          CRITICAL: 50,
        };
        const mission = await tx.mission.create({
          data: {
            title: `[Perbaikan] ${ticket.title}`,
            description: `Laporan kerusakan dari mahasiswa: ${ticket.description || ticket.title}. Lab: ${ticket.lab?.name || "Unknown"}${ticket.pc ? `, PC: ${ticket.pc.pcCode}` : ""}. Kategori: ${ticket.category}.`,
            points: missionPoints[ticket.priority],
            status: "OPEN",
            createdById: data.reportedBy,
            sourceTicketId: ticket.id,
          },
        });

        return { ticket, eventId: event.id, missionId: mission.id, missionTitle: mission.title };
      });
      await Promise.allSettled([
        notificationService.notifyTicketCreated(
          result.ticket.reportedBy,
          result.ticket.title,
          result.ticket.id,
          result.eventId,
        ),
        notificationService.notifyMissionAvailable(result.missionTitle, result.missionId, result.ticket.id),
      ]);
      return result.ticket;
    } catch (error) {
      if (error instanceof TicketDuplicateError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicateFilters = [
          ...(activeDuplicateKey ? [{ activeDuplicateKey }] : []),
          ...(data.sourceLogbookConditionId ? [{ sourceLogbookConditionId: data.sourceLogbookConditionId }] : []),
        ];
        if (duplicateFilters.length === 0) throw error;
        const duplicate = await prisma.ticket.findFirst({
          where: {
            OR: duplicateFilters,
          },
          select: { id: true, status: true, createdAt: true, reportedBy: true },
        });
        if (duplicate) throw new TicketDuplicateError(duplicate);
      }
      throw error;
    }
  }

  static async update(id: string, data: TicketUpdateInput, requesterId: string) {
    let expectedUpdatedAt: Date | undefined;
    let nextDuplicateKey: string | null = null;
    try {
      return await runTicketTransaction(async (tx) => {
      if (data.category && !Object.values(TicketCategory).includes(data.category)) {
        throw new TicketValidationError("Kategori ticket tidak valid");
      }
      const persistedActor = await requireActiveActor(tx, { userId: requesterId });
      const ticket = await requireTicket(tx, id);
      if (ticket.reportedBy !== persistedActor.id) {
        throw new TicketAuthorizationError("Anda tidak berhak mengubah ticket ini");
      }
      if (ticket.status !== TicketStatus.OPEN) {
        throw new TicketConflictError("Ticket hanya bisa diubah saat status OPEN");
      }
      if (expectedUpdatedAt && ticket.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
      }
      expectedUpdatedAt = ticket.updatedAt;

      const updateData: Prisma.TicketUpdateManyMutationInput = { updatedAt: new Date() };
      const editedFields: string[] = [];
      if (data.title !== undefined) {
        updateData.title = data.title;
        editedFields.push("title");
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
        editedFields.push("description");
      }
      if (data.category !== undefined) {
        updateData.category = data.category;
        editedFields.push("category");
      }
      if (ticket.pcId && (data.title !== undefined || data.category !== undefined)) {
        const nextTitle = data.title ?? ticket.title;
        const nextCategory = data.category ?? ticket.category;
        nextDuplicateKey = duplicateKey(ticket.pcId, nextCategory, nextTitle);
        const candidates = await tx.ticket.findMany({
          where: {
            id: { not: id },
            pcId: ticket.pcId,
            category: nextCategory,
            status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING] },
          },
          select: { id: true, status: true, createdAt: true, reportedBy: true, title: true, activeDuplicateKey: true },
        });
        const duplicate = candidates.find((candidate) =>
          candidate.activeDuplicateKey === nextDuplicateKey
          || normalizeIssue(candidate.title) === normalizeIssue(nextTitle)
        );
        if (duplicate) throw new TicketDuplicateError(duplicate);
        updateData.activeDuplicateKey = nextDuplicateKey;
      }
      if (data.priority !== undefined) {
        updateData.priority = data.priority;
        editedFields.push("priority");
      }

      const updated = await tx.ticket.updateMany({
        where: {
          id,
          reportedBy: persistedActor.id,
          status: TicketStatus.OPEN,
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          updatedAt: ticket.updatedAt,
        },
        data: updateData,
      });
      if (updated.count !== 1) {
        throw new TicketConflictError("Ticket berubah oleh proses lain. Silakan coba lagi.");
      }
      await appendTicketEvent(tx, {
        ticketId: id,
        actorId: persistedActor.id,
        eventType: TicketEventType.REPORTER_EDITED,
        fromStatus: TicketStatus.OPEN,
        toStatus: TicketStatus.OPEN,
        fromAssigneeId: ticket.assignedTo,
        toAssigneeId: ticket.assignedTo,
        note: editedFields.join(", "),
      });
        return tx.ticket.findUniqueOrThrow({ where: { id } });
      });
    } catch (error) {
      if (error instanceof TicketDuplicateError) throw error;
      if (nextDuplicateKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.ticket.findFirst({
          where: { activeDuplicateKey: nextDuplicateKey },
          select: { id: true, status: true, createdAt: true, reportedBy: true },
        });
        if (duplicate) throw new TicketDuplicateError(duplicate);
      }
      throw error;
    }
  }
}
