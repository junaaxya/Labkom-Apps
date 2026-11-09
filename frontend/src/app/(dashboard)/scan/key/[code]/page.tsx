"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  TbArrowLeft,
  TbBuildingWarehouse,
  TbCalendarEvent,
  TbCamera,
  TbCheck,
  TbClock,
  TbKey,
  TbLoader2,
  TbPhoto,
  TbUser,
  TbX,
  TbZoomIn,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type UserContext = {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
};

type KeyLogItem = {
  id: string;
  action: "TAKEN" | "RETURNED" | "FORCE_RETURNED";
  notes?: string;
  createdAt?: string;
  takenAt?: string;
  returnedAt?: string;
  user?: { id?: string; name?: string };
};

type ScheduleInfo = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  semester?: string;
  className?: string;
  lecturerName?: string;
  type?: string;
};

type KeyScanData = {
  id: string;
  keyCode: string;
  status: "AVAILABLE" | "BORROWED" | "MISSING" | "MAINTENANCE";
  lab?: { id?: string; name?: string; location?: string };
  currentHolder?: { id?: string; name?: string };
  keyLogs?: KeyLogItem[];
  todaySchedules?: ScheduleInfo[];
  activeSchedule?: ScheduleInfo | null;
  currentTime?: string;
};

type ReturnStatus = {
  needsCondition: boolean;
  cycleId?: string | null;
  conditionSubmitted: boolean;
  logbook?: {
    id: string;
    labId: string;
  } | null;
};

