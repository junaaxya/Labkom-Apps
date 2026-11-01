"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TbArrowRight, TbChevronLeft, TbChevronRight, TbPlus, TbTicket } from "react-icons/tb";
import api from "@/services/api";
import type { Ticket, TicketStatus } from "@/types";
import { useCurrentRole, useCurrentUser } from "@/providers/current-user-context";
import { ticketCategoryLabel, ticketStatusClass, ticketStatusLabel, ticketStatuses } from "./ticket-ui";

type ListResponse = { data: { items: Ticket[]; pagination?: { page?: number; totalPages?: number; total?: number } } };

export default function TicketsPage() {
  const role = useCurrentRole();
  const user = useCurrentUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
  const [scope, setScope] = useState<"ALL" | "MINE" | "INCOMING">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, nextStatus: TicketStatus | "ALL", nextScope: "ALL" | "MINE" | "INCOMING" = scope) => {
    setLoading(true); setError(null);
    try {
      const query = new URLSearchParams({ page: String(nextPage), limit: "10" });
      if (nextStatus !== "ALL") query.set("status", nextStatus);
      if (role === "ASISTEN_LAB" && nextScope === "MINE" && user?.id) query.set("assignedTo", user.id);
      if (role === "ASISTEN_LAB" && nextScope === "INCOMING") if (nextStatus === "ALL") query.set("status", "OPEN");
      const response = await api.get<ListResponse>(`/tickets?${query}`);
      setTickets(response.data?.items ?? []);
      setPage(response.data?.pagination?.page ?? nextPage);
      setTotalPages(response.data?.pagination?.totalPages ?? 1);
    } catch (err) { setTickets([]); setError(err instanceof Error ? err.message : "Gagal memuat ticket."); }
    finally { setLoading(false); }
  }, [role, scope, user]);

  useEffect(() => { queueMicrotask(() => { if (role !== "MAHASISWA") void load(1, "ALL"); }); }, [load, role]);
  if (role === "MAHASISWA") return <div className="space-y-4"><header className="neo-card bg-white p-5"><h1 className="font-heading text-2xl">Ticketing</h1><p className="mt-1 text-sm text-[#5a5a5a]">Gunakan riwayat laporan untuk melihat ticket milik Anda.</p><Link href="/tickets/my" className="neo-btn mt-4 inline-flex min-h-[44px] items-center gap-2 bg-[#4b607f] px-5 text-white">Riwayat Saya <TbArrowRight /></Link></header><Link href="/tickets/new" className="neo-btn inline-flex min-h-[44px] items-center gap-2 bg-[#f3701e] px-5 text-white"><TbPlus /> Buat Ticket</Link></div>;

  return <main className="space-y-4"><header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-heading text-2xl sm:text-3xl">Ticketing Kerusakan</h1><p className="text-sm text-[#5a5a5a]">Pantau laporan, penugasan, dan penyelesaian.</p></div><Link href="/tickets/new" className="neo-btn inline-flex min-h-[44px] items-center justify-center gap-2 bg-[#f3701e] px-5 text-white"><TbPlus /> Buat Ticket</Link></header><section className="neo-card bg-white p-4 space-y-3">{role === "ASISTEN_LAB" && <div className="flex flex-wrap gap-2">{([["ALL", "Semua ticket"], ["INCOMING", "Masuk (Open)"], ["MINE", "Tugas Saya"]] as const).map(([key, label]) => <button key={key} onClick={() => { setScope(key); void load(1, status, key); }} className={`min-h-[44px] rounded-lg border-2 border-[#1a1a1a] px-3 text-sm font-bold ${scope === key ? "bg-[#f3701e] text-white" : "bg-white"}`}>{label}</button>)}</div>}<div className="flex flex-wrap gap-2">{["ALL", ...ticketStatuses].map((item) => <button key={item} onClick={() => { setStatus(item as TicketStatus | "ALL"); void load(1, item as TicketStatus | "ALL"); }} className={`min-h-[44px] rounded-lg border-2 border-[#1a1a1a] px-3 text-sm font-bold ${status === item ? "bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"}`}>{item === "ALL" ? "Semua status" : ticketStatusLabel[item as TicketStatus]}</button>)}</div></section>{loading ? <div className="neo-card bg-white p-8 text-center">Memuat ticket...</div> : error ? <div className="neo-card bg-white p-6"><p className="font-bold text-red-600">{error}</p><button onClick={() => void load(page, status, scope)} className="neo-btn mt-3 min-h-[44px] bg-[#f3701e] px-4 text-white">Coba lagi</button></div> : tickets.length === 0 ? <div className="neo-card bg-white p-8 text-center text-[#5a5a5a]"><TbTicket className="mx-auto mb-2 text-3xl" />Belum ada ticket untuk filter ini.</div> : <div className="grid gap-3 md:grid-cols-2">{tickets.map((ticket) => <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="neo-card min-h-[120px] bg-white p-4 text-left transition-transform hover:-translate-y-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-[#5a5a5a]">{ticketCategoryLabel[ticket.category] ?? ticket.category}</p><h2 className="mt-1 break-words font-heading text-lg">{ticket.title}</h2></div><span className={`neo-badge shrink-0 px-2 py-1 text-xs font-bold ${ticketStatusClass[ticket.status]}`}>{ticketStatusLabel[ticket.status]}</span></div><p className="mt-3 text-sm text-[#5a5a5a]">{ticket.lab?.name ?? "Lab tidak diketahui"} · {ticket.reporter?.name ?? "Pelapor tidak diketahui"}</p></Link>)}</div>} {!loading && <nav className="flex items-center justify-between"><button disabled={page <= 1} onClick={() => void load(page - 1, status)} className="neo-btn min-h-[44px] px-4 disabled:opacity-40"><TbChevronLeft /> Sebelumnya</button><span className="text-sm font-bold">Halaman {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => void load(page + 1, status)} className="neo-btn min-h-[44px] px-4 disabled:opacity-40">Berikutnya <TbChevronRight /></button></nav>}</main>;
}
