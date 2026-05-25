"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  TbSpeakerphone,
  TbPin,
  TbPinned,
  TbAlertTriangle,
  TbBell,
  TbX,
  TbInbox,
  TbLoader2,
  TbCircleDot,
  TbUser,
  TbCalendar,
} from "react-icons/tb";
import api from "@/services/api";
import type { Announcement, AnnouncementPriority } from "@/types";

dayjs.locale("id");

interface ListResponse {
  success: boolean;
  data: Announcement[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

interface DetailResponse {
  success: boolean;
  data: Announcement;
}

const PRIORITY_META: Record<AnnouncementPriority, {
  label: string;
  color: string;
  border: string;
  badge: string;
  icon: typeof TbBell;
}> = {
  NORMAL: {
    label: "Normal",
    color: "#4b607f",
    border: "border-l-[#4b607f]",
    badge: "bg-[#4b607f] text-white",
    icon: TbBell,
  },
  IMPORTANT: {
    label: "Penting",
    color: "#f3701e",
    border: "border-l-[#f3701e]",
    badge: "bg-[#f3701e] text-white",
    icon: TbAlertTriangle,
  },
  URGENT: {
    label: "Urgent",
    color: "#dc2626",
    border: "border-l-red-600",
    badge: "bg-red-600 text-white",
    icon: TbAlertTriangle,
  },
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse>("/announcements?limit=50");
      setItems(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pengumuman.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const openDetail = useCallback(async (announcement: Announcement) => {
    setSelected(announcement);
    if (announcement.isRead) return;
    setDetailLoading(true);
    try {
      const res = await api.get<DetailResponse>(`/announcements/${announcement.id}`);
      setSelected(res.data);
      setItems((prev) =>
        prev.map((a) => (a.id === announcement.id ? { ...a, isRead: true } : a))
      );
    } catch {
      // Silent fail; modal still shows the cached content.
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => setSelected(null), []);

  const pinned = useMemo(() => items.filter((a) => a.isPinned), [items]);
  const others = useMemo(() => items.filter((a) => !a.isPinned), [items]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      <header className="flex items-start gap-3 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#4b607f] flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a] shrink-0">
          <TbSpeakerphone className="w-6 h-6 text-white" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1a1a1a] leading-tight">
            Pengumuman Lab
          </h1>
          <p className="text-sm text-[#5a5a5a] font-medium mt-1">
            Informasi dan kebijakan terbaru dari koordinator lab.
          </p>
        </div>
      </header>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {pinned.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a] flex items-center gap-1.5">
                <TbPinned className="w-4 h-4" /> Disematkan
              </h2>
              <div className="space-y-3">
                {pinned.map((a, i) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    pinned
                    index={i}
                    onClick={() => void openDetail(a)}
                  />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3">
              {pinned.length > 0 && (
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">
                  Lainnya
                </h2>
              )}
              <div className="space-y-3">
                {others.map((a, i) => (
                  <AnnouncementCard
                    key={a.id}
                    announcement={a}
                    index={i}
                    onClick={() => void openDetail(a)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <DetailModal
        announcement={selected}
        loading={detailLoading}
        onClose={closeDetail}
      />
    </div>
  );
}

function AnnouncementCard({
  announcement,
  pinned,
  index,
  onClick,
}: {
  announcement: Announcement;
  pinned?: boolean;
  index: number;
  onClick: () => void;
}) {
  const meta = PRIORITY_META[announcement.priority];
  const Icon = meta.icon;
  const unread = !announcement.isRead;
  const date = dayjs(announcement.startDate || announcement.createdAt);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      onClick={onClick}
      className={`w-full text-left neo-card bg-white overflow-hidden border-l-[6px] ${meta.border} active:scale-[0.99] transition-transform`}
    >
      <div className="p-4 sm:p-5 space-y-2">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center neo-border-sm shadow-[2px_2px_0px_#1a1a1a] shrink-0"
            style={{ backgroundColor: meta.color }}
          >
            <Icon className="w-5 h-5 text-white" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="font-heading font-bold text-[#1a1a1a] text-base sm:text-lg leading-tight flex-1 min-w-0 break-words">
                {announcement.title}
              </h3>
              {unread && (
                <span
                  aria-label="Belum dibaca"
                  className="w-2.5 h-2.5 rounded-full bg-[#f3701e] mt-1.5 shrink-0 ring-2 ring-white"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${meta.badge}`}
              >
                {meta.label}
              </span>
              {pinned && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a1a1a] text-white inline-flex items-center gap-1">
                  <TbPin className="w-3 h-3" /> Pinned
                </span>
              )}
              <span className="text-[11px] text-[#5a5a5a] font-medium inline-flex items-center gap-1">
                <TbCalendar className="w-3 h-3" />
                {date.format("DD MMM YYYY")}
              </span>
              {announcement.createdBy?.name && (
                <span className="text-[11px] text-[#5a5a5a] font-medium inline-flex items-center gap-1 truncate max-w-[160px]">
                  <TbUser className="w-3 h-3" /> {announcement.createdBy.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-[#1a1a1a]/80 leading-relaxed line-clamp-2 sm:line-clamp-3 whitespace-pre-line break-words">
          {announcement.content}
        </p>
      </div>
    </motion.button>
  );
}

function DetailModal({
  announcement,
  loading,
  onClose,
}: {
  announcement: Announcement | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-4 border-[#1a1a1a] rounded-3xl sm:rounded-2xl shadow-[8px_8px_0px_#1a1a1a] w-full max-w-2xl max-h-[88vh] overflow-y-auto relative mb-20 sm:mb-0"
          >
            <DetailContent
              announcement={announcement}
              loading={loading}
              onClose={onClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetailContent({
  announcement,
  loading,
  onClose,
}: {
  announcement: Announcement;
  loading: boolean;
  onClose: () => void;
}) {
  const meta = PRIORITY_META[announcement.priority];
  const Icon = meta.icon;

  return (
    <>
      <div
        className="h-3 border-b-4 border-[#1a1a1a]"
        style={{ backgroundColor: meta.color }}
      />
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a] shrink-0"
            style={{ backgroundColor: meta.color }}
          >
            <Icon className="w-6 h-6 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${meta.badge}`}
              >
                {meta.label}
              </span>
              {announcement.isPinned && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a1a1a] text-white inline-flex items-center gap-1">
                  <TbPin className="w-3 h-3" /> Pinned
                </span>
              )}
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-tight break-words">
              {announcement.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors shrink-0"
          >
            <TbX size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#5a5a5a] font-medium mb-5 pb-4 border-b border-[#e8d8c9]">
          <span className="inline-flex items-center gap-1.5">
            <TbCalendar className="w-4 h-4" />
            {dayjs(announcement.startDate || announcement.createdAt).format(
              "DD MMM YYYY · HH:mm"
            )}
          </span>
          {announcement.endDate && (
            <span className="inline-flex items-center gap-1.5">
              <TbCircleDot className="w-4 h-4" />
              Berakhir: {dayjs(announcement.endDate).format("DD MMM YYYY")}
            </span>
          )}
          {announcement.createdBy?.name && (
            <span className="inline-flex items-center gap-1.5">
              <TbUser className="w-4 h-4" /> {announcement.createdBy.name}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-[#5a5a5a]">
            <TbLoader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-[#1a1a1a] whitespace-pre-line break-words leading-relaxed">
            {announcement.content}
          </div>
        )}
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="neo-card bg-white p-5 animate-pulse"
        >
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e8d8c9]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 bg-[#e8d8c9] rounded" />
              <div className="h-3 w-full bg-[#f5ede6] rounded" />
              <div className="h-3 w-5/6 bg-[#f5ede6] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="neo-card bg-white p-6 text-center space-y-3">
      <TbAlertTriangle className="w-10 h-10 mx-auto text-red-500" strokeWidth={2} />
      <p className="text-sm font-bold text-[#1a1a1a]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] px-5 py-2 bg-[#4b607f] text-white neo-btn font-bold inline-flex items-center justify-center"
      >
        Coba Lagi
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="neo-card bg-white p-8 text-center space-y-3">
      <div className="w-14 h-14 mx-auto rounded-xl bg-[#f5ede6] flex items-center justify-center">
        <TbInbox className="w-7 h-7 text-[#4b607f]" strokeWidth={2} />
      </div>
      <h3 className="font-heading font-bold text-lg text-[#1a1a1a]">
        Belum ada pengumuman
      </h3>
      <p className="text-sm text-[#5a5a5a] font-medium">
        Pengumuman baru akan tampil di sini saat dipublikasikan koordinator.
      </p>
    </div>
  );
}