type KeyEligibility = {
  keyId: string;
  keyStatus: string;
  canTake: boolean;
  takeReason?: string;
  canReturn: boolean;
  returnReason?: string;
  needsEvidence: boolean;
  activeCycleId?: string | null;
  occurrence?: {
    scheduleId?: string;
    scheduleTitle?: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null;
};

const keyStatusBadge: Record<string, string> = {
  AVAILABLE: "bg-green-500 text-white",
  BORROWED: "bg-[#f3701e] text-white",
  MISSING: "bg-red-500 text-white",
  MAINTENANCE: "bg-yellow-400 text-[#1a1a1a]",
};

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

export default function ScanKeyActionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const toast = useToast();
  const { code } = use(params);

  const [user, setUser] = useState<UserContext>({});
  const [keyData, setKeyData] = useState<KeyScanData | null>(null);
  const [eligibility, setEligibility] = useState<KeyEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Condition validation state
  const [returnStatus, setReturnStatus] = useState<ReturnStatus | null>(null);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [kerusakanBaru, setKerusakanBaru] = useState("");
  const [catatan, setCatatan] = useState("");
  const [submittingCondition, setSubmittingCondition] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const parsed = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(parsed);
    });
  }, []);

  const fetchKeyData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data?: KeyScanData }>(`/qr/scan/key/${code}`);
      if (!res?.data) {
        setKeyData(null);
        setEligibility(null);
        toast.error("Kunci tidak ditemukan.");
        return;
      }
      setKeyData(res.data);

      try {
        const eligRes = await api.get<{ data?: KeyEligibility }>(`/keys/${res.data.id}/eligibility`);
        setEligibility(eligRes.data || null);
      } catch {
        setEligibility(null);
      }
    } catch (err) {
      setKeyData(null);
      setEligibility(null);
      toast.error(errMsg(err, "Kunci tidak ditemukan."));
    } finally {
      setLoading(false);
    }
  }, [code, toast]);

  useEffect(() => {
    queueMicrotask(() => void fetchKeyData());
  }, [fetchKeyData]);

  const currentUserId = user.id || user.userId;
  const currentHolderId = keyData?.currentHolder?.id;
  const isCurrentHolder = Boolean(
    currentUserId && currentHolderId && currentUserId === currentHolderId
  );

  const canTake = Boolean(eligibility?.canTake);
  const canReturn = Boolean(eligibility ? eligibility.canReturn : keyData?.status === "BORROWED" && isCurrentHolder);

  const recentLogs = useMemo(
    () => (keyData?.keyLogs || []).slice(0, 5),
    [keyData?.keyLogs]
  );

  // Check return status when user can return
  useEffect(() => {
    if (!canReturn || !keyData) return;
    (async () => {
      try {
        const res = await api.get<{ data: ReturnStatus }>(
          `/keys/${keyData.id}/return-status`
        );
        setReturnStatus(res.data || null);
      } catch {
        setReturnStatus(null);
      }
    })();
  }, [canReturn, keyData]);

  const handleTake = async () => {
    if (!keyData) return;
    setActing(true);
    try {
      await api.patch(`/keys/${keyData.id}/take`, {});
      toast.success("Kunci berhasil diambil.");
      await fetchKeyData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengambil kunci."));
    } finally {
      setActing(false);
    }
  };

  const handleReturn = async () => {
    if (!keyData) return;

    if (returnStatus?.needsCondition || eligibility?.needsEvidence) {
      setShowConditionForm(true);
      return;
    }

    setActing(true);
    try {
      await api.patch(`/keys/${keyData.id}/return`, {});
       toast.success("Kunci berhasil dikembalikan. Menunggu verifikasi asisten dan checkout resmi.");
      setShowConditionForm(false);
      setReturnStatus(null);
      await fetchKeyData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengembalikan kunci."));
    } finally {
      setActing(false);
    }
  };

  // Photo handling
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      toast.error("Maksimal 5 foto");
      return;
    }
    setPhotos((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const uploadPhotos = async (cycleId?: string): Promise<string[]> => {
    if (photos.length === 0) return [];
    setUploading(true);
    try {
      const fd = new FormData();
      photos.forEach((f) => fd.append("photos", f));
      if (cycleId) fd.append("keyBorrowCycleId", cycleId);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/upload/condition-photos`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Upload gagal");
      return json.data?.urls || json.data || [];
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitConditionAndReturn = async () => {
    if (!keyData) return;
    if (photos.length === 0) {
      toast.error("Ambil minimal 1 foto kondisi lab sebelum mengembalikan kunci.");
      return;
    }

    setSubmittingCondition(true);

    try {
      const cycleId = eligibility?.activeCycleId || returnStatus?.cycleId || undefined;
      const urls = await uploadPhotos(cycleId);

      await api.patch(`/keys/${keyData.id}/return-evidence`, {
        fotoBukti: urls,
      });

      if (returnStatus?.logbook?.id) {
        try {
          await api.patch(`/logbooks/${returnStatus.logbook.id}/condition`, {
            labId: returnStatus.logbook.labId,
            fotoBukti: urls,
            kerusakanBaru: kerusakanBaru.trim() || undefined,
            catatanKondisi: catatan.trim() || undefined,
          });
        } catch {}
      }

      await api.patch(`/keys/${keyData.id}/return`, {});

      toast.success("Kondisi lab berhasil dikirim dan kunci dikembalikan. Menunggu verifikasi asisten dan checkout resmi.");
      setShowConditionForm(false);
      setReturnStatus(null);
      setPhotos([]);
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPreviews([]);
      setKerusakanBaru("");
      setCatatan("");
      await fetchKeyData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal submit kondisi atau mengembalikan kunci."));
    } finally {
      setSubmittingCondition(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="neo-card bg-white p-4 animate-pulse h-14" />
        <div className="neo-card bg-white p-6 animate-pulse h-44" />
        <div className="neo-card bg-white p-6 animate-pulse h-56" />
      </div>
    );
  }

  if (!keyData) {
    return (
      <div className="space-y-4">
        <Link
          href="/scan"
          className="neo-btn inline-flex items-center gap-2 px-4 py-2 bg-white text-[#1a1a1a]"
        >
          <TbArrowLeft size={18} strokeWidth={2.2} />
          Kembali ke Scan
        </Link>
        <div className="neo-card bg-white p-6 text-center space-y-3">
          <p className="text-xl font-bold text-[#1a1a1a]">Kunci tidak ditemukan</p>
          <p className="text-sm text-[#5a5a5a]">Kode kunci tidak valid atau data tidak tersedia.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28 sm:pb-16 max-w-4xl mx-auto">
      <Link
        href="/scan"
        className="neo-btn inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-white text-[#1a1a1a] rounded-xl text-sm font-bold"
      >
        <TbArrowLeft size={18} strokeWidth={2.2} />
        Kembali ke Scan
      </Link>

      {/* Key Info Card */}
      <div className="neo-card bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-[#5a5a5a]">Kode Kunci</p>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[#1a1a1a] tracking-tight">
              {keyData.keyCode}
            </h1>
          </div>
          <span
            className={`neo-badge px-3 py-1 ${keyStatusBadge[keyData.status] || "bg-gray-400 text-white"}`}
          >
            {keyData.status}
          </span>
        </div>

        <p className="text-sm text-[#1a1a1a] inline-flex items-center gap-2">
          <TbBuildingWarehouse size={16} strokeWidth={2.2} />
          {keyData.lab?.name || "Lab tidak diketahui"}
          {keyData.lab?.location ? ` • ${keyData.lab.location}` : ""}
        </p>

        {keyData.status === "BORROWED" && keyData.currentHolder?.name && (
          <p className="text-sm text-[#1a1a1a] inline-flex items-center gap-2">
            <TbUser size={16} strokeWidth={2.2} />
            Sedang dipegang oleh {keyData.currentHolder.name}
          </p>
        )}

        {/* Schedule Info */}
        {keyData.todaySchedules && keyData.todaySchedules.length > 0 && (
          <div className="border-t-2 border-[#e8d8c9] pt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a] flex items-center gap-1.5">
              <TbCalendarEvent size={14} />
              Jadwal Hari Ini — {keyData.lab?.name}
            </p>
            <div className="space-y-2">
              {keyData.todaySchedules.map((s) => {
                const isActive = keyData.activeSchedule?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border-2 px-4 py-3 transition-all ${
                      isActive
                        ? "border-[#f3701e] bg-[#fff8f3] shadow-[3px_3px_0px_#f3701e]"
                        : "border-[#e0d5ca] bg-[#f5ede6]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className={`font-heading font-bold text-sm ${isActive ? "text-[#f3701e]" : "text-[#1a1a1a]"}`}>
                          {s.title}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[#5a5a5a]">
                          {s.className && <span>{s.className}</span>}
                          {s.semester && <span>Semester {s.semester}</span>}
                          {s.lecturerName && <span>{s.lecturerName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <TbClock size={14} className={isActive ? "text-[#f3701e]" : "text-[#5a5a5a]"} />
                        <span className={`text-sm font-mono font-bold ${isActive ? "text-[#f3701e]" : "text-[#1a1a1a]"}`}>
                          {s.startTime} - {s.endTime}
                        </span>
                      </div>
                    </div>
                    {isActive && (
                      <p className="text-xs font-semibold text-[#f3701e] mt-1.5">
                        ● Sedang berlangsung
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {!keyData.activeSchedule && (
              <p className="text-xs text-[#5a5a5a] italic">
                Tidak ada jadwal yang sedang berlangsung saat ini ({keyData.currentTime}).
                Kunci bisa diambil 30 menit sebelum jadwal dimulai.
              </p>
            )}
          </div>
        )}

        {keyData.todaySchedules && keyData.todaySchedules.length === 0 && (
          <div className="border-t-2 border-[#e8d8c9] pt-4">
            <p className="text-xs text-[#5a5a5a] italic flex items-center gap-1.5">
              <TbCalendarEvent size={14} />
              Tidak ada jadwal untuk lab ini hari ini.
            </p>
          </div>
        )}

        <div className="pt-1">
          {canTake && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#4b607f]">
                PJ aktif untuk jadwal ini atau Ketua Kelas dapat mengambil kunci setelah Asisten Lab check-in.
              </p>
              <button
                type="button"
                onClick={handleTake}
                disabled={acting}
                className="neo-btn w-full sm:w-auto px-5 py-3 min-h-[48px] bg-[#4b607f] text-white inline-flex items-center justify-center gap-2 text-sm font-bold rounded-xl"
              >
                {acting ? (
                  <TbLoader2 className="animate-spin" size={18} />
                ) : (
                  <TbKey size={18} />
                )}
                {acting ? "Memproses..." : "Ambil Kunci"}
              </button>
            </div>
          )}

          {!canTake && keyData.status === "AVAILABLE" && eligibility?.takeReason && (
            <p className="text-sm font-medium text-[#5a5a5a] bg-[#f5ede6] p-3 rounded-xl border border-[#e8d8c9]">
              {eligibility.takeReason}
            </p>
          )}

          {canReturn && !showConditionForm && (
            <button
              type="button"
              onClick={handleReturn}
              disabled={acting}
              className="neo-btn w-full sm:w-auto px-5 py-3 min-h-[48px] bg-[#f3701e] text-white inline-flex items-center justify-center gap-2 text-sm font-bold rounded-xl"
            >
              {acting ? (
                <TbLoader2 className="animate-spin" size={18} />
              ) : (
                <TbCheck size={18} />
              )}
              {acting ? "Memproses..." : "Kembalikan Kunci"}
            </button>
          )}

          {keyData.status === "BORROWED" &&
            !isCurrentHolder &&
            keyData.currentHolder?.name && (
              <p className="text-sm font-medium text-[#5a5a5a] bg-[#f5ede6] p-3 rounded-xl border border-[#e8d8c9]">
                Kunci sedang dipinjam oleh {keyData.currentHolder.name}
              </p>
            )}
        </div>
      </div>

      {/* Condition Validation Form — shown when returning requires condition */}
      {showConditionForm && (returnStatus?.needsCondition || eligibility?.needsEvidence || Boolean(returnStatus?.cycleId)) && (
        <div className="neo-card bg-white p-5 sm:p-6 space-y-5 rounded-2xl border-2 border-[#f3701e] shadow-[4px_4px_0px_#f3701e]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f3701e]/10 text-[#f3701e] text-xs font-bold mb-2">
              <span>📸</span>
              <span>Validasi Pengembalian Kunci</span>
            </div>
            <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">
              Submit Kondisi Lab
            </h2>
            <p className="text-sm text-[#5a5a5a] mt-1">
              Kirimkan foto bukti kondisi lab setelah selesai kegiatan. Verifikasi asisten dan checkout resmi dilakukan setelahnya.
            </p>
          </div>

          {/* Photo Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[#1a1a1a]">
                Foto Kondisi Lab <span className="text-[#f3701e]">*</span>
              </label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f5ede6] text-[#5a5a5a]">
                {photos.length}/5 foto
              </span>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-[#1a1a1a] shadow-sm bg-[#1a1a1a]/5 aspect-video sm:aspect-square">
                    <button
                      type="button"
                      onClick={() => setZoomPhoto(src)}
                      className="w-full h-full block focus:outline-none"
                      title="Lihat foto lebih besar"
                    >
                      <Image
                        src={src}
                        alt={`Foto kondisi ${i + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <TbZoomIn size={20} />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(i);
                      }}
                      className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-md z-10 transition-transform"
                      aria-label={`Hapus foto ${i + 1}`}
                    >
                      <TbX size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < 5 && (
              <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="neo-btn min-h-[44px] px-4 py-2.5 bg-[#4b607f] text-white inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl"
                >
                  <TbCamera size={18} />
                  <span>Buka Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="neo-btn min-h-[44px] px-4 py-2.5 bg-[#f5ede6] text-[#1a1a1a] inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-xl"
                >
                  <TbPhoto size={18} />
                  <span>Pilih Galeri</span>
                </button>
              </div>
            )}

            {/* Camera input — langsung buka kamera HP */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            {/* Gallery input — pilih dari galeri */}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          {/* Kerusakan Baru */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a1a1a]">
              Kerusakan Baru (opsional)
            </label>
            <textarea
              rows={3}
              value={kerusakanBaru}
              onChange={(e) => setKerusakanBaru(e.target.value)}
              placeholder="Contoh: Mouse PC-05 rusak, AC bocor, kabel LAN kendor..."
              className="neo-input w-full resize-none text-sm p-3 rounded-xl border-2 border-[#1a1a1a] placeholder:text-[#5a5a5a]"
            />
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a1a1a]">
              Catatan Kondisi Ruangan (opsional)
            </label>
            <textarea
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Tuliskan catatan kebersihan, barang tertinggal, atau informasi lain..."
              className="neo-input w-full resize-none text-sm p-3 rounded-xl border-2 border-[#1a1a1a] placeholder:text-[#5a5a5a]"
            />
          </div>

          {/* Submit + Return Button */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmitConditionAndReturn}
              disabled={submittingCondition || uploading || photos.length === 0}
              className="neo-btn w-full sm:w-auto min-h-[48px] px-6 py-3 bg-[#f3701e] text-white inline-flex items-center justify-center gap-2 text-sm font-bold rounded-xl disabled:opacity-50"
            >
              {submittingCondition || uploading ? (
                <TbLoader2 className="animate-spin" size={18} />
              ) : (
                <TbCheck size={18} />
              )}
              {uploading
                ? "Mengupload foto bukti..."
                : submittingCondition
                  ? "Menyerahkan kondisi..."
                  : "Kirim Kondisi & Serahkan Kunci"}
            </button>

            <button
              type="button"
              onClick={() => setShowConditionForm(false)}
              className="neo-btn w-full sm:w-auto min-h-[48px] px-5 py-3 bg-white text-[#1a1a1a] inline-flex items-center justify-center text-sm font-bold rounded-xl"
            >
              Batal
            </button>
          </div>

          <p className="text-xs text-[#5a5a5a] bg-[#f5ede6] p-3 rounded-xl border border-[#e8d8c9] flex items-start gap-2 leading-relaxed">
            <span className="text-sm shrink-0">ℹ️</span>
            <span>
              <strong>Alur Verifikasi:</strong> Menyerahkan form ini mencatat kondisi akhir lab yang Anda gunakan. Kunci fisik harus diserahkan kepada Asisten Lab yang bertugas untuk verifikasi fisik ruangan dan checkout resmi di logbook.
            </span>
          </p>

          {photos.length === 0 && (
            <p className="text-xs text-[#f3701e] font-semibold flex items-center gap-1.5">
              <TbPhoto size={14} />
              Ambil minimal 1 foto kondisi lab untuk dapat mengirimkan form
            </p>
          )}
        </div>
      )}

      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden border-2 border-[#1a1a1a] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#1a1a1a] bg-[#f5ede6]">
              <span className="text-sm font-bold text-[#1a1a1a]">Preview Foto Kondisi</span>
              <button
                type="button"
                onClick={() => setZoomPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-black/10 text-[#1a1a1a] transition-colors"
                aria-label="Tutup preview foto"
              >
                <TbX size={18} />
              </button>
            </div>
            <div className="p-3 bg-[#1a1a1a]/5 flex justify-center">
              <Image
                src={zoomPhoto}
                alt="Preview foto kondisi lab"
                width={600}
                height={450}
                unoptimized
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Key Logs */}
      <div className="neo-card bg-white p-6">
        <h2 className="font-heading text-xl text-[#1a1a1a] mb-4">
          Riwayat Kunci Terbaru
        </h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-[#5a5a5a]">
            Belum ada log peminjaman/pengembalian.
          </p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => {
              const actionLabel =
                log.action === "TAKEN" ? "Diambil" : "Dikembalikan";
              const eventTime = log.returnedAt || log.takenAt || log.createdAt;
              return (
                <div
                  key={log.id}
                  className="neo-border-sm rounded-lg p-3 bg-[#fcf8f4]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#1a1a1a]">{actionLabel}</p>
                    <p className="text-xs text-[#5a5a5a]">{formatDate(eventTime)}</p>
                  </div>
                  <p className="text-sm text-[#4b607f]">
                    {log.user?.name || "Pengguna tidak diketahui"}
                  </p>
                  {log.notes ? (
                    <p className="text-xs text-[#5a5a5a] mt-1">
                      Catatan: {log.notes}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
