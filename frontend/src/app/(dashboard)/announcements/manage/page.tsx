"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  TbSpeakerphone,
  TbPlus,
  TbX,
  TbPin,
  TbPinned,
  TbPinnedOff,
  TbEdit,
  TbTrash,
  TbEye,
  TbEyeOff,
  TbAlertTriangle,
  TbInbox,
  TbLoader2,
  TbFilter,
  TbCalendar,
  TbCheck,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import type {
  Announcement,
  AnnouncementPriority,
  AnnouncementStatus,
} from "@/types";

dayjs.locale("id");

interface ListResponse {
  success: boolean;
  data: Announcement[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

interface SingleResponse {
  success: boolean;
  data: Announcement;
}

type FilterStatus = "ALL" | AnnouncementStatus;

interface FormState {
  title: string;
  content: string;
  status: AnnouncementStatus;
  priority: AnnouncementPriority;
  isPinned: boolean;
  startDate: string;
  endDate: string;
}

const PRIORITY_BADGE: Record<AnnouncementPriority, string> = {
  NORMAL: "bg-[#4b607f] text-white",
  IMPORTANT: "bg-[#f3701e] text-white",
  URGENT: "bg-red-600 text-white",
};

const STATUS_BADGE: Record<AnnouncementStatus, string> = {
  DRAFT: "bg-[#5a5a5a] text-white",
  PUBLISHED: "bg-emerald-600 text-white",
  ARCHIVED: "bg-[#1a1a1a] text-white",
};

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Dipublikasikan",
  ARCHIVED: "Diarsipkan",
};

const PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  NORMAL: "Normal",
  IMPORTANT: "Penting",
  URGENT: "Urgent",
};

const FILTER_TABS: { value: FilterStatus; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "PUBLISHED", label: "Dipublikasikan" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Diarsipkan" },
];

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DDTHH:mm") : "";
}

function emptyForm(): FormState {
  return {
    title: "",
    content: "",
    status: "DRAFT",
    priority: "NORMAL",
    isPinned: false,
    startDate: dayjs().format("YYYY-MM-DDTHH:mm"),
    endDate: "",
  };
}

