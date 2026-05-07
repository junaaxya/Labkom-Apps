"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TbLoader2, TbQrcode, TbArrowBackUp, TbAlertTriangle } from "react-icons/tb";
import api from "@/services/api";
import { QRPreviewModal } from "@/components/qr/qr-preview-modal";
import { useToast } from "@/providers/toast-provider";

type KeyStatus = "AVAILABLE" | "BORROWED" | "MISSING" | "MAINTENANCE";

interface KeyItem {
  id: string;
  keyCode: string;
  labId: string;
  labName: string;
  status: KeyStatus;
  currentHolder?: {
    id: string;
    name: string;
    role?: string;
  } | null;
  qrCode: string;
}

const statusConfig: Record<KeyStatus, { label: string; color: string; icon: string }> = {
  AVAILABLE: { label: "Tersedia", color: "bg-green-500 text-white", icon: "🔑" },
  BORROWED: { label: "Dipinjam", color: "bg-[#4b607f] text-white", icon: "🔒" },
  MISSING: { label: "Hilang", color: "bg-red-500 text-white", icon: "❌" },
  MAINTENANCE: { label: "Maintenance", color: "bg-yellow-500 text-white", icon: "🔧" },
};

export default function KeysPage() {
  const toast = useToast();
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<KeyItem | null>(null);
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrPreview, setQrPreview] = useState<{ qrImage: string; code: string; label: string } | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [forceReturnModal, setForceReturnModal] = useState<{ keyId: string; keyCode: string; holder: string } | null>(null);
  const [forceReturnReason, setForceReturnReason] = useState("");
  const [forceReturning, setForceReturning] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const user = JSON.parse(stored);
        setUserRole(user.role || "");
      }
    } catch {}
  }, []);

  const fetchKeys = async () => {
    setIsLoading(true);

    try {
      const response = await api.get<{ data: any[] }>("/keys");
      const mapped: KeyItem[] = (response.data ?? []).map((item) => ({
        id: item.id,
        keyCode: item.keyCode,
        labId: item.labId,
        labName: item.lab?.name ?? "-",
        status: item.status,
        currentHolder: item.currentHolder
          ? {
              id: item.currentHolder.id,
              name: item.currentHolder.name,
              role: item.currentHolder.role,
            }
          : null,
        qrCode: item.qrCode,
      }));

      setKeys(mapped);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat data kunci");
      setKeys([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleTakeKey = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.patch(`/keys/${id}/take`, {});
      await fetchKeys();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengambil kunci");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReturnKey = async (id: string) => {
    setActionLoadingId(id);
    try {
      const statusRes = await api.get<{ data: { needsCondition: boolean } }>(`/keys/${id}/return-status`);
      if (statusRes.data?.needsCondition) {
        toast.error("Anda harus memvalidasi kondisi lab (foto) sebelum mengembalikan kunci. Gunakan Scan QR untuk mengembalikan kunci.");
        return;
      }
      await api.patch(`/keys/${id}/return`, {});
      toast.success("Kunci berhasil dikembalikan.");
      await fetchKeys();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengembalikan kunci");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleShowKeyQR = async (key: KeyItem) => {
    setActionLoadingId(key.id);
    try {
      const response = await api.get<{ success?: boolean; data?: { keyCode: string; qrUrl: string; qrImage: string }; keyCode?: string; qrImage?: string }>(`/qr/keys/${key.id}/image`);
      const payload = response.data ?? response;
      if (!payload.qrImage) {
        throw new Error("QR image tidak tersedia");
      }

      setQrPreview({
        qrImage: payload.qrImage,
        code: payload.keyCode || key.keyCode,
        label: "QR Kunci",
      });
      setQrModalOpen(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat QR kunci");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleForceReturn = async () => {
    if (!forceReturnModal) return;
    setForceReturning(true);
    try {
      await api.patch(`/keys/${forceReturnModal.keyId}/force-return`, { reason: forceReturnReason || undefined });
      toast.success("Kunci berhasil dikembalikan paksa.");
      setForceReturnModal(null);
      setForceReturnReason("");
      await fetchKeys();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal force return kunci");
    } finally {
      setForceReturning(false);
    }
  };

  const handleGenerateAllQR = async () => {
    setBulkGenerating(true);
    try {
      const response = await api.post<{ success?: boolean; message?: string }>("/qr/keys/bulk-generate", {});
      toast.success(response.message ?? "Berhasil generate QR untuk semua kunci.");
      await fetchKeys();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal generate semua QR kunci");
    } finally {
      setBulkGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="neo-card p-6 bg-[#e8d8c9]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#1a1a1a]">Peminjaman Kunci</h1>
            <p className="text-[#5a5a5a] mt-1 font-medium">Kelola peminjaman kunci lab via QR Code</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateAllQR}
              className="px-4 py-2.5 bg-white text-[#1a1a1a] neo-btn inline-flex items-center gap-2 text-sm"
              disabled={bulkGenerating}
            >
              {bulkGenerating ? <TbLoader2 className="w-4 h-4 animate-spin" /> : <TbQrcode className="w-4 h-4" />}
              Generate All QR
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowScanModal(true)}
              className="px-5 py-2.5 bg-[#f3701e] text-white neo-btn flex items-center gap-2"
            >
              <TbQrcode className="w-5 h-5" /> Scan QR
            </motion.button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="neo-card p-8 text-center">
          <p className="text-[#5a5a5a]">Memuat data kunci...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isLoading &&
          keys.map((key, i) => (
          <motion.div
            key={key.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="neo-card p-5 neo-hover cursor-pointer"
            onClick={() => setSelectedKey(key)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{statusConfig[key.status].icon}</span>
                <div>
                  <p className="font-bold text-sm text-[#1a1a1a]">{key.keyCode}</p>
                  <p className="text-xs text-[#5a5a5a]">{key.labName}</p>
                </div>
              </div>
              <span className={`neo-badge px-2 py-0.5 text-xs ${statusConfig[key.status].color}`}>
                {statusConfig[key.status].label}
              </span>
            </div>
            {key.currentHolder && (
              <div className="mt-2 p-2 rounded-lg bg-[#f5ede6] neo-border-sm">
                <p className="text-xs text-[#5a5a5a]">Dipinjam oleh:</p>
                <p className="text-sm font-bold text-[#1a1a1a]">{key.currentHolder.name}</p>
                {key.currentHolder.role && <p className="text-xs text-[#5a5a5a]">Role: {key.currentHolder.role}</p>}
              </div>
            )}
              <div className="mt-3 flex gap-2">
              <button
                className="w-10 py-2 text-xs bg-white text-[#1a1a1a] neo-border-sm rounded-lg font-bold inline-flex items-center justify-center transition-all hover:bg-[#f5ede6] hover:shadow-[2px_2px_0px_#1a1a1a]"
                disabled={actionLoadingId === key.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowKeyQR(key);
                }}
                title="Lihat QR"
              >
                <TbQrcode className="w-5 h-5" />
              </button>
              {userRole === "KOORDINATOR_LAB" && key.status === "BORROWED" && (
                <button
                  className="flex-1 py-2 text-xs bg-red-500 text-white neo-border-sm rounded-lg font-bold transition-all hover:brightness-110 hover:shadow-[2px_2px_0px_#1a1a1a] inline-flex items-center justify-center gap-1"
                  disabled={actionLoadingId === key.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setForceReturnModal({ keyId: key.id, keyCode: key.keyCode, holder: key.currentHolder?.name || "-" });
                  }}
                >
                  <TbArrowBackUp className="w-4 h-4" /> Force Return
                </button>
              )}
              {userRole === "MAHASISWA" && (
                <>
                  {key.status === "AVAILABLE" && (
                    <button
                      className="flex-1 py-2 text-xs bg-[#4b607f] text-white neo-border-sm rounded-lg font-bold transition-all hover:brightness-110 hover:shadow-[2px_2px_0px_#1a1a1a]"
                      disabled={actionLoadingId === key.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTakeKey(key.id);
                      }}
                    >
                      {actionLoadingId === key.id ? "Memproses..." : "Ambil Kunci"}
                    </button>
                  )}
                  {key.status === "BORROWED" && (
                    <button
                      className="flex-1 py-2 text-xs bg-green-500 text-white neo-border-sm rounded-lg font-bold transition-all hover:brightness-110 hover:shadow-[2px_2px_0px_#1a1a1a]"
                      disabled={actionLoadingId === key.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReturnKey(key.id);
                      }}
                    >
                      {actionLoadingId === key.id ? "Memproses..." : "Kembalikan"}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {!isLoading && keys.length === 0 && (
        <div className="neo-card p-12 text-center flex flex-col items-center justify-center">
          <TbQrcode className="w-12 h-12 text-[#5a5a5a] mb-3" />
          <h3 className="font-heading text-xl font-bold text-[#1a1a1a] mb-1">Tidak Ada Kunci</h3>
          <p className="text-[#5a5a5a]">Belum ada data kunci.</p>
        </div>
      )}

      <AnimatePresence>
        {showScanModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowScanModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-6 w-full max-w-sm text-center shadow-[6px_6px_0px_#1a1a1a]"
            >
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-4">Scan QR Kunci</h2>
              <div className="w-48 h-48 mx-auto bg-[#e8d8c9] neo-border rounded-xl flex items-center justify-center mb-4 shadow-[4px_4px_0px_#1a1a1a]">
                <TbQrcode className="w-16 h-16 text-[#1a1a1a]" />
              </div>
              <p className="text-sm text-[#5a5a5a] mb-4">Arahkan kamera ke QR Code pada kunci lab</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowScanModal(false)}
                className="w-full py-3 bg-white text-[#1a1a1a] neo-btn"
              >
                Tutup
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedKey(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-6 w-full max-w-sm shadow-[6px_6px_0px_#1a1a1a]"
            >
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-4">Detail Kunci</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-[#5a5a5a]">Kode:</span>
                  <span className="text-sm font-bold">{selectedKey.keyCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#5a5a5a]">Lab:</span>
                  <span className="text-sm font-bold">{selectedKey.labName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-[#5a5a5a]">Status:</span>
                  <span className={`neo-badge px-2 py-0.5 text-xs ${statusConfig[selectedKey.status].color}`}>
                    {statusConfig[selectedKey.status].label}
                  </span>
                </div>
                {selectedKey.currentHolder && (
                  <div className="flex justify-between">
                    <span className="text-sm text-[#5a5a5a]">Peminjam:</span>
                    <span className="text-sm font-bold">{selectedKey.currentHolder.name}</span>
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedKey(null)}
                className="w-full mt-4 py-3 bg-white text-[#1a1a1a] neo-btn"
              >
                Tutup
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {forceReturnModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
            onClick={() => setForceReturnModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-6 w-full max-w-sm shadow-[6px_6px_0px_#1a1a1a]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <TbAlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-bold text-[#1a1a1a]">Force Return Kunci</h2>
                  <p className="text-xs text-[#5a5a5a]">Bypass validasi kondisi</p>
                </div>
              </div>
              <div className="p-3 bg-[#f5ede6] neo-border-sm rounded-lg mb-4">
                <p className="text-sm"><span className="text-[#5a5a5a]">Kunci:</span> <span className="font-bold">{forceReturnModal.keyCode}</span></p>
                <p className="text-sm"><span className="text-[#5a5a5a]">Peminjam:</span> <span className="font-bold">{forceReturnModal.holder}</span></p>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-[#1a1a1a] mb-1 block">Alasan (opsional)</label>
                <textarea
                  value={forceReturnReason}
                  onChange={(e) => setForceReturnReason(e.target.value)}
                  className="w-full neo-input text-sm min-h-[60px]"
                  placeholder="Contoh: Kunci tidak dikembalikan setelah 24 jam"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setForceReturnModal(null)}
                  className="flex-1 py-2.5 bg-white text-[#1a1a1a] neo-btn text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={handleForceReturn}
                  disabled={forceReturning}
                  className="flex-1 py-2.5 bg-red-500 text-white neo-btn text-sm"
                >
                  {forceReturning ? "Memproses..." : "Ya, Force Return"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QRPreviewModal
        open={qrModalOpen && Boolean(qrPreview)}
        onClose={() => {
          setQrModalOpen(false);
          setQrPreview(null);
        }}
        qrImage={qrPreview?.qrImage || ""}
        code={qrPreview?.code || ""}
        label={qrPreview?.label || "QR"}
      />
    </div>
  );
}
