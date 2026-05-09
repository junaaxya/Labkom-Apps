"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { use } from "react";
import {
  TbArrowLeft,
  TbDeviceDesktop,
  TbEdit,
  TbLoader2,
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

  async function fetchLabData() {
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
  }

  useEffect(() => {
    fetchLabData();
  }, [id]);

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
      <div className="neo-card p-12 flex flex-col items-center justify-center gap-3">
        <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
        <p className="text-sm text-[#5a5a5a]">Memuat detail lab...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/labs">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white neo-border-sm neo-shadow-sm neo-hover"
            >
              <TbArrowLeft className="w-6 h-6 text-[#1a1a1a]" />
            </motion.div>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">
                {lab?.name || "Detail Lab"}
              </h1>
              <span className={`neo-badge px-2.5 py-1 ${lab?.status === 'ACTIVE' ? 'status-available' : lab?.status === 'MAINTENANCE' ? 'status-maintenance' : 'status-inactive'}`}>
                {lab?.status === 'ACTIVE' ? 'Aktif' : lab?.status === 'MAINTENANCE' ? 'Maintenance' : 'Tidak Aktif'}
              </span>
            </div>
            <p className="text-[#5a5a5a] font-medium mt-1 flex items-center gap-2">
              <span>📍 {lab?.location || "-"}</span>
              <span className="text-[#1a1a1a] opacity-30">•</span>
              <span className="font-mono text-sm opacity-70">ID: {id}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBulkGenerateQR}
            className="px-4 py-3 bg-white text-[#1a1a1a] neo-btn inline-flex items-center gap-2 font-bold"
            disabled={actionLoading}
          >
            <TbQrcode className="w-5 h-5 text-[#4b607f]" />
            Generate All QR
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePrintQRSheet}
            className="px-4 py-3 bg-white text-[#1a1a1a] neo-btn inline-flex items-center gap-2 font-bold"
            disabled={actionLoading}
          >
            <TbPrinter className="w-5 h-5 text-[#4b607f]" />
            Print QR Sheet
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-[#f3701e] text-white neo-btn inline-flex items-center gap-2 font-bold"
            disabled={actionLoading}
          >
            <TbPlus className="w-5 h-5" />
            Tambah PC
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setFilter("ALL")}
          className={`neo-card p-4 text-left cursor-pointer transition-all ${filter === "ALL" ? "shadow-[6px_6px_0px_#f3701e] border-[#f3701e] bg-[#fff5ef]" : "bg-white hover:shadow-[6px_6px_0px_#1a1a1a]"}`}
        >
          <p className="text-[#5a5a5a] font-bold text-sm mb-1 uppercase tracking-wider">Total PC</p>
          <p className="font-heading text-3xl sm:text-4xl font-bold text-[#1a1a1a]">{pcs.length}</p>
        </motion.button>
        {(Object.keys(statusConfig) as PCStatus[]).map((status) => (
          <motion.button
            key={status}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter(status)}
            className={`neo-card p-4 text-left cursor-pointer transition-all ${filter === status ? "shadow-[6px_6px_0px_#4b607f] border-[#4b607f] bg-[#f0f4f8]" : "bg-white hover:shadow-[6px_6px_0px_#1a1a1a]"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-[#1a1a1a] ${
                status === 'AVAILABLE' ? 'bg-[#22c55e]' : 
                status === 'IN_USE' ? 'bg-[#4b607f]' : 
                status === 'BROKEN' ? 'bg-[#ef4444]' : 
                status === 'MAINTENANCE' ? 'bg-[#eab308]' : 'bg-[#9ca3af]'
              }`} />
              <p className="text-[#5a5a5a] font-bold text-sm truncate uppercase tracking-wider">{statusConfig[status].label}</p>
            </div>
            <p className="font-heading text-3xl sm:text-4xl font-bold text-[#1a1a1a]">{statusCounts[status] || 0}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredPCs.map((pc, i) => (
          <motion.div
            key={pc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`neo-card-hover p-5 flex flex-col h-full bg-white border-t-8 ${
                pc.status === 'AVAILABLE' ? 'border-t-[#22c55e]' : 
                pc.status === 'IN_USE' ? 'border-t-[#4b607f]' : 
                pc.status === 'BROKEN' ? 'border-t-[#ef4444]' : 
                pc.status === 'MAINTENANCE' ? 'border-t-[#eab308]' : 'border-t-[#9ca3af]'
              }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#f5ede6] neo-border-sm flex items-center justify-center">
                <TbDeviceDesktop className="w-6 h-6 text-[#4b607f]" />
              </div>
              <span className={`neo-badge px-2.5 py-1 ${statusConfig[pc.status].class}`}>
                {statusConfig[pc.status].label}
              </span>
            </div>
            
            <div className="flex-1">
              <p className="font-heading font-bold text-2xl text-[#1a1a1a]">{pc.pcCode}</p>
              <p className="text-sm font-medium text-[#5a5a5a] mt-1 line-clamp-1">{pc.name}</p>
              {pc.ipAddress && (
                <p className="text-xs font-mono font-bold bg-[#f5ede6] px-2.5 py-1.5 rounded-lg inline-block mt-3 neo-border-sm text-[#4b607f]">{pc.ipAddress}</p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-5 pt-4 border-t-[3px] border-[#e8d8c9]">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleGeneratePCQR(pc)}
                className="w-10 h-10 bg-white neo-btn flex items-center justify-center shrink-0"
                disabled={actionLoading}
                title="Generate QR"
              >
                <TbQrcode className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openEditStatusModal(pc)}
                className="flex-1 h-10 bg-white neo-btn text-sm font-bold flex items-center justify-center gap-1.5"
                disabled={actionLoading}
              >
                <TbEdit className="w-4 h-4" />
                Edit
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDeletePC(pc.id)}
                className="w-10 h-10 bg-[#ef4444] text-white neo-btn flex items-center justify-center shrink-0"
                disabled={actionLoading}
                title="Hapus PC"
              >
                <TbTrash className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredPCs.length === 0 && (
        <div className="neo-card p-12 text-center border-dashed bg-[#f5ede6]/50">
          <div className="w-24 h-24 mx-auto bg-white rounded-2xl neo-border flex items-center justify-center mb-6 transform rotate-6 shadow-[4px_4px_0px_#1a1a1a]">
            <TbDeviceDesktop className="w-12 h-12 text-[#4b607f]" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-[#1a1a1a] mb-2">Tidak ada PC</h2>
          <p className="text-[#5a5a5a] mt-2 max-w-md mx-auto">Belum ada data PC pada filter ini. Klik tombol "Tambah PC" untuk mulai mendaftarkan perangkat.</p>
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => !actionLoading && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[6px_6px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Tambah PC</h2>
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
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
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
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
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
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 bg-[#4b607f] text-white neo-btn inline-flex items-center justify-center gap-2"
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
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn"
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
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => {
              if (!actionLoading) {
                setShowEditStatusModal(false);
                setSelectedPC(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-[6px_6px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Edit Status PC</h2>
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
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  >
                    {(Object.keys(statusConfig) as PCStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {statusConfig[status].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 bg-[#4b607f] text-white neo-btn inline-flex items-center justify-center gap-2"
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
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn"
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