export default function AnnouncementManagePage() {
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filter !== "ALL") params.set("status", filter);
      const res = await api.get<ListResponse>(
        `/announcements/manage?${params.toString()}`
      );
      setItems(res.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const totals = useMemo(() => {
    return {
      total: items.length,
      published: items.filter((a) => a.status === "PUBLISHED").length,
      draft: items.filter((a) => a.status === "DRAFT").length,
      pinned: items.filter((a) => a.isPinned).length,
    };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      status: a.status,
      priority: a.priority,
      isPinned: a.isPinned,
      startDate: toDatetimeLocal(a.startDate),
      endDate: toDatetimeLocal(a.endDate ?? null),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (form.title.trim().length < 3) {
      toast.error("Judul minimal 3 karakter.");
      return;
    }
    if (form.content.trim().length < 3) {
      toast.error("Konten minimal 3 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        status: form.status,
        priority: form.priority,
        isPinned: form.isPinned,
        startDate: form.startDate
          ? new Date(form.startDate).toISOString()
          : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };

      if (editing) {
        await api.patch<SingleResponse>(`/announcements/${editing.id}`, payload);
        toast.success("Pengumuman berhasil diupdate.");
      } else {
        await api.post<SingleResponse>("/announcements", payload);
        toast.success("Pengumuman berhasil dibuat.");
      }

      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (a: Announcement) => {
    setActionId(a.id);
    try {
      await api.patch<SingleResponse>(`/announcements/${a.id}/publish`, {});
      toast.success(
        a.status === "PUBLISHED"
          ? "Pengumuman dipindah ke draft."
          : "Pengumuman dipublikasikan."
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui status.");
    } finally {
      setActionId(null);
    }
  };

  const handleTogglePin = async (a: Announcement) => {
    setActionId(a.id);
    try {
      await api.patch<SingleResponse>(`/announcements/${a.id}/pin`, {});
      toast.success(a.isPinned ? "Pengumuman dilepas pin." : "Pengumuman disematkan.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui pin.");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionId(confirmDelete.id);
    try {
      await api.delete(`/announcements/${confirmDelete.id}`);
      toast.success("Pengumuman berhasil dihapus.");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      <header className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#f3701e] flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a] shrink-0">
            <TbSpeakerphone className="w-6 h-6 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1a1a1a] leading-tight">
              Manajemen Pengumuman
            </h1>
            <p className="text-sm text-[#5a5a5a] font-medium mt-1">
              Buat, publikasikan, dan kelola pengumuman lab.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="w-full sm:w-auto min-h-[44px] px-5 py-3 bg-[#f3701e] text-white neo-btn flex items-center justify-center gap-2 font-bold"
        >
          <TbPlus className="w-5 h-5" strokeWidth={2.4} />
          Pengumuman Baru
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatChip label="Total" value={totals.total} color="#1a1a1a" />
        <StatChip label="Publikasi" value={totals.published} color="#10b981" />
        <StatChip label="Draft" value={totals.draft} color="#5a5a5a" />
        <StatChip label="Pinned" value={totals.pinned} color="#f3701e" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a] inline-flex items-center gap-1">
          <TbFilter className="w-4 h-4" /> Filter:
        </span>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-lg neo-border-sm transition-colors ${
              filter === tab.value
                ? "bg-[#1a1a1a] text-white"
                : "bg-white text-[#1a1a1a] hover:bg-[#f5ede6]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="neo-card bg-white p-5 animate-pulse">
              <div className="h-4 w-2/3 bg-[#e8d8c9] rounded mb-3" />
              <div className="h-3 w-full bg-[#f5ede6] rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="neo-card bg-white p-8 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-xl bg-[#f5ede6] flex items-center justify-center">
            <TbInbox className="w-7 h-7 text-[#4b607f]" strokeWidth={2} />
          </div>
          <p className="text-sm font-bold text-[#1a1a1a]">
            Belum ada pengumuman.
          </p>
          <p className="text-xs text-[#5a5a5a]">
            Klik tombol &quot;Pengumuman Baru&quot; untuk mulai.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a, idx) => (
            <ManageCard
              key={a.id}
              announcement={a}
              busy={actionId === a.id}
              index={idx}
              onEdit={() => openEdit(a)}
              onDelete={() => setConfirmDelete(a)}
              onTogglePublish={() => void handleTogglePublish(a)}
              onTogglePin={() => void handleTogglePin(a)}
            />
          ))}
        </div>
      )}

      <FormModal
        open={showForm}
        editing={editing}
        form={form}
        setForm={setForm}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <DeleteConfirm
        announcement={confirmDelete}
        busy={actionId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="neo-card bg-white p-3 sm:p-4 flex items-center gap-3 min-h-[64px]">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center neo-border-sm shadow-[2px_2px_0px_#1a1a1a] shrink-0"
        style={{ backgroundColor: color }}
      >
        <span className="text-white font-heading font-bold text-base">
          {value}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5a5a5a]">
          {label}
        </p>
        <p className="font-heading text-lg font-bold text-[#1a1a1a] leading-none mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

function ManageCard({
  announcement,
  busy,
  index,
  onEdit,
  onDelete,
  onTogglePublish,
  onTogglePin,
}: {
  announcement: Announcement;
  busy: boolean;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onTogglePin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="neo-card bg-white overflow-hidden"
    >
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_BADGE[announcement.status]}`}
              >
                {STATUS_LABEL[announcement.status]}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${PRIORITY_BADGE[announcement.priority]}`}
              >
                {PRIORITY_LABEL[announcement.priority]}
              </span>
              {announcement.isPinned && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a1a1a] text-white inline-flex items-center gap-1">
                  <TbPin className="w-3 h-3" /> Pinned
                </span>
              )}
            </div>
            <h3 className="font-heading font-bold text-[#1a1a1a] text-base sm:text-lg leading-tight break-words">
              {announcement.title}
            </h3>
          </div>
        </div>

        <p className="text-sm text-[#1a1a1a]/80 leading-relaxed line-clamp-2 whitespace-pre-line break-words">
          {announcement.content}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5a5a5a] font-medium">
          <span className="inline-flex items-center gap-1">
            <TbCalendar className="w-3 h-3" />
            {dayjs(announcement.startDate).format("DD MMM YYYY")}
          </span>
          {announcement.endDate && (
            <span>
              s/d {dayjs(announcement.endDate).format("DD MMM YYYY")}
            </span>
          )}
          <span>
            {announcement._count?.reads ?? 0} pembaca
          </span>
          {announcement.createdBy?.name && (
            <span>oleh {announcement.createdBy.name}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t-2 border-[#1a1a1a]/10">
          <button
            type="button"
            onClick={onTogglePublish}
            disabled={busy}
            className={`min-h-[44px] px-3 py-2 text-xs font-bold neo-btn flex items-center justify-center gap-1.5 disabled:opacity-50 ${
              announcement.status === "PUBLISHED"
                ? "bg-white text-[#1a1a1a]"
                : "bg-emerald-600 text-white"
            }`}
          >
            {busy ? (
              <TbLoader2 className="w-4 h-4 animate-spin" />
            ) : announcement.status === "PUBLISHED" ? (
              <>
                <TbEyeOff className="w-4 h-4" /> Draft
              </>
            ) : (
              <>
                <TbEye className="w-4 h-4" /> Publish
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onTogglePin}
            disabled={busy}
            className={`min-h-[44px] px-3 py-2 text-xs font-bold neo-btn flex items-center justify-center gap-1.5 disabled:opacity-50 ${
              announcement.isPinned
                ? "bg-white text-[#1a1a1a]"
                : "bg-[#f3701e] text-white"
            }`}
          >
            {announcement.isPinned ? (
              <>
                <TbPinnedOff className="w-4 h-4" /> Lepas Pin
              </>
            ) : (
              <>
                <TbPinned className="w-4 h-4" /> Pin
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="min-h-[44px] px-3 py-2 text-xs font-bold neo-btn flex items-center justify-center gap-1.5 bg-[#4b607f] text-white disabled:opacity-50"
          >
            <TbEdit className="w-4 h-4" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="min-h-[44px] px-3 py-2 text-xs font-bold neo-btn flex items-center justify-center gap-1.5 bg-red-600 text-white disabled:opacity-50"
          >
            <TbTrash className="w-4 h-4" /> Hapus
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function FormModal({
  open,
  editing,
  form,
  setForm,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Announcement | null;
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
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
            className="bg-white border-4 border-[#1a1a1a] rounded-3xl sm:rounded-2xl shadow-[8px_8px_0px_#1a1a1a] w-full max-w-2xl max-h-[75dvh] sm:max-h-[85vh] overflow-y-auto relative mb-[calc(88px+env(safe-area-inset-bottom))] sm:mb-0"
          >
            <div className="absolute top-0 left-0 w-full h-3 bg-[#f3701e] border-b-4 border-[#1a1a1a]" />

            <form onSubmit={onSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4 mt-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#4b607f] flex items-center justify-center neo-border-sm shrink-0">
                  <TbSpeakerphone size={18} className="text-white" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-heading text-lg sm:text-xl font-bold text-[#1a1a1a] leading-tight">
                    {editing ? "Edit Pengumuman" : "Pengumuman Baru"}
                  </h2>
                  <p className="text-xs text-[#5a5a5a] mt-0.5">
                    {editing
                      ? "Perbarui informasi pengumuman."
                      : "Sampaikan informasi penting ke seluruh user."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  aria-label="Tutup"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors shrink-0 disabled:opacity-50"
                >
                  <TbX size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#5a5a5a] mb-1 uppercase tracking-wider">
                  Judul
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Contoh: Maintenance Lab D Jumat 30 Mei"
                  className="w-full px-3 py-2.5 min-h-[40px] neo-input focus:outline-none text-sm font-medium placeholder:text-gray-400"
                />
                <p className="text-[10px] text-[#5a5a5a] mt-0.5">
                  {form.title.length} / 200 karakter
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#5a5a5a] mb-1 uppercase tracking-wider">
                  Konten
                </label>
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  value={form.content}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Tulis isi pengumuman lengkap di sini…"
                  className="w-full px-3 py-2.5 neo-input focus:outline-none text-sm font-medium placeholder:text-gray-400 resize-y leading-relaxed"
                />
                <p className="text-[10px] text-[#5a5a5a] mt-0.5">
                  {form.content.length} / 5000 karakter
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-[#5a5a5a] mb-1 uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as AnnouncementStatus,
                      }))
                    }
                    className="w-full px-3 py-2.5 min-h-[40px] neo-input focus:outline-none text-sm font-bold bg-white"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Publikasikan</option>
                    <option value="ARCHIVED">Arsip</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#5a5a5a] mb-1 uppercase tracking-wider">
                    Prioritas
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        priority: e.target.value as AnnouncementPriority,
                      }))
                    }
                    className="w-full px-3 py-2.5 min-h-[40px] neo-input focus:outline-none text-sm font-bold bg-white"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="IMPORTANT">Penting</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-[#5a5a5a] mb-1 uppercase tracking-wider">
                    Mulai Tampil
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 min-h-[40px] neo-input focus:outline-none text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#5a5a5a] mb-1 uppercase tracking-wider">
                    Berakhir
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 min-h-[40px] neo-input focus:outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer select-none">
                <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg neo-border-sm bg-white">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, isPinned: e.target.checked }))
                    }
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {form.isPinned && (
                    <TbCheck className="w-5 h-5 text-[#f3701e]" strokeWidth={3} />
                  )}
                </span>
                <span>
                  <span className="text-xs font-bold text-[#1a1a1a] inline-flex items-center gap-1">
                    <TbPin className="w-3.5 h-3.5" /> Sematkan ke atas
                  </span>
                  <span className="block text-[10px] text-[#5a5a5a]">
                    Tampil sebagai banner di dashboard.
                  </span>
                </span>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 min-h-[44px] px-4 py-2.5 bg-white text-[#1a1a1a] neo-btn text-sm font-bold disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#f3701e] text-white neo-btn text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Menyimpan…
                    </>
                  ) : editing ? (
                    "Simpan"
                  ) : (
                    "Buat Pengumuman"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeleteConfirm({
  announcement,
  busy,
  onCancel,
  onConfirm,
}: {
  announcement: Announcement | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-4 border-[#1a1a1a] rounded-3xl sm:rounded-2xl shadow-[8px_8px_0px_#1a1a1a] w-full max-w-md overflow-hidden mb-[calc(88px+env(safe-area-inset-bottom))] sm:mb-0"
          >
            <div className="h-3 bg-red-600 border-b-4 border-[#1a1a1a]" />
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a] shrink-0">
                  <TbAlertTriangle className="w-6 h-6 text-white" strokeWidth={2.4} />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-lg font-bold text-[#1a1a1a]">
                    Hapus Pengumuman?
                  </h3>
                  <p className="text-sm text-[#5a5a5a] font-medium mt-1">
                    &quot;{announcement.title}&quot; dan semua data pembacanya akan
                    dihapus permanen.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-3 bg-white text-[#1a1a1a] neo-btn font-bold disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={busy}
                  className="w-full sm:flex-1 min-h-[44px] px-5 py-3 bg-red-600 text-white neo-btn font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <TbLoader2 className="w-5 h-5 animate-spin" /> Menghapus…
                    </>
                  ) : (
                    <>
                      <TbTrash className="w-5 h-5" /> Hapus
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
