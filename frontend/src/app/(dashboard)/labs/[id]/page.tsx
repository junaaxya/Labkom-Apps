"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { use } from "react";
import {
  TbArrowLeft,
  TbDeviceDesktop,
  TbEdit,
  TbLoader2,
  TbMapPin,
  TbPlus,
  TbPrinter,
  TbQrcode,
  TbTrash,
  TbX,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { QRPreviewModal } from "@/components/qr/qr-preview-modal";
import type { Lab, PC, PCStatus } from "@/types";

type LabDetailResponse = {
  success: boolean;
  data: Lab;
};

type LabPcsResponse = {
  success: boolean;
  data: PC[];
};

type QRPCImagePayload = {
  pcCode: string;
  assetCode?: string;
  qrUrl: string;
  qrImage: string;
};

type QRApiResponse = {
  success?: boolean;
  data?: QRPCImagePayload;
  pcCode?: string;
  assetCode?: string;
  qrUrl?: string;
  qrImage?: string;
  message?: string;
};

const statusConfig: Record<PCStatus, { label: string; class: string }> = {
  AVAILABLE: { label: "Tersedia", class: "status-available" },
  IN_USE: { label: "Digunakan", class: "status-in-use" },
  BROKEN: { label: "Rusak", class: "status-broken" },
  MAINTENANCE: { label: "Maintenance", class: "status-maintenance" },
  INACTIVE: { label: "Tidak Aktif", class: "status-inactive" },
};

export default function LabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const toast = useToast();
  const { id } = use(params);
  const [lab, setLab] = useState<Lab | null>(null);
  const [pcs, setPcs] = useState<PC[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [filter, setFilter] = useState<PCStatus | "ALL">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditStatusModal, setShowEditStatusModal] = useState(false);
  const [selectedPC, setSelectedPC] = useState<PC | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPreview, setQRPreview] = useState<{ qrImage: string; code: string; label: string } | null>(null);

  const [newPC, setNewPC] = useState({
    pcCode: "",
    name: "",
    ipAddress: "",
  });
  const [editStatus, setEditStatus] = useState<PCStatus>("AVAILABLE");

  const fetchLabData = useCallback(async () => {
    try {
      setLoading(true);

      const [labRes, pcsRes] = await Promise.all([
        api.get<LabDetailResponse>(`/labs/${id}`),
        api.get<LabPcsResponse>(`/labs/${id}/pcs`),
      ]);

      setLab(labRes.data);
      setPcs(pcsRes.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat data lab";
      toast.error(message);
      setLab(null);
      setPcs([]);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchLabData();
    });
  }, [fetchLabData]);

  async function handleCreatePC(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!newPC.pcCode.trim() || !newPC.name.trim()) return;

    try {
      setActionLoading(true);
      await api.post<{ success: boolean; data: PC }>("/labs/pcs", {
        labId: id,
        pcCode: newPC.pcCode.trim(),
        name: newPC.name.trim(),
        ipAddress: newPC.ipAddress.trim() || undefined,
      });

      setShowCreateModal(false);
      setNewPC({ pcCode: "", name: "", ipAddress: "" });
      await fetchLabData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menambah PC";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  function openEditStatusModal(pc: PC) {
    setSelectedPC(pc);
    setEditStatus(pc.status);
    setShowEditStatusModal(true);
  }

  async function handleEditStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPC) return;

    try {
      setActionLoading(true);
      await api.put<{ success: boolean; data: PC }>(`/labs/pcs/${selectedPC.id}`, {
        status: editStatus,
      });

      setShowEditStatusModal(false);
      setSelectedPC(null);
      await fetchLabData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengubah status PC";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeletePC(pcId: string) {
    const confirmed = window.confirm("Yakin ingin menghapus PC ini?");
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await api.delete<{ success: boolean }>(`/labs/pcs/${pcId}`);
      await fetchLabData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menghapus PC";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGeneratePCQR(pc: PC) {
    try {
      setActionLoading(true);

      const response = await api.post<QRApiResponse>(`/qr/pcs/${pc.id}/generate`, {});
      const payload = response.data ?? response;

      if (!payload.qrImage) {
        throw new Error("QR image tidak tersedia");
      }

      setQRPreview({
        qrImage: payload.qrImage,
        code: payload.pcCode || pc.pcCode,
        label: "QR PC",
      });
      setShowQRModal(true);
      toast.success(`QR untuk ${pc.pcCode} berhasil dibuat.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membuat QR PC";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBulkGenerateQR() {
    try {
      setActionLoading(true);
      const response = await api.post<{ success?: boolean; message?: string }>(`/qr/pcs/bulk-generate?labId=${id}`, {});
      toast.success(response.message || "Berhasil generate QR untuk semua PC di lab ini.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal generate semua QR PC";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePrintQRSheet() {
    try {
      setActionLoading(true);

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
      const response = await fetch(`${baseUrl}/qr/print-sheet?labId=${id}&type=pc`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Gagal memuat print sheet (HTTP ${response.status})`);
      }

      const html = await response.text();
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Popup diblokir browser. Izinkan popup lalu coba lagi.");
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      toast.success("Print sheet QR PC berhasil dibuka.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membuka print sheet QR";
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  const filteredPCs = filter === "ALL" ? pcs : pcs.filter((pc) => pc.status === filter);

  const statusCounts = useMemo(() => {
    const counts: Record<PCStatus, number> = {
      AVAILABLE: 0,
      IN_USE: 0,
      BROKEN: 0,
      MAINTENANCE: 0,
      INACTIVE: 0,
    };

    for (const pc of pcs) {
      counts[pc.status] += 1;
    }

    return counts;
  }, [pcs]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="neo-card overflow-hidden bg-[#4b607f] p-4 sm:p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-11 w-11 rounded-xl bg-white/25" />
            <div className="space-y-2">
              <div className="h-7 w-2/3 rounded bg-white/25" />
              <div className="h-4 w-1/2 rounded bg-white/20" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="h-16 rounded-xl bg-white/20" />
              <div className="h-16 rounded-xl bg-white/20" />
              <div className="h-16 rounded-xl bg-white/20" />
              <div className="h-16 rounded-xl bg-white/20" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="neo-card p-4">
              <div className="animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-[#e8d8c9]" />
                  <div className="h-7 w-20 rounded-xl bg-[#e8d8c9]" />
                </div>
                <div className="h-6 w-24 rounded bg-[#e8d8c9]" />
                <div className="h-4 w-32 rounded bg-[#e8d8c9]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      <section className="neo-card relative overflow-hidden bg-[#f5ede6] p-4 text-[#1a1a1a] sm:p-6 lg:p-7">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#f3701e]/25 blur-sm" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link href="/labs" className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-xl border-2 border-[#1a1a1a] bg-white px-3 py-2 text-sm font-black text-[#4b607f] shadow-[2px_2px_0px_rgba(26,26,26,0.18)] transition-transform active:scale-95">
                <TbArrowLeft className="h-5 w-5" /> Kembali
              </Link>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                    {lab?.name || "Detail Lab"}
                  </h1>
                  <span className={`neo-badge px-2.5 py-1 ${lab?.status === 'ACTIVE' ? 'status-available' : lab?.status === 'MAINTENANCE' ? 'status-maintenance' : 'status-inactive'}`}>
                    {lab?.status === 'ACTIVE' ? 'Aktif' : lab?.status === 'MAINTENANCE' ? 'Maintenance' : 'Tidak Aktif'}
                  </span>
                </div>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#5a5a5a]">
                  <TbMapPin className="h-4 w-4" />
                  <span>{lab?.location || "-"}</span>
                  <span className="opacity-50">•</span>
                  <span className="font-mono text-xs text-[#4b607f]">ID: {id}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[520px]">
              {[
                { label: "Total PC", value: pcs.length, tone: "bg-white text-[#1a1a1a]" },
                { label: "Tersedia", value: statusCounts.AVAILABLE, tone: "bg-[#d1fae5] text-[#065f46]" },
                { label: "Bermasalah", value: statusCounts.BROKEN + statusCounts.MAINTENANCE, tone: "bg-[#fee2e2] text-[#991b1b]" },
              ].map((stat) => (
                <div key={stat.label} className={`${stat.tone} rounded-xl border-2 border-[#1a1a1a] p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.35)]`}>
                  <p className="font-heading text-2xl font-black leading-none">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-80">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBulkGenerateQR}
            className="neo-btn inline-flex min-h-[48px] items-center justify-center gap-2 bg-white px-4 py-3 text-sm font-black text-[#1a1a1a]"
            disabled={actionLoading}
          >
            <TbQrcode className="h-5 w-5 text-[#4b607f]" />
            Generate QR
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePrintQRSheet}
            className="neo-btn inline-flex min-h-[48px] items-center justify-center gap-2 bg-white px-4 py-3 text-sm font-black text-[#1a1a1a]"
            disabled={actionLoading}
          >
            <TbPrinter className="h-5 w-5 text-[#4b607f]" />
            Print Sheet
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="neo-btn inline-flex min-h-[48px] items-center justify-center gap-2 bg-[#f3701e] px-5 py-3 text-sm font-black text-white"
            disabled={actionLoading}
          >
            <TbPlus className="h-5 w-5" />
            Tambah PC
          </motion.button>
          </div>
        </div>
      </section>

      <section className="sticky top-[64px] z-20 rounded-2xl border-2 border-[#1a1a1a] bg-[#e8d8c9]/95 p-2 shadow-[4px_4px_0px_rgba(26,26,26,0.12)] backdrop-blur-md sm:static sm:p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setFilter("ALL")}
          className={`min-h-[72px] cursor-pointer rounded-xl border-2 border-[#1a1a1a] p-2.5 text-left transition-all sm:p-3 ${filter === "ALL" ? "bg-[#fff5ef] shadow-[4px_4px_0px_#f3701e]" : "bg-white"}`}
        >
          <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#5a5a5a]">Total PC</p>
          <p className="font-heading text-2xl font-black text-[#1a1a1a]">{pcs.length}</p>
        </motion.button>
        {(Object.keys(statusConfig) as PCStatus[]).map((status) => (
          <motion.button
            key={status}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter(status)}
            className={`min-h-[72px] cursor-pointer rounded-xl border-2 border-[#1a1a1a] p-2.5 text-left transition-all sm:p-3 ${filter === status ? "bg-[#f0f4f8] shadow-[4px_4px_0px_#4b607f]" : "bg-white"}`}
          >
            <div className="mb-1 flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-[#1a1a1a] ${
                status === 'AVAILABLE' ? 'bg-[#22c55e]' : 
                status === 'IN_USE' ? 'bg-[#4b607f]' : 
                status === 'BROKEN' ? 'bg-[#ef4444]' : 
                status === 'MAINTENANCE' ? 'bg-[#eab308]' : 'bg-[#9ca3af]'
              }`} />
              <p className="truncate text-[10px] font-black uppercase tracking-wide text-[#5a5a5a]">{statusConfig[status].label}</p>
            </div>
            <p className="font-heading text-2xl font-black text-[#1a1a1a]">{statusCounts[status] || 0}</p>
          </motion.button>
        ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:gap-5">
        {filteredPCs.map((pc, i) => (
          <motion.div
            key={pc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`neo-card-hover flex h-full flex-col bg-white p-4 sm:p-5 border-t-8 ${
                pc.status === 'AVAILABLE' ? 'border-t-[#22c55e]' : 
                pc.status === 'IN_USE' ? 'border-t-[#4b607f]' : 
                pc.status === 'BROKEN' ? 'border-t-[#ef4444]' : 
                pc.status === 'MAINTENANCE' ? 'border-t-[#eab308]' : 'border-t-[#9ca3af]'
              }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5ede6] neo-border-sm">
                <TbDeviceDesktop className="h-6 w-6 text-[#4b607f]" />
              </div>
              <span className={`neo-badge max-w-[150px] truncate px-2.5 py-1 text-[10px] sm:text-xs ${statusConfig[pc.status].class}`}>
                {statusConfig[pc.status].label}
              </span>
            </div>
            
            <div className="flex-1">
              <p className="font-heading text-2xl font-black text-[#1a1a1a]">{pc.pcCode}</p>
              <p className="mt-1 line-clamp-1 text-sm font-bold text-[#5a5a5a]">{pc.name}</p>
              {pc.ipAddress && (
                <p className="mt-3 inline-block rounded-lg bg-[#f5ede6] px-2.5 py-1.5 font-mono text-xs font-bold text-[#4b607f] neo-border-sm">{pc.ipAddress}</p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-[44px_1fr_44px] items-center gap-2 border-t-2 border-[#e8d8c9] pt-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleGeneratePCQR(pc)}
                className="flex h-11 w-11 shrink-0 items-center justify-center bg-white neo-btn"
                disabled={actionLoading}
                title="Generate QR"
              >
                <TbQrcode className="h-5 w-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openEditStatusModal(pc)}
                className="flex h-11 items-center justify-center gap-1.5 bg-white text-sm font-black neo-btn"
                disabled={actionLoading}
              >
                <TbEdit className="h-4 w-4" />
                Edit
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDeletePC(pc.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#ef4444] text-white neo-btn"
                disabled={actionLoading}
                title="Hapus PC"
              >
                <TbTrash className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredPCs.length === 0 && (
        <div className="neo-card bg-[#f5ede6]/70 p-6 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-16 w-16 rotate-6 items-center justify-center rounded-2xl bg-white neo-border shadow-[4px_4px_0px_#1a1a1a] sm:h-20 sm:w-20">
            <TbDeviceDesktop className="h-9 w-9 text-[#4b607f] sm:h-11 sm:w-11" />
          </div>
          <h2 className="font-heading text-xl font-black text-[#1a1a1a] sm:text-2xl">Tidak ada PC</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-[#5a5a5a]">
            Belum ada data PC pada filter ini. Klik tombol &quot;Tambah PC&quot; untuk mulai mendaftarkan perangkat.
          </p>
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={() => !actionLoading && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 48 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 48 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[6px_6px_0px_#1a1a1a] sm:rounded-b-xl sm:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f3701e]">Perangkat</p>
                  <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Tambah PC</h2>
                </div>
                <button
                  type="button"
                  onClick={() => !actionLoading && setShowCreateModal(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                  disabled={actionLoading}
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleCreatePC}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kode PC</label>
                  <input
                    type="text"
                    value={newPC.pcCode}
                    onChange={(e) => setNewPC((prev) => ({ ...prev, pcCode: e.target.value }))}
                    placeholder="e.g. LABA-PC-01"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama PC</label>
                  <input
                    type="text"
                    value={newPC.name}
                    onChange={(e) => setNewPC((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. PC 01"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">IP Address (opsional)</label>
                  <input
                    type="text"
                    value={newPC.ipAddress}
                    onChange={(e) => setNewPC((prev) => ({ ...prev, ipAddress: e.target.value }))}
                    placeholder="e.g. 192.168.1.101"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 min-h-[48px] bg-[#4b607f] text-white neo-btn inline-flex items-center justify-center gap-2"
                    disabled={actionLoading}
                  >
                    {actionLoading && <TbLoader2 className="w-4 h-4 animate-spin" />}
                    Simpan
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 min-h-[48px] bg-white text-[#1a1a1a] neo-btn"
                    disabled={actionLoading}
                  >
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditStatusModal && selectedPC && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={() => {
              if (!actionLoading) {
                setShowEditStatusModal(false);
                setSelectedPC(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.98, y: 48 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 48 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[6px_6px_0px_#1a1a1a] sm:rounded-b-xl sm:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f3701e]">Status</p>
                  <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Edit Status PC</h2>
                  <p className="text-sm text-[#5a5a5a]">{selectedPC.pcCode} &bull; {selectedPC.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { if (!actionLoading) { setShowEditStatusModal(false); setSelectedPC(null); } }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                  disabled={actionLoading}
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleEditStatus}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as PCStatus)}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm bg-white"
                  >
                    {(Object.keys(statusConfig) as PCStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {statusConfig[status].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 min-h-[48px] bg-[#4b607f] text-white neo-btn inline-flex items-center justify-center gap-2"
                    disabled={actionLoading}
                  >
                    {actionLoading && <TbLoader2 className="w-4 h-4 animate-spin" />}
                    Simpan
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowEditStatusModal(false);
                      setSelectedPC(null);
                    }}
                    className="flex-1 py-3 min-h-[48px] bg-white text-[#1a1a1a] neo-btn"
                    disabled={actionLoading}
                  >
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QRPreviewModal
        open={showQRModal && Boolean(qrPreview)}
        onClose={() => {
          setShowQRModal(false);
          setQRPreview(null);
        }}
        qrImage={qrPreview?.qrImage || ""}
        code={qrPreview?.code || ""}
        label={qrPreview?.label || "QR"}
      />
    </div>
  );
}
