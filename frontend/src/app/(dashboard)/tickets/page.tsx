"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { TbPlus, TbFolderOpen, TbClock, TbCheck, TbX, TbTicket, TbChevronLeft, TbChevronRight, TbInbox } from "react-icons/tb";
import { PhotoUpload } from "@/components/ui/photo-upload";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface TicketItem {
  id: string;
  title: string;
  category: string;
  lab?: { id: string; name: string } | null;
  pc?: { id: string; pcCode: string } | null;
  reporter?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
}

const statusConfig: Record<TicketStatus, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-blue-500 text-white" },
  IN_PROGRESS: { label: "In Progress", color: "bg-yellow-500 text-white" },
  RESOLVED: { label: "Resolved", color: "bg-green-500 text-white" },
  REJECTED: { label: "Rejected", color: "bg-red-500 text-white" },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  LOW: { label: "Low", color: "bg-gray-200 text-gray-700" },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-700" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700" },
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-700" },
};

const CATEGORIES = [
  "HARDWARE",
  "SOFTWARE",
  "JARINGAN",
  "PRINTER",
  "PROYEKTOR",
  "AC_LISTRIK",
  "FURNITURE",
  "KEBERSIHAN",
  "KEAMANAN",
  "LAINNYA",
] as const;

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  rejected: number;
}

interface TicketPagination {
  page: number;
  totalPages: number;
  total: number;
}

const INITIAL_STATS: TicketStats = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  rejected: 0,
};

const INITIAL_PAGINATION: TicketPagination = {
  page: 1,
  totalPages: 1,
  total: 0,
};

const categoryIcon = (category: string) => {
  if (category === "HARDWARE") return "🖥️";
  if (category === "SOFTWARE") return "💿";
  if (category === "JARINGAN") return "🌐";
  if (category === "PRINTER") return "🖨️";
  if (category === "PROYEKTOR") return "📽️";
  if (category === "AC_LISTRIK") return "⚡";
  if (category === "FURNITURE") return "🪑";
  if (category === "KEBERSIHAN") return "🧹";
  if (category === "KEAMANAN") return "🛡️";
  return "📌";
};

