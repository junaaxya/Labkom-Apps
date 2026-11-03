"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  TbAlertTriangle,
  TbArrowLeft,
  TbBuildingWarehouse,
  TbCpu,
  TbDeviceDesktop,
  TbLoader2,
  TbNetwork,
  TbPlus,
  TbTicket,
  TbMessageCircle,
  TbSend,
  TbTools,
  TbX,
} from "react-icons/tb";
import { useToast } from "@/providers/toast-provider";
import api, { ApiError } from "@/services/api";
import type { PCStatus, TicketCategory } from "@/types";
import { ticketCategoryLabel, ticketStatusLabel } from "../../../tickets/ticket-ui";

type UserContext = {
  role?: string;
};

type TicketItem = {
  id?: string;
  title?: string;
  category?: TicketCategory;
  status: string;
  createdAt?: string;
};

type PcScanData = {
  id: string;
  pcCode: string;
  assetCode?: string;
  name: string;
  status: PCStatus;
  ipAddress?: string;
  lab?: {
    id: string;
    name?: string;
    location?: string;
  };
  tickets?: TicketItem[];
};

type PcScanResponse = {
  data?: PcScanData;
  message?: string;
};

type DuplicateTicketData = {
  existingTicket?: { id?: string; link?: string; status?: string; createdAt?: string };
};

const statusMap: Record<PCStatus, { label: string; classes: string }> = {
  AVAILABLE: { label: "Tersedia", classes: "bg-green-500 text-white" },
  IN_USE: { label: "Digunakan", classes: "bg-[#4b607f] text-white" },
  BROKEN: { label: "Rusak", classes: "bg-red-500 text-white" },
  MAINTENANCE: { label: "Maintenance", classes: "bg-yellow-400 text-[#1a1a1a]" },
  INACTIVE: { label: "Tidak Aktif", classes: "bg-gray-400 text-white" },
};

const categories: TicketCategory[] = [
  "MOUSE",
  "KEYBOARD",
  "MONITOR",
  "CPU",
  "JARINGAN",
  "SOFTWARE",
  "KURSI_MEJA",
  "AC_LISTRIK",
  "PROYEKTOR",
  "LAINNYA",
];

const statuses: PCStatus[] = ["AVAILABLE", "IN_USE", "BROKEN", "MAINTENANCE", "INACTIVE"];

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

