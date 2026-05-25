import prisma from "../config/database";
import {
  AnnouncementStatus,
  AnnouncementPriority,
  Prisma,
} from "@prisma/client";
import { notificationService } from "./notification.service";

export interface AnnouncementInput {
  title: string;
  content: string;
  status?: AnnouncementStatus;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  startDate?: string | Date;
  endDate?: string | Date | null;
}

const PRIORITY_RANK: Record<AnnouncementPriority, number> = {
  URGENT: 3,
  IMPORTANT: 2,
  NORMAL: 1,
};

function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function validate(data: AnnouncementInput, partial = false): {
  title?: string;
  content?: string;
  status?: AnnouncementStatus;
  priority?: AnnouncementPriority;
  isPinned?: boolean;
  startDate?: Date;
  endDate?: Date | null;
} {
  const out: any = {};

  if (data.title !== undefined) {
    const title = sanitize(data.title);
    if (title.length < 3 || title.length > 200) {
      throw new Error("Judul harus 3-200 karakter.");
    }
    out.title = title;
  } else if (!partial) {
    throw new Error("Judul wajib diisi.");
  }

  if (data.content !== undefined) {
    const content = sanitize(data.content);
    if (content.length < 3 || content.length > 5000) {
      throw new Error("Konten harus 3-5000 karakter.");
    }
    out.content = content;
  } else if (!partial) {
    throw new Error("Konten wajib diisi.");
  }

  if (data.status !== undefined) out.status = data.status;
  if (data.priority !== undefined) out.priority = data.priority;
  if (data.isPinned !== undefined) out.isPinned = data.isPinned;

  if (data.startDate !== undefined) {
    const d = new Date(data.startDate);
    if (isNaN(d.getTime())) throw new Error("Tanggal mulai tidak valid.");
    out.startDate = d;
  }

  if (data.endDate !== undefined) {
    if (data.endDate === null || data.endDate === "") {
      out.endDate = null;
    } else {
      const d = new Date(data.endDate);
      if (isNaN(d.getTime())) throw new Error("Tanggal akhir tidak valid.");
      out.endDate = d;
    }
  }

  return out;
}

export class AnnouncementService {
  /**
   * Get active (PUBLISHED, within date range) announcements for current user.
   * Returns isRead and read count.
   */
  static async getActiveAnnouncements(
    userId: string,
    page = 1,
    limit = 20
  ) {
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      status: "PUBLISHED",
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    };

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { reads: true } },
          reads: { where: { userId }, select: { id: true } },
        },
        orderBy: [
          { isPinned: "desc" },
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    // Sort by priority rank explicitly (Prisma enum order doesn't match desired ranking).
    const sorted = items
      .map((a) => ({
        ...a,
        isRead: a.reads.length > 0,
        reads: undefined as never,
      }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (pr !== 0) return pr;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return {
      data: sorted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single announcement by id, mark as read for the user.
   */
  static async getAnnouncementById(id: string, userId: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });

    if (!announcement) throw new Error("Pengumuman tidak ditemukan.");

    // Mark as read (upsert on unique (announcementId, userId)).
    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: { announcementId: id, userId },
      },
      update: {},
      create: { announcementId: id, userId },
    });

    return { ...announcement, isRead: true };
  }

  /**
   * Get all announcements (for koordinator manage page) — any status.
   */
  static async getAllForManage(page = 1, limit = 20, status?: string) {
    const where: Prisma.AnnouncementWhereInput = {};
    if (
      status &&
      ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)
    ) {
      where.status = status as AnnouncementStatus;
    }

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { reads: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async create(data: AnnouncementInput, createdById: string) {
    const v = validate(data, false);
    const announcement = await prisma.announcement.create({
      data: {
        title: v.title!,
        content: v.content!,
        status: v.status ?? "DRAFT",
        priority: v.priority ?? "NORMAL",
        isPinned: v.isPinned ?? false,
        startDate: v.startDate ?? new Date(),
        endDate: v.endDate ?? null,
        createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });

    if (announcement.status === "PUBLISHED") {
      await this.notifyAllUsers(announcement);
    }

    return announcement;
  }

  static async update(id: string, data: AnnouncementInput) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new Error("Pengumuman tidak ditemukan.");

    const v = validate(data, true);

    const updated = await prisma.announcement.update({
      where: { id },
      data: v,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });

    // Newly published — fire notifications.
    if (
      v.status === "PUBLISHED" &&
      existing.status !== "PUBLISHED"
    ) {
      await this.notifyAllUsers(updated);
    }

    return updated;
  }

  static async delete(id: string) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new Error("Pengumuman tidak ditemukan.");
    await prisma.announcement.delete({ where: { id } });
    return { id };
  }

  static async togglePublish(id: string) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new Error("Pengumuman tidak ditemukan.");

    const nextStatus: AnnouncementStatus =
      existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    const updated = await prisma.announcement.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });

    if (nextStatus === "PUBLISHED" && existing.status !== "PUBLISHED") {
      await this.notifyAllUsers(updated);
    }

    return updated;
  }

  static async togglePin(id: string) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new Error("Pengumuman tidak ditemukan.");

    return prisma.announcement.update({
      where: { id },
      data: { isPinned: !existing.isPinned },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });
  }

  /**
   * Notify all active users about a new published announcement.
   */
  static async notifyAllUsers(announcement: {
    id: string;
    title: string;
    content: string;
  }) {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (users.length === 0) return;

    const truncated =
      announcement.content.length > 160
        ? announcement.content.slice(0, 157) + "..."
        : announcement.content;

    await notificationService.createBulk({
      userIds: users.map((u) => u.id),
      type: "ANNOUNCEMENT_NEW",
      title: `Pengumuman Baru: ${announcement.title}`,
      message: truncated,
      metadata: { link: `/announcements`, announcementId: announcement.id },
    });
  }
}

export default AnnouncementService;