export default function TicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [stats, setStats] = useState<TicketStats>(INITIAL_STATS);
  const [pagination, setPagination] = useState<TicketPagination>(INITIAL_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "HARDWARE",
    priority: "MEDIUM" as TicketPriority,
    labId: "",
    pcId: "",
    photo: [] as string[],
  });

  const fetchStats = async () => {
    try {
      const res = await api.get<{ data: TicketStats }>("/tickets/stats");
      setStats(res.data ?? INITIAL_STATS);
    } catch {
      setStats(INITIAL_STATS);
    }
  };

  const fetchTickets = async (nextPage: number, nextStatus: TicketStatus | "ALL") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("limit", "10");
      if (nextStatus !== "ALL") {
        params.set("status", nextStatus);
      }

      const res = await api.get<{ data: { items: TicketItem[]; pagination?: Partial<TicketPagination> } }>(`/tickets?${params.toString()}`);
      const result = res.data ?? { items: [], pagination: {} };
      const items = Array.isArray(result) ? result : (result.items ?? []);
      setTickets(items as TicketItem[]);

      const rawPagination = Array.isArray(result) ? {} : (result.pagination ?? {});
      setPagination({
        page: rawPagination.page ?? nextPage,
        totalPages: rawPagination.totalPages ?? 1,
        total: rawPagination.total ?? items.length,
      });
    } catch (err: unknown) {
      setTickets([]);
      const errorMessage = err instanceof Error ? err.message : "Gagal memuat data ticket";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const initData = async () => {
      if (mounted) {
        await Promise.all([
          fetchStats(),
          fetchTickets(1, "ALL")
        ]);
      }
    };
    
    initData();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleChangeStatus = (status: TicketStatus | "ALL") => {
    setSelectedStatus(status);
    setPage(1);
    fetchTickets(1, status);
  };

  const handlePrev = () => {
    if (page <= 1) return;
    const nextPage = page - 1;
    setPage(nextPage);
    fetchTickets(nextPage, selectedStatus);
  };

  const handleNext = () => {
    if (page >= pagination.totalPages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTickets(nextPage, selectedStatus);
  };

  const handleCreateTicket = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post<unknown>("/tickets", {
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        labId: form.labId,
        pcId: form.pcId || undefined,
        photo: form.photo && form.photo.length > 0 ? form.photo : undefined,
      });

      setShowCreateModal(false);
      setForm({
        title: "",
        description: "",
        category: "HARDWARE",
        priority: "MEDIUM",
        labId: "",
        pcId: "",
        photo: [],
      });

      await Promise.all([fetchStats(), fetchTickets(1, selectedStatus)]);
      setPage(1);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Gagal membuat ticket";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">Ticketing Kerusakan</h1>
          <p className="text-[#5a5a5a] mt-1 font-medium">Laporkan & kelola kerusakan perangkat lab</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-[#f3701e] text-white neo-btn flex items-center gap-2 font-bold"
        >
          <TbPlus size={20} strokeWidth={2.2} />
          Buat Ticket
        </motion.button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -2 }} className="neo-card p-4 border-l-4 border-l-blue-500 flex items-center gap-3 transition-transform">
          <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-[#1a1a1a] flex items-center justify-center text-blue-500">
            <TbFolderOpen size={24} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading text-[#1a1a1a]">{stats.open}</p>
            <p className="text-xs font-bold text-[#5a5a5a] uppercase tracking-wider">Open</p>
          </div>
        </motion.div>
        
        <motion.div whileHover={{ y: -2 }} className="neo-card p-4 border-l-4 border-l-yellow-500 flex items-center gap-3 transition-transform">
          <div className="w-12 h-12 rounded-full bg-yellow-100 border-2 border-[#1a1a1a] flex items-center justify-center text-yellow-500">
            <TbClock size={24} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading text-[#1a1a1a]">{stats.inProgress}</p>
            <p className="text-xs font-bold text-[#5a5a5a] uppercase tracking-wider">In Progress</p>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="neo-card p-4 border-l-4 border-l-green-500 flex items-center gap-3 transition-transform">
          <div className="w-12 h-12 rounded-full bg-green-100 border-2 border-[#1a1a1a] flex items-center justify-center text-green-500">
            <TbCheck size={24} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading text-[#1a1a1a]">{stats.resolved}</p>
            <p className="text-xs font-bold text-[#5a5a5a] uppercase tracking-wider">Resolved</p>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="neo-card p-4 border-l-4 border-l-red-500 flex items-center gap-3 transition-transform">
          <div className="w-12 h-12 rounded-full bg-red-100 border-2 border-[#1a1a1a] flex items-center justify-center text-red-500">
            <TbX size={24} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading text-[#1a1a1a]">{stats.rejected}</p>
            <p className="text-xs font-bold text-[#5a5a5a] uppercase tracking-wider">Rejected</p>
          </div>
        </motion.div>
      </div>

      <motion.div whileHover={{ y: -2 }} className="neo-card p-4 border-l-4 border-l-[#4b607f] flex items-center justify-center gap-3 transition-transform">
         <div className="w-12 h-12 rounded-full bg-[#e8d8c9] border-2 border-[#1a1a1a] flex items-center justify-center text-[#4b607f]">
            <TbTicket size={24} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold font-heading text-[#1a1a1a]">{stats.total}</p>
            <p className="text-sm font-bold text-[#5a5a5a] uppercase tracking-wider">Total Ticket</p>
          </div>
      </motion.div>

      <div className="neo-border-sm rounded-xl p-3 bg-white flex flex-wrap gap-2">
        {(["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleChangeStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              selectedStatus === s ? "bg-[#4b607f] text-white neo-border-sm neo-shadow" : "bg-[#f5ede6] text-[#1a1a1a] neo-border-sm hover:bg-[#e8d8c9] hover:-translate-y-0.5"
            }`}
          >
            {s === "ALL" ? "Semua Ticket" : statusConfig[s].label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="neo-card p-12 text-center flex flex-col items-center justify-center gap-4">
             <div className="w-8 h-8 border-4 border-[#4b607f] border-t-transparent rounded-full animate-spin"></div>
             <p className="font-bold text-[#5a5a5a]">Memuat data ticket...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="neo-card p-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 bg-[#f5ede6] rounded-full border-2 border-[#1a1a1a] flex items-center justify-center text-[#5a5a5a]">
              <TbInbox size={32} strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-heading font-bold text-xl text-[#1a1a1a]">Belum ada ticket</p>
              <p className="text-[#5a5a5a] text-sm mt-1">Ticket yang dilaporkan akan muncul di sini</p>
            </div>
          </div>
        ) : (
          tickets.map((ticket, i) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="neo-border-sm rounded-lg p-4 bg-white hover:shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200 cursor-pointer flex flex-col gap-3"
            >
              <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] border-2 border-[#1a1a1a] flex items-center justify-center text-2xl shadow-[2px_2px_0px_#1a1a1a]">
                    {categoryIcon(ticket.category)}
                  </div>
                  <div>
                    <p className="font-bold text-base text-[#1a1a1a] font-heading">{ticket.title}</p>
                    <p className="text-xs font-medium text-[#5a5a5a] mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="bg-[#f5ede6] px-2 py-0.5 rounded border border-[#1a1a1a]">{ticket.lab?.name || "Lab"}</span>
                      {ticket.pc?.pcCode && <span className="bg-[#f5ede6] px-2 py-0.5 rounded border border-[#1a1a1a]">{ticket.pc.pcCode}</span>}
                      <span>•</span>
                      <span>oleh <span className="font-bold text-[#1a1a1a]">{ticket.reporter?.name || "-"}</span></span>
                      <span>•</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${priorityConfig[ticket.priority]?.color || "bg-gray-200 text-gray-700"}`}>
                    {priorityConfig[ticket.priority]?.label || ticket.priority}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${statusConfig[ticket.status]?.color || "bg-gray-300 text-black"}`}>
                    {statusConfig[ticket.status]?.label || ticket.status}
                  </span>
                </div>
              </div>
              {ticket.assignee && (
                <div className="ml-16 bg-[#f5ede6] border-2 border-[#1a1a1a] rounded-lg px-3 py-2 inline-block">
                  <p className="text-xs font-bold text-[#1a1a1a] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 border border-[#1a1a1a]"></span>
                    Ditangani oleh: {ticket.assignee.name}
                  </p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between neo-card p-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePrev}
          disabled={page <= 1}
          className="px-4 py-2 bg-white font-bold flex items-center gap-2 neo-btn disabled:opacity-50 disabled:hover:scale-100"
        >
          <TbChevronLeft strokeWidth={2.5} />
          Sebelumnya
        </motion.button>
        <p className="text-sm font-bold text-[#1a1a1a] bg-[#e8d8c9] px-4 py-2 rounded-lg border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
          Halaman {pagination.page} / {pagination.totalPages}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          disabled={page >= pagination.totalPages}
          className="px-4 py-2 bg-white font-bold flex items-center gap-2 neo-btn disabled:opacity-50 disabled:hover:scale-100"
        >
          Selanjutnya
          <TbChevronRight strokeWidth={2.5} />
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl border-2 border-[#1a1a1a] shadow-[6px_6px_0px_#1a1a1a] p-4 sm:p-8 w-full max-w-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[#1a1a1a]">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] flex items-center gap-3 truncate">
                  <div className="w-10 h-10 rounded-full bg-[#f3701e] text-white flex items-center justify-center border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex-shrink-0">
                    <TbPlus size={20} strokeWidth={2.5} />
                  </div>
                  Buat Ticket Baru
                </h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX size={24} strokeWidth={2.5} />
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCreateTicket}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Judul</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Deskripsi singkat kerusakan"
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lab ID</label>
                    <input
                      type="text"
                      required
                      value={form.labId}
                      onChange={(e) => setForm((prev) => ({ ...prev, labId: e.target.value }))}
                      placeholder="Masukkan Lab ID"
                      className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kategori</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">PC (Opsional)</label>
                    <input
                      type="text"
                      value={form.pcId}
                      onChange={(e) => setForm((prev) => ({ ...prev, pcId: e.target.value }))}
                      placeholder="Masukkan PC ID"
                      className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Prioritas</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as TicketPriority }))}
                      className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Deskripsi</label>
                  <textarea
                    rows={3}
                    required
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Detail kerusakan..."
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm resize-none"
                  />
                </div>
                <div>
                  <PhotoUpload
                    value={form.photo ?? []}
                    onChange={(urls) => setForm((prev) => ({ ...prev, photo: urls }))}
                    category="tickets"
                    label="Foto Kerusakan"
                    maxFiles={3}
                  />
                </div>
                <div className="flex gap-4 pt-4 border-t-2 border-[#1a1a1a] mt-6">
                  <motion.button type="submit" disabled={submitting} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 py-3 bg-[#4b607f] text-white neo-btn disabled:opacity-50 font-bold text-lg flex items-center justify-center gap-2">
                    <TbCheck size={20} strokeWidth={2.5} />
                    {submitting ? "Mengirim..." : "Kirim Ticket"}
                  </motion.button>
                  <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-[#f5ede6] text-[#1a1a1a] neo-btn font-bold text-lg flex items-center justify-center gap-2">
                    <TbX size={20} strokeWidth={2.5} />
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
