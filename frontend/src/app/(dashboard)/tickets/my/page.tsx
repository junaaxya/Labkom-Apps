"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TbClipboardList,
  TbFilter,
  TbClock,
  TbMapPin,
  TbUser,
  TbPhoto,
  TbX,
  TbInfoCircle,
} from "react-icons/tb";
import api from "@/services/api";
import type { Ticket, TicketStatus } from "@/types";
import { useToast } from "@/providers/toast-provider";

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

type StatusFilter = "ALL" | TicketStatus;

const statusConfig: Record<TicketStatus, { label: string; classes: string }> = {
  OPEN: { label: "Open", classes: "bg-[#f3701e] text-white" },
  IN_PROGRESS: { label: "In Progress", classes: "bg-[#4b607f] text-white" },
  WAITING: { label: "Waiting", classes: "bg-yellow-400 text-[#1a1a1a]" },
  RESOLVED: { label: "Resolved", classes: "bg-green-500 text-white" },
  REJECTED: { label: "Rejected", classes: "bg-red-500 text-white" },
};

const categoryLabel: Record<string, string> = {
  MOUSE: "Mouse",
  KEYBOARD: "Keyboard",
  MONITOR: "Monitor",
  CPU: "CPU",
  JARINGAN: "Jaringan",
  SOFTWARE: "Software",
  KURSI_MEJA: "Kursi/Meja",
  AC_LISTRIK: "AC/Listrik",
  PROYEKTOR: "Proyektor",
  LAINNYA: "Lainnya",
};

export default function MyTicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const fetchMyTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Ticket[] }>("/tickets/my");
      setTickets(res.data ?? []);
    } catch (err) {
      toast.error(errMsg(err, "Gagal memuat riwayat tiket."));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMyTickets();
    });
  }, []);

  const filteredTickets = useMemo(() => {
    if (filter === "ALL") return tickets;
    return tickets.filter((item) => item.status === filter);
  }, [tickets, filter]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="neo-card p-6 bg-white">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#4b607f] text-white neo-border-sm flex items-center justify-center">
            <TbClipboardList size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Riwayat Laporan Saya</h1>
            <p className="text-sm text-[#5a5a5a] mt-1">Pantau status semua laporan kerusakan yang pernah Anda kirim.</p>
          </div>
        </div>
      </div>

      <div className="neo-card p-4 bg-white">
        <div className="flex items-center gap-2 mb-3 text-[#1a1a1a] font-semibold text-sm">
          <TbFilter size={18} strokeWidth={2.2} />
          Filter Status
        </div>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "REJECTED"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg neo-border-sm text-sm font-semibold ${
                filter === status ? "bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"
              }`}
            >
              {status === "ALL" ? "Semua" : statusConfig[status].label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="neo-card p-8 text-center bg-white text-[#5a5a5a]">Memuat laporan...</div>}

      {!loading && filteredTickets.length === 0 && (
        <div className="neo-card p-8 text-center bg-white text-[#5a5a5a]">
          Belum ada laporan untuk filter ini.
        </div>
      )}

      {!loading && filteredTickets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelectedTicket(ticket)}
              className="neo-card p-4 bg-white text-left neo-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg text-[#1a1a1a]">{ticket.title}</h3>
                  <p className="text-xs text-[#5a5a5a] mt-1 flex items-center gap-1">
                    <TbMapPin size={14} strokeWidth={2.2} />
                    {ticket.lab?.name ?? "Lab tidak diketahui"}
                  </p>
                  <p className="text-xs text-[#5a5a5a] mt-1 flex items-center gap-1">
                    <TbClock size={14} strokeWidth={2.2} />
                    {new Date(ticket.createdAt).toLocaleString("id-ID")}
                  </p>
                </div>
                <span className={`neo-badge px-2 py-1 text-xs font-semibold ${statusConfig[ticket.status].classes}`}>
                  {statusConfig[ticket.status].label}
                </span>
              </div>
              <div className="mt-3">
                <span className="neo-badge px-2 py-1 text-xs bg-[#e8d8c9] text-[#1a1a1a]">
                  {categoryLabel[ticket.category] ?? ticket.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTicket(null)}>
          <div className="neo-card w-full max-w-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-heading text-2xl text-[#1a1a1a]">{selectedTicket.title}</h2>
                <p className="text-sm text-[#5a5a5a] mt-1">ID: {selectedTicket.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="w-9 h-9 rounded-lg neo-border-sm flex items-center justify-center bg-white"
              >
                <TbX size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="neo-border-sm rounded-lg p-3 bg-[#fcf8f4]">
                <p className="text-xs text-[#5a5a5a]">Status</p>
                <span className={`neo-badge mt-1 px-2 py-1 text-xs ${statusConfig[selectedTicket.status].classes}`}>
                  {statusConfig[selectedTicket.status].label}
                </span>
              </div>
              <div className="neo-border-sm rounded-lg p-3 bg-[#fcf8f4]">
                <p className="text-xs text-[#5a5a5a]">Kategori</p>
                <p className="text-sm font-semibold text-[#1a1a1a] mt-1">
                  {categoryLabel[selectedTicket.category] ?? selectedTicket.category}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-[#1a1a1a]">
              <div>
                <p className="text-xs text-[#5a5a5a] mb-1">Deskripsi</p>
                <p className="neo-border-sm rounded-lg p-3 bg-white">{selectedTicket.description || "-"}</p>
              </div>

              <div>
                <p className="text-xs text-[#5a5a5a] mb-1 flex items-center gap-1">
                  <TbPhoto size={14} strokeWidth={2.2} />
                  Foto
                </p>
                {selectedTicket.photo?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedTicket.photo.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="neo-border-sm rounded-lg p-2 text-xs text-[#4b607f] hover:underline bg-[#fcf8f4] break-all"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="neo-border-sm rounded-lg p-3 bg-white text-[#5a5a5a]">Tidak ada foto.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="neo-border-sm rounded-lg p-3 bg-[#fcf8f4]">
                  <p className="text-xs text-[#5a5a5a] flex items-center gap-1">
                    <TbUser size={14} strokeWidth={2.2} />
                    Ditangani oleh
                  </p>
                  <p className="font-semibold mt-1">{selectedTicket.assignee?.name ?? "Belum ditugaskan"}</p>
                </div>
                <div className="neo-border-sm rounded-lg p-3 bg-[#fcf8f4]">
                  <p className="text-xs text-[#5a5a5a] flex items-center gap-1">
                    <TbInfoCircle size={14} strokeWidth={2.2} />
                    Resolusi
                  </p>
                  <p className="mt-1">{selectedTicket.resolvedAt ? `Selesai: ${new Date(selectedTicket.resolvedAt).toLocaleString("id-ID")}` : "Belum ada resolusi"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
