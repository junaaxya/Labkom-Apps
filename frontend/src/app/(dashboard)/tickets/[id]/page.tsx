"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TbArrowLeft, TbCheck, TbSend, TbUserPlus, TbX } from "react-icons/tb";
import api from "@/services/api";
import type { Ticket, TicketEvent, User } from "@/types";
import { useCurrentRole, useCurrentUser } from "@/providers/current-user-context";
import { isConflict, ticketCategoryLabel, ticketStatusClass, ticketStatusLabel } from "../ticket-ui";

type DetailResponse = { data: Ticket };
type HistoryResponse = { data: TicketEvent[] };
type StaffResponse = { data: { users: User[] } };

function message(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const role = useCurrentRole();
  const user = useCurrentUser();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [reason, setReason] = useState("");
  const [waitingReason, setWaitingReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setConflict(false);
    try {
      const detail = await api.get<DetailResponse>(`/tickets/${params.id}`);
      const current = detail.data;
      setTicket(current);
      setSelectedAssignee(current.assignedTo ?? current.assignee?.id ?? "");
      if (Array.isArray(current.events)) setEvents(current.events);
      else {
        try { const history = await api.get<HistoryResponse>(`/tickets/${params.id}/history`); setEvents(history.data ?? []); }
        catch { setEvents([]); }
      }
      if (role === "KOORDINATOR_LAB") {
        try { const users = await api.get<StaffResponse>("/users?role=ASISTEN_LAB&isActive=true&limit=100"); setStaff(users.data?.users ?? []); }
        catch { setStaff([]); }
      }
    } catch (err) { setError(message(err, "Ticket tidak dapat dimuat.")); }
    finally { setLoading(false); }
  }, [params.id, role]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const act = async (request: () => Promise<unknown>) => {
    setWorking(true); setError(null); setConflict(false);
    try { await request(); await load(); }
    catch (err) { setConflict(isConflict(err)); setError(message(err, "Aksi ticket gagal.")); }
    finally { setWorking(false); }
  };

  const submitNote = (event: FormEvent) => { event.preventDefault(); if (!note.trim()) return; void act(() => api.post(`/tickets/${params.id}/actions`, { note: note.trim() }).then(() => setNote(""))); };
  const submitResolution = (event: FormEvent) => { event.preventDefault(); if (!resolution.trim()) return; void act(() => api.patch(`/tickets/${params.id}/resolve`, { resolution: resolution.trim() }).then(() => setResolution(""))); };
  const submitReject = (event: FormEvent) => { event.preventDefault(); if (!reason.trim()) return; void act(() => api.patch(`/tickets/${params.id}/reject`, { reason: reason.trim() }).then(() => setReason(""))); };

  if (loading) return <div className="neo-card p-8 text-center text-[#5a5a5a]">Memuat detail ticket...</div>;
  if (error && !ticket) return <div className="neo-card p-6 space-y-3"><p className="font-bold text-red-600">{error}</p><button onClick={() => void load()} className="neo-btn min-h-[44px] px-5 bg-[#f3701e] text-white">Coba Lagi</button></div>;
  if (!ticket) return <div className="neo-card p-8 text-center">Ticket tidak ditemukan.</div>;

  const canOperate = role === "ASISTEN_LAB" || role === "KOORDINATOR_LAB";
  const isOwner = user?.id === ticket.reportedBy;
  const canView = role !== "MAHASISWA" || isOwner;
  if (!canView) return <div className="neo-card p-6"><p className="font-bold text-red-600">Anda tidak memiliki akses ke ticket ini.</p></div>;
  const canClaim = role === "ASISTEN_LAB" && ticket.status === "OPEN" && !ticket.assignedTo;
  const canResume = role === "ASISTEN_LAB" && ticket.status === "WAITING" && ticket.assignedTo === user?.id;
  const canWait = role === "ASISTEN_LAB" && ticket.status === "IN_PROGRESS" && ticket.assignedTo === user?.id;
  const canResolve = canOperate && ticket.status === "IN_PROGRESS" && (role === "KOORDINATOR_LAB" || ticket.assignedTo === user?.id);

  return <main className="space-y-4 max-w-5xl">
    <Link href={role === "MAHASISWA" ? "/tickets/my" : "/tickets"} className="inline-flex min-h-[44px] items-center gap-2 font-bold text-[#4b607f]"><TbArrowLeft /> Kembali ke ticket</Link>
    <section className="neo-card bg-white p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">{ticketCategoryLabel[ticket.category] ?? ticket.category} · {ticket.id}</p><h1 className="font-heading text-2xl sm:text-3xl break-words">{ticket.title}</h1></div>
        <span className={`neo-badge self-start px-3 py-2 text-xs font-bold ${ticketStatusClass[ticket.status]}`}>{ticketStatusLabel[ticket.status]}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5a5a5a]">{ticket.description || "Tidak ada deskripsi."}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"><Info label="Pelapor" value={ticket.reporter?.name ?? "Tidak diketahui"} /><Info label="Lab" value={ticket.lab?.name ?? "Tidak diketahui"} /><Info label="PC" value={ticket.pc?.pcCode ?? "Tidak spesifik"} /></div>
      {(ticket.resolutionNotes || ticket.resolution || ticket.rejectionReason) && <div className="neo-border-sm bg-[#f5ede6] p-3"><p className="text-xs font-bold uppercase">{ticket.resolutionNotes || ticket.resolution ? "Hasil perbaikan" : "Alasan penolakan"}</p><p className="mt-1 whitespace-pre-wrap">{ticket.resolutionNotes ?? ticket.resolution ?? ticket.rejectionReason}</p></div>}
      {ticket.status === "WAITING" && ticket.waitingReason && <div className="neo-border-sm bg-yellow-50 p-3"><p className="text-xs font-bold uppercase">Alasan menunggu</p><p className="mt-1 whitespace-pre-wrap">{ticket.waitingReason}</p></div>}
    </section>

    {error && <div className="neo-border-sm bg-red-50 p-3 text-sm text-red-700" role="alert"><p>{conflict ? "Ticket berubah di perangkat lain. Muat ulang sebelum mencoba lagi." : error}</p>{conflict && <button onClick={() => void load()} className="mt-2 min-h-[44px] font-bold underline">Muat ulang</button>}</div>}

    {role === "KOORDINATOR_LAB" && ticket.status !== "RESOLVED" && ticket.status !== "REJECTED" && <section className="neo-card bg-white p-4 space-y-3"><h2 className="font-heading text-xl">Penugasan</h2><div className="flex flex-col gap-2 sm:flex-row"><select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="neo-input min-h-[44px] flex-1 bg-white px-3"><option value="">Belum ditugaskan</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button disabled={working || !selectedAssignee} onClick={() => void act(() => api.patch(`/tickets/${params.id}/assign`, { assignedTo: selectedAssignee }))} className="neo-btn min-h-[44px] px-5 bg-[#4b607f] text-white disabled:opacity-50"><TbUserPlus /> Assign</button></div></section>}

    {canOperate && <section className="neo-card bg-white p-4 space-y-3"><h2 className="font-heading text-xl">Aksi operasional</h2><div className="flex flex-wrap gap-2">{canClaim && <ActionButton disabled={working} onClick={() => void act(() => api.patch(`/tickets/${params.id}/claim`, {}))}>Ambil Ticket</ActionButton>}{canResume && <ActionButton disabled={working} onClick={() => void act(() => api.patch(`/tickets/${params.id}/status`, { status: "IN_PROGRESS" }))}>Lanjutkan</ActionButton>}</div>{canWait && <div className="space-y-2"><label className="text-sm font-bold">Alasan menunggu</label><textarea required value={waitingReason} onChange={(event) => setWaitingReason(event.target.value)} className="neo-input min-h-[88px] w-full bg-white p-3" placeholder="Contoh: menunggu spare part atau akses ruangan." /><button type="button" disabled={working || !waitingReason.trim()} onClick={() => void act(() => api.patch(`/tickets/${params.id}/status`, { status: "WAITING", waitingReason: waitingReason.trim() }).then(() => setWaitingReason("")))} className="neo-btn min-h-[44px] px-4 bg-yellow-400 text-[#1a1a1a] disabled:opacity-50">Tandai Menunggu</button></div>}{canResolve && <form onSubmit={submitResolution} className="space-y-2"><label className="text-sm font-bold">Hasil perbaikan</label><textarea required value={resolution} onChange={(e) => setResolution(e.target.value)} className="neo-input min-h-[100px] w-full bg-white p-3" placeholder="Jelaskan tindakan dan hasil perbaikan." /><button disabled={working} className="neo-btn min-h-[44px] px-5 bg-green-600 text-white disabled:opacity-50"><TbCheck /> Selesaikan</button></form>}{role === "KOORDINATOR_LAB" && ticket.status === "OPEN" && <form onSubmit={submitReject} className="space-y-2 border-t-2 border-[#e8d8c9] pt-3"><label className="text-sm font-bold">Tolak ticket</label><textarea required value={reason} onChange={(e) => setReason(e.target.value)} className="neo-input min-h-[80px] w-full bg-white p-3" placeholder="Alasan penolakan." /><button disabled={working} className="neo-btn min-h-[44px] px-5 bg-red-600 text-white disabled:opacity-50"><TbX /> Tolak</button></form>}</section>}

    {canOperate && ticket.status !== "RESOLVED" && ticket.status !== "REJECTED" && <form onSubmit={submitNote} className="neo-card bg-white p-4 space-y-2"><label className="font-heading text-xl">Catatan tindakan</label><textarea required value={note} onChange={(e) => setNote(e.target.value)} className="neo-input min-h-[90px] w-full bg-white p-3" placeholder="Catat pemeriksaan atau komunikasi dengan pelapor." /><button disabled={working} className="neo-btn min-h-[44px] px-5 bg-[#f3701e] text-white disabled:opacity-50"><TbSend /> Tambah catatan</button></form>}

    <section className="neo-card bg-white p-4 sm:p-6"><h2 className="font-heading text-xl mb-4">Timeline</h2>{events.length === 0 ? <p className="text-sm text-[#5a5a5a]">Belum ada riwayat aktivitas. Ticket lama tetap dapat dipantau dari status saat ini.</p> : <ol className="space-y-4">{events.map((event) => <li key={event.id} className="relative border-l-2 border-[#e8d8c9] pl-4"><div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-[#1a1a1a] bg-[#f3701e]" /><p className="text-sm font-bold">{event.actor?.name ?? "Sistem"}</p><p className="text-xs text-[#5a5a5a]">{new Date(event.createdAt).toLocaleString("id-ID")}</p><p className="mt-1 text-sm">{event.note ?? event.reason ?? (event.toStatus ? `Status: ${ticketStatusLabel[event.toStatus]}` : event.eventType ?? event.type ?? "Aktivitas ticket")}</p></li>)}</ol>}</section>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="neo-border-sm bg-[#f5ede6] p-3"><p className="text-xs text-[#5a5a5a]">{label}</p><p className="mt-1 font-bold break-words">{value}</p></div>; }
function ActionButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} className="neo-btn min-h-[44px] px-4 bg-[#4b607f] text-white disabled:opacity-50">{children}</button>; }
