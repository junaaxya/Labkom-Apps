"use client";

import { FormEvent, use, useEffect, useMemo, useState } from "react";
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
  TbTools,
  TbX,
} from "react-icons/tb";
import { useToast } from "@/providers/toast-provider";
import api from "@/services/api";
import type { PCStatus, TicketCategory } from "@/types";

type UserContext = {
  role?: string;
};

type TicketItem = {
  id: string;
  title: string;
  category: TicketCategory;
  status: string;
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
  const [notFoundMessage, setNotFoundMessage] = useState("");

  const [ticketForm, setTicketForm] = useState({
    title: "",
    category: "MOUSE" as TicketCategory,
    description: "",
  });

  useEffect(() => {
    queueMicrotask(() => {
      const parsed = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(parsed);
    });
  }, []);

  const fetchPcData = async () => {
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
  };

  useEffect(() => {
    queueMicrotask(() => void fetchPcData());
  }, [code]);

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
    if (!pcData?.lab?.id) {
      toast.error("Lab untuk PC ini tidak ditemukan.");
      return;
    }

    setSubmittingTicket(true);
    try {
      await api.post("/tickets", {
        labId: pcData.lab.id,
        pcId: pcData.id,
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
      toast.error(errMsg(err, "Gagal mengirim laporan kerusakan."));
    } finally {
      setSubmittingTicket(false);
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
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="neo-btn px-6 py-3 bg-[#f3701e] text-white inline-flex items-center gap-2 hover:bg-[#d95f10] transition-colors duration-200"
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
                    <p className="font-bold text-[#1a1a1a] text-lg">{ticket.title}</p>
                    <p className="text-sm font-medium text-[#4b607f] mt-1 flex items-center gap-2">
                      <span className="neo-badge px-2 py-0.5 bg-white border-[#4b607f] text-[#4b607f] text-xs">
                        {ticket.category}
                      </span>
                    </p>
                  </div>
                  <span className="neo-badge px-3 py-1.5 bg-[#4b607f] text-white self-start sm:self-auto text-sm font-bold">
                    {ticket.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-all duration-300"
          onClick={() => setShowModal(false)}
        >
          <div
            className="neo-card bg-white w-full max-w-lg p-4 sm:p-6 md:p-8 max-h-[90vh] overflow-y-auto transform scale-100 transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-[#1a1a1a]">
              <h3 className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] inline-flex items-center gap-3 truncate">
                <div className="w-10 h-10 rounded-xl bg-[#f3701e] text-white flex items-center justify-center neo-border-sm flex-shrink-0">
                  <TbPlus size={24} strokeWidth={2.2} />
                </div>
                Form Lapor Kerusakan
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
              >
                <TbX size={20} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={submitTicket} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">Judul Laporan</label>
                <input
                  required
                  type="text"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="neo-input"
                  placeholder="Contoh: Monitor PC berkedip"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">Kategori</label>
                <select
                  required
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, category: e.target.value as TicketCategory }))}
                  className="neo-input bg-white cursor-pointer"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1a1a1a] block uppercase tracking-wider">Deskripsi Kerusakan</label>
                <textarea
                  required
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="neo-input resize-none"
                  placeholder="Jelaskan kondisi kerusakan secara detail"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t-2 border-[#1a1a1a] mt-6">
                <button
                  type="button"
                  disabled={submittingTicket}
                  onClick={() => setShowModal(false)}
                  className="neo-btn px-5 py-2.5 bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] transition-colors duration-200 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="neo-btn px-6 py-2.5 bg-[#4b607f] text-white inline-flex items-center gap-2 hover:bg-[#3a4a63] transition-colors duration-200 font-bold"
                >
                  {submittingTicket ? <TbLoader2 className="animate-spin" size={20} strokeWidth={2.2} /> : <TbCpu size={20} strokeWidth={2.2} />}
                  {submittingTicket ? "Mengirim..." : "Kirim Laporan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
