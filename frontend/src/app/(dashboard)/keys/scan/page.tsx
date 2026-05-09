"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  TbQrcode,
  TbKey,
  TbArrowBackUp,
  TbSearch,
  TbUser,
  TbBuildingWarehouse,
  TbInfoCircle,
  TbRefresh,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import type { Key, KeyStatus } from "@/types";

type UserContext = {
  userId?: string;
  name?: string;
  role?: string;
  email?: string;
  isKetuaKelas?: boolean;
};

const statusMap: Record<KeyStatus, { label: string; classes: string }> = {
  AVAILABLE: { label: "Tersedia", classes: "bg-green-500 text-white" },
  BORROWED: { label: "Dipinjam", classes: "bg-[#4b607f] text-white" },
  MISSING: { label: "Hilang", classes: "bg-red-500 text-white" },
  MAINTENANCE: { label: "Maintenance", classes: "bg-yellow-400 text-[#1a1a1a]" },
};

export default function ScanKeysPage() {
  const toast = useToast();
  const [user, setUser] = useState<UserContext>({});
  const [qrCode, setQrCode] = useState("");
  const [foundKey, setFoundKey] = useState<Key | null>(null);
  const [keys, setKeys] = useState<Key[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const parsed = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(parsed);
  }, []);

  const fetchKeys = async () => {
    setLoadingList(true);
    try {
      const res = await api.get<{ data: Key[] }>("/keys");
      setKeys(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat daftar kunci.");
      setKeys([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const scanQrCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setScanning(true);
    try {
      const res = await api.post<{ data: Key }>("/keys/scan", { qrCode: qrCode.trim() });
      setFoundKey(res.data ?? null);
      if (!res.data) {
        toast.error("Kunci tidak ditemukan.");
      }
    } catch (err: any) {
      setFoundKey(null);
      toast.error(err?.message ?? "Gagal membaca QR kunci.");
    } finally {
      setScanning(false);
    }
  };

  const canTake = useMemo(() => foundKey?.status === "AVAILABLE", [foundKey]);
  const canReturn = useMemo(() => {
    if (!foundKey || foundKey.status !== "BORROWED") return false;
    return foundKey.currentHolder?.id === user.userId;
  }, [foundKey, user.userId]);

  const handleTake = async () => {
    if (!foundKey) return;
    setActing(true);
    try {
      await api.patch(`/keys/${foundKey.id}/take`, {});
      toast.success(`Kunci ${foundKey.keyCode} berhasil diambil.`);
      await Promise.all([fetchKeys(), refreshFoundKey(foundKey.qrCode || qrCode)]);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengambil kunci.");
    } finally {
      setActing(false);
    }
  };

  const handleReturn = async () => {
    if (!foundKey) return;
    setActing(true);
    try {
      const statusRes = await api.get<{ data: { needsCondition: boolean } }>(`/keys/${foundKey.id}/return-status`);
      if (statusRes.data?.needsCondition) {
        toast.error("Anda harus memvalidasi kondisi lab (foto) sebelum mengembalikan kunci. Gunakan menu Scan QR untuk mengembalikan kunci.");
        return;
      }
      await api.patch(`/keys/${foundKey.id}/return`, {});
      toast.success(`Kunci ${foundKey.keyCode} berhasil dikembalikan.`);
      await Promise.all([fetchKeys(), refreshFoundKey(foundKey.qrCode || qrCode)]);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengembalikan kunci.");
    } finally {
      setActing(false);
    }
  };

  const refreshFoundKey = async (targetQrCode: string) => {
    if (!targetQrCode?.trim()) return;
    try {
      const res = await api.post<{ data: Key }>("/keys/scan", { qrCode: targetQrCode.trim() });
      setFoundKey(res.data ?? null);
    } catch {
      setFoundKey(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="neo-card p-4 sm:p-6 bg-white">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#f3701e] text-white neo-border-sm flex items-center justify-center">
            <TbQrcode size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#1a1a1a]">Ambil/Kembalikan Kunci</h1>
            <p className="text-sm text-[#5a5a5a] mt-1">Masukkan kode QR kunci untuk cek status lalu ambil atau kembalikan.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="neo-card p-5 bg-white space-y-4">
          <h2 className="font-heading text-xl text-[#1a1a1a] flex items-center gap-2">
            <TbSearch size={20} strokeWidth={2.2} />
            Scan Kode QR
          </h2>
          <form onSubmit={scanQrCode} className="space-y-3">
            <input
              required
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Masukkan QR code..."
              className="w-full px-4 py-3 neo-border-sm rounded-lg text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={scanning}
              className="neo-btn px-4 py-2.5 bg-[#4b607f] text-white font-semibold"
            >
              {scanning ? "Memindai..." : "Scan"}
            </button>
          </form>

          {foundKey && (
            <div className="neo-border-sm rounded-lg p-4 bg-[#fcf8f4] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#5a5a5a]">Kode Kunci</p>
                  <p className="font-semibold text-[#1a1a1a]">{foundKey.keyCode}</p>
                </div>
                <span className={`neo-badge px-2 py-1 text-xs ${statusMap[foundKey.status].classes}`}>
                  {statusMap[foundKey.status].label}
                </span>
              </div>
              <p className="text-sm text-[#1a1a1a] flex items-center gap-1">
                <TbBuildingWarehouse size={16} strokeWidth={2.2} />
                {foundKey.lab?.name ?? "Lab tidak diketahui"}
              </p>
              <p className="text-sm text-[#1a1a1a] flex items-center gap-1">
                <TbUser size={16} strokeWidth={2.2} />
                {foundKey.currentHolder?.name ? `Pemegang: ${foundKey.currentHolder.name}` : "Belum ada pemegang"}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                {canTake && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={handleTake}
                    className="neo-btn px-4 py-2.5 bg-[#4b607f] text-white font-semibold inline-flex items-center gap-2"
                  >
                    <TbKey size={16} strokeWidth={2.2} />
                    {acting ? "Memproses..." : "Ambil Kunci"}
                  </button>
                )}
                {canReturn && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={handleReturn}
                    className="neo-btn px-4 py-2.5 bg-green-500 text-white font-semibold inline-flex items-center gap-2"
                  >
                    <TbArrowBackUp size={16} strokeWidth={2.2} />
                    {acting ? "Memproses..." : "Kembalikan Kunci"}
                  </button>
                )}
                {!canTake && !canReturn && (
                  <p className="text-xs text-[#5a5a5a] flex items-center gap-1">
                    <TbInfoCircle size={14} strokeWidth={2.2} />
                    Tidak ada aksi yang bisa dilakukan untuk kunci ini.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="neo-card p-5 bg-white space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-xl text-[#1a1a1a]">Daftar Semua Kunci</h2>
            <button
              type="button"
              onClick={fetchKeys}
              className="neo-btn px-3 py-2 text-sm bg-white inline-flex items-center gap-1"
            >
              <TbRefresh size={16} strokeWidth={2.2} />
              Refresh
            </button>
          </div>

          {loadingList && <p className="text-sm text-[#5a5a5a]">Memuat daftar kunci...</p>}

          {!loadingList && keys.length === 0 && (
            <p className="text-sm text-[#5a5a5a]">Belum ada data kunci.</p>
          )}

          {!loadingList && keys.length > 0 && (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {keys.map((key) => (
                <div key={key.id} className="neo-border-sm rounded-lg p-3 bg-[#fcf8f4]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-[#1a1a1a]">{key.keyCode}</p>
                      <p className="text-xs text-[#5a5a5a]">{key.lab?.name ?? "Lab tidak diketahui"}</p>
                    </div>
                    <span className={`neo-badge px-2 py-1 text-xs ${statusMap[key.status].classes}`}>
                      {statusMap[key.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="neo-card p-4 bg-white">
          <h3 className="font-heading text-lg text-[#1a1a1a] mb-2">Ambil Kunci</h3>
          <p className="text-sm text-[#5a5a5a]">
            Scan kunci dengan status <strong>AVAILABLE</strong>, lalu klik tombol <strong>Ambil Kunci</strong>.
          </p>
        </div>
        <div className="neo-card p-4 bg-white">
          <h3 className="font-heading text-lg text-[#1a1a1a] mb-2">Kembalikan Kunci</h3>
          <p className="text-sm text-[#5a5a5a]">
            Jika kunci dipinjam oleh akun Anda, tombol <strong>Kembalikan Kunci</strong> akan muncul otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}