export default function ScanPcActionPage({ params }: { params: Promise<{ code: string }> }) {
  const toast = useToast();
  const { code } = use(params);

  const [user, setUser] = useState<UserContext>({});
  const [pcData, setPcData] = useState<PcScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [duplicateTicket, setDuplicateTicket] = useState<DuplicateTicketData["existingTicket"] | null>(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportBody, setSupportBody] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [notFoundMessage, setNotFoundMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  const [ticketForm, setTicketForm] = useState({
    title: "",
    category: "MOUSE" as TicketCategory,
    description: "",
  });

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const parsed = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(parsed);
    });
  }, []);

  const fetchPcData = useCallback(async () => {
    setLoading(true);
    setNotFoundMessage("");
    try {
      const res = await api.get<PcScanResponse>(`/qr/scan/pc/${code}`);
      if (!res?.data) {
        setPcData(null);
        setNotFoundMessage("PC tidak ditemukan.");
        return;
      }
      setPcData(res.data);
    } catch (err) {
      setPcData(null);
      setNotFoundMessage(errMsg(err, "PC tidak ditemukan."));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    queueMicrotask(() => void fetchPcData());
  }, [fetchPcData]);

  useEffect(() => {
    if (!showModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.history.pushState({ qrTicketModal: true }, "");
    const closeOnBack = () => setShowModal(false);
    window.addEventListener("popstate", closeOnBack);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("popstate", closeOnBack);
    };
  }, [showModal]);

  useEffect(() => {
    if (!showSupportModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeSupportModal = () => setShowSupportModal(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSupportModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    window.history.pushState({ supportChatModal: true }, "");
    window.addEventListener("popstate", closeSupportModal);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("popstate", closeSupportModal);
    };
  }, [showSupportModal]);

  const isCoordinatorOrAssistant = useMemo(() => {
    const role = (user.role || "").toUpperCase();
    return role.includes("KOORDINATOR") || role.includes("ASISTEN");
  }, [user.role]);

  const activeTickets = useMemo(
    () => (pcData?.tickets || []).filter((ticket) => !["RESOLVED", "REJECTED", "CLOSED"].includes(ticket.status)),
    [pcData?.tickets]
  );

  const submitTicket = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pcData?.assetCode) {
      toast.error("Kode aset PC tidak ditemukan.");
      return;
    }

    setSubmittingTicket(true);
    setDuplicateTicket(null);
    try {
      await api.post(`/tickets/qr/${encodeURIComponent(pcData.assetCode)}`, {
        title: ticketForm.title.trim(),
        category: ticketForm.category,
        description: ticketForm.description.trim(),
      });

      setTicketForm({
        title: "",
        category: "MOUSE",
        description: "",
      });
      setShowModal(false);
      toast.success("Laporan kerusakan berhasil dikirim.");
      await fetchPcData();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const duplicate = (err.data as DuplicateTicketData | undefined)?.existingTicket;
        setDuplicateTicket(duplicate ?? null);
      }
      toast.error(errMsg(err, "Gagal mengirim laporan kerusakan."));
    } finally {
      setSubmittingTicket(false);
    }
  };

  const submitSupportChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = supportBody.trim();
    if (!pcData || !body || submittingSupport) return;
    setSubmittingSupport(true);
    setSupportError("");
    try {
      const response = await api.post<{ data: { id: string } }>("/support-chats", { pcId: pcData.id, body });
      setSupportBody("");
      setShowSupportModal(false);
      window.location.assign(`/support-chats/${response.data.id}`);
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
      setSupportError(errMsg(error, status === 409 ? "Tidak ada Asisten Lab yang sedang bertugas untuk lab ini." : "Chat belum dapat dibuat."));
    } finally {
      setSubmittingSupport(false);
    }
  };

  const updatePcStatus = async (newStatus: PCStatus) => {
    if (!pcData || !pcData.id || newStatus === pcData.status) return;

    setUpdatingStatus(true);
    try {
      await api.put(`/labs/pcs/${pcData.id}`, { status: newStatus });
      toast.success(`Status PC diubah menjadi ${statusMap[newStatus].label}.`);
      await fetchPcData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengubah status PC."));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="neo-card bg-white p-4 animate-pulse h-14" />
        <div className="neo-card bg-white p-6 animate-pulse h-52" />
        <div className="neo-card bg-white p-6 animate-pulse h-52" />
      </div>
    );
  }

  if (!pcData) {
    return (
      <div className="space-y-4">
        <Link href="/scan" className="neo-btn inline-flex items-center gap-2 px-4 py-2 bg-white text-[#1a1a1a]">
          <TbArrowLeft size={18} strokeWidth={2.2} />
          Kembali ke Scan
        </Link>

        <div className="neo-card bg-white p-6 text-center space-y-3">
          <p className="text-xl font-bold text-[#1a1a1a]">PC tidak ditemukan</p>
          <p className="text-sm text-[#5a5a5a]">{notFoundMessage || "Kode PC tidak valid atau data tidak tersedia."}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        <Link href="/scan" className="neo-btn inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] transition-colors duration-200">
          <TbArrowLeft size={18} strokeWidth={2.2} />
          <span className="font-medium">Kembali ke Scan</span>
        </Link>

        <div className="neo-card bg-white p-6 sm:p-8 space-y-6 hover:shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200">
          <div className="flex items-start justify-between gap-4 flex-wrap border-b-2 border-[#1a1a1a] pb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[#1a1a1a] inline-flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#4b607f] text-white flex items-center justify-center neo-border-sm">
                  <TbDeviceDesktop size={28} strokeWidth={2.2} />
                </div>
                {pcData.name}
              </h1>
              <p className="text-sm sm:text-base text-[#4b607f] font-medium mt-3 ml-[60px]">
                {pcData.pcCode} {pcData.assetCode ? `• ${pcData.assetCode}` : ""}
              </p>
            </div>
            <span className={`neo-badge px-4 py-2 text-sm font-bold shadow-[2px_2px_0px_#1a1a1a] ${statusMap[pcData.status].classes}`}>{statusMap[pcData.status].label}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="neo-card bg-[#fcf8f4] p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white neo-border-sm flex items-center justify-center text-[#f3701e]">
                <TbBuildingWarehouse size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider mb-0.5">Lokasi</p>
                <p className="text-sm font-medium text-[#1a1a1a]">
                  {pcData.lab?.name || "Lab tidak diketahui"}
                  {pcData.lab?.location ? ` • ${pcData.lab.location}` : ""}
                </p>
              </div>
            </div>

            {pcData.ipAddress && (
              <div className="neo-card bg-[#fcf8f4] p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white neo-border-sm flex items-center justify-center text-[#4b607f]">
                  <TbNetwork size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider mb-0.5">IP Address</p>
                  <p className="text-sm font-medium text-[#1a1a1a]">{pcData.ipAddress}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            {user.role === "MAHASISWA" && <button
              type="button"
              onClick={() => { setSupportError(""); setShowModal(false); setShowSupportModal(true); }}
              className="neo-btn min-h-[44px] px-6 py-3 bg-[#4b607f] text-white inline-flex items-center gap-2 hover:bg-[#3a4a63] transition-colors duration-200"
            >
              <TbMessageCircle size={20} strokeWidth={2.2} />
              <span className="font-bold">Chat dengan Asisten</span>
            </button>}

            <button
              type="button"
              onClick={() => { setShowSupportModal(false); setShowModal(true); }}
              className="neo-btn min-h-[44px] px-6 py-3 bg-[#f3701e] text-white inline-flex items-center gap-2 hover:bg-[#d95f10] transition-colors duration-200"
            >
              <TbAlertTriangle size={20} strokeWidth={2.2} />
              <span className="font-bold">Lapor Kerusakan</span>
            </button>

            {isCoordinatorOrAssistant && (
              <div className="inline-flex flex-wrap items-center gap-3 neo-card p-2 bg-[#fcf8f4]">
                <span className="text-sm font-bold text-[#1a1a1a] inline-flex items-center gap-1.5 px-2">
                  <TbTools size={18} strokeWidth={2.2} className="text-[#4b607f]" /> Ubah Status:
                </span>
                <div className="flex items-center gap-2">
                  <select
                    disabled={updatingStatus}
                    value={pcData.status}
                    onChange={(e) => updatePcStatus(e.target.value as PCStatus)}
                    className="px-4 py-2 neo-border-sm rounded-xl bg-white text-sm font-medium focus:outline-none cursor-pointer"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusMap[status].label}
                      </option>
                    ))}
                  </select>
                  {updatingStatus && <TbLoader2 className="animate-spin text-[#f3701e]" size={20} strokeWidth={2.2} />}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="neo-card bg-white p-6 sm:p-8 hover:shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200">
          <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-6 inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#f3701e]/10 text-[#f3701e] flex items-center justify-center">
              <TbTicket size={20} strokeWidth={2.2} />
            </div>
            Ticket Aktif
          </h2>
          
          {activeTickets.length === 0 ? (
            <div className="neo-border-sm rounded-xl p-8 bg-[#fcf8f4] text-center border-dashed border-2">
              <div className="w-16 h-16 mx-auto rounded-full bg-white neo-border flex items-center justify-center mb-4">
                <TbTicket size={28} className="text-[#4b607f]/50" strokeWidth={2.2} />
              </div>
              <p className="font-heading text-lg font-bold text-[#1a1a1a]">Tidak ada ticket aktif</p>
              <p className="text-sm text-[#4b607f] font-medium mt-1">PC ini dalam kondisi baik.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeTickets.map((ticket) => (
                <div key={ticket.id} className="neo-card bg-[#fcf8f4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-colors duration-200">
                  <div>
                    <p className="font-bold text-[#1a1a1a] text-lg">{ticket.title || "Laporan aktif pada perangkat ini"}</p>
                    <p className="text-sm font-medium text-[#4b607f] mt-1 flex items-center gap-2">
                      <span className="neo-badge px-2 py-0.5 bg-white border-[#4b607f] text-[#4b607f] text-xs">
                        {ticket.category ? ticketCategoryLabel[ticket.category] : "Laporan aktif"}
                      </span>
                    </p>
                  </div>
                  <span className="neo-badge px-3 py-1.5 bg-[#4b607f] text-white self-start sm:self-auto text-sm font-bold">
                    {ticketStatusLabel[ticket.status as keyof typeof ticketStatusLabel] ?? "Aktif"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {mounted && showModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-ticket-dialog-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="neo-card bg-white w-full max-w-lg p-5 sm:p-7 max-h-[85dvh] sm:max-h-[90dvh] overflow-y-auto transform scale-100 transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-[#1a1a1a]">
              <h3 id="qr-ticket-dialog-title" className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] inline-flex items-center gap-3 truncate">
                <div className="w-10 h-10 rounded-xl bg-[#f3701e] text-white flex items-center justify-center neo-border-sm flex-shrink-0">
                  <TbPlus size={24} strokeWidth={2.2} />
                </div>
                Lapor Kerusakan
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
              >
                <TbX size={20} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={submitTicket} className="space-y-4">
              {duplicateTicket && (
                <div className="rounded-xl border-2 border-[#f3701e] bg-[#fff3e8] p-4 text-sm text-[#1a1a1a]">
                  <p className="font-bold">Laporan aktif serupa sudah tersedia.</p>
                  <p className="mt-1">Status: {duplicateTicket.status ?? "Aktif"}</p>
                  {duplicateTicket.link && (
                    <Link href={duplicateTicket.link} className="mt-3 inline-flex min-h-[44px] items-center font-bold text-[#4b607f] underline">
                      Buka ticket existing
                    </Link>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="qr-ticket-title" className="text-xs sm:text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">
                  Judul Laporan
                </label>
                <input
                  id="qr-ticket-title"
                  required
                  type="text"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 min-h-[44px] neo-input bg-white text-sm text-[#1a1a1a] focus:outline-none"
                  placeholder="Contoh: Monitor PC berkedip"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="qr-ticket-category" className="text-xs sm:text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">
                  Kategori
                </label>
                <select
                  id="qr-ticket-category"
                  required
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, category: e.target.value as TicketCategory }))}
                  className="w-full px-4 py-3 min-h-[44px] neo-input bg-white text-sm text-[#1a1a1a] focus:outline-none cursor-pointer"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {ticketCategoryLabel[category]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="qr-ticket-description" className="text-xs sm:text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">
                  Deskripsi Kerusakan
                </label>
                <textarea
                  id="qr-ticket-description"
                  required
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 min-h-[110px] neo-input bg-white text-sm text-[#1a1a1a] focus:outline-none resize-y"
                  placeholder="Jelaskan kondisi kerusakan secara detail..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-4 border-t-2 border-[#1a1a1a] mt-6">
                <button
                  type="button"
                  disabled={submittingTicket}
                  onClick={() => setShowModal(false)}
                  className="neo-btn w-full sm:w-auto px-5 min-h-[44px] bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] transition-colors duration-200 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="neo-btn w-full sm:w-auto px-6 min-h-[44px] bg-[#4b607f] text-white inline-flex items-center justify-center gap-2 hover:bg-[#3a4a63] transition-colors duration-200 font-bold"
                >
                  {submittingTicket ? <TbLoader2 className="animate-spin" size={20} strokeWidth={2.2} /> : <TbCpu size={20} strokeWidth={2.2} />}
                  <span>{submittingTicket ? "Mengirim..." : "Kirim Laporan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {mounted && showSupportModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-chat-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-y-auto"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="neo-card bg-white w-full max-w-lg p-5 sm:p-7 max-h-[85dvh] sm:max-h-[90dvh] overflow-y-auto transform scale-100 transition-transform duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5 pb-4 border-b-2 border-[#1a1a1a]">
              <h2 id="support-chat-title" className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] inline-flex items-center gap-2.5 truncate">
                <div className="w-10 h-10 rounded-xl bg-[#4b607f] text-white flex items-center justify-center neo-border-sm shrink-0">
                  <TbMessageCircle size={22} strokeWidth={2.2} />
                </div>
                Chat dengan Asisten
              </h2>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                aria-label="Tutup modal chat"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
              >
                <TbX size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-2.5 rounded-lg border-2 border-[#4b607f] bg-[#f5ede6] p-3 text-[#4b607f]">
              <TbDeviceDesktop size={20} className="shrink-0" strokeWidth={2.2} />
              <span className="text-sm font-bold truncate">
                {pcData.name} · {pcData.pcCode}{pcData.assetCode ? ` (${pcData.assetCode})` : ""}
              </span>
            </div>

            <form onSubmit={submitSupportChat} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="support-chat-message" className="text-xs sm:text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">
                  Pesan
                </label>
                <textarea
                  id="support-chat-message"
                  required
                  minLength={1}
                  maxLength={2000}
                  rows={4}
                  value={supportBody}
                  onChange={(event) => setSupportBody(event.target.value)}
                  disabled={submittingSupport}
                  className="w-full px-4 py-3 min-h-[120px] neo-input bg-white text-sm text-[#1a1a1a] focus:outline-none resize-y"
                  placeholder="Ceritakan pertanyaan atau kendala pada PC ini..."
                />
              </div>

              {supportError && (
                <p role="alert" className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-sm font-bold text-red-700">
                  {supportError}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-4 border-t-2 border-[#1a1a1a] mt-5">
                <button
                  type="button"
                  disabled={submittingSupport}
                  onClick={() => setShowSupportModal(false)}
                  className="neo-btn w-full sm:w-auto px-5 min-h-[44px] bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] transition-colors duration-200 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!supportBody.trim() || submittingSupport}
                  className="neo-btn w-full sm:w-auto px-6 min-h-[44px] bg-[#4b607f] text-white inline-flex items-center justify-center gap-2 hover:bg-[#3a4a63] transition-colors duration-200 font-bold disabled:opacity-50"
                >
                  {submittingSupport ? <TbLoader2 className="animate-spin" size={20} strokeWidth={2.2} /> : <TbSend size={20} strokeWidth={2.2} />}
                  <span>{submittingSupport ? "Mengirim..." : "Mulai Chat"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
