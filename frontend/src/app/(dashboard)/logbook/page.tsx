"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import {
  TbArrowRight,
  TbBook2,
  TbCheck,
  TbCircleCheck,
  TbClock,
  TbKey,
  TbLogin2,
  TbLogout2,
  TbPhoto,
  TbShieldCheck,
  TbUser,
  TbX,
} from "react-icons/tb";

type Role = "ASISTEN_LAB" | "KOORDINATOR_LAB" | string;

type UserLite = {
  id?: string;
  name?: string;
};

type LabLite = {
  id: string;
  name?: string;
};

type ScheduleInfo = {
  id: string;
  title: string;
  lecturerName?: string | null;
  className?: string | null;
  semester?: string | null;
  startTime: string;
  endTime: string;
  type?: string | null;
};

type KeyLogInfo = {
  id: string;
  action: "TAKEN" | "RETURNED";
  user: UserLite;
  keyCode: string;
  createdAt: string;
  notes?: string | null;
};

type LogbookCondition = {
  id: string;
  logbookId: string;
  labId: string;
  kerusakanBaru?: string | null;
  catatanKondisi?: string | null;
  fotoBukti: string[];
  verified: boolean;
  verifiedAt?: string | null;
  verifiedBy?: UserLite | null;
  submittedBy?: UserLite | null;
  lab?: LabLite | null;
  schedules?: ScheduleInfo[];
  keyLogs?: KeyLogInfo[];
};

type Logbook = {
  id: string;
  date?: string;
  status?: string;
  officialCheckinAt?: string | null;
  officialCheckoutAt?: string | null;
  officialCheckinBy?: UserLite | null;
  officialCheckoutBy?: UserLite | null;
  notes?: string | null;
  conditions?: LogbookCondition[];
  allKeysReturned?: boolean;
  keysReturned?: boolean;
  keyReturned?: boolean;
  isKeyReturned?: boolean;
  canCheckout?: boolean;
  canCheckOut?: boolean;
  checkoutAllowed?: boolean;
};

type PaginatedLogbookResponse = {
  data?: Logbook[];
  items?: Logbook[];
  page?: number;
  totalPages?: number;
  total?: number;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:5000";

function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const payload = raw as { data?: unknown; items?: unknown };
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
  }
  return [];
}

function toPhotoUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pickBoolean(...values: Array<unknown>): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function ConditionCard({
  condition,
  canVerify,
  isVerifying,
  confirmVerify,
  setConfirmVerify,
  onVerify,
  onOpenPhoto,
}: {
  condition: LogbookCondition;
  canVerify: boolean;
  isVerifying: boolean;
  confirmVerify: boolean;
  setConfirmVerify: (value: boolean) => void;
  onVerify: () => Promise<void>;
  onOpenPhoto: (src: string) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 shadow-[4px_4px_0px_#1a1a1a]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-heading text-lg font-bold text-[#1a1a1a]">
            {condition.lab?.name || "Lab"}
          </p>
          <p className="text-xs font-medium text-[#5a5a5a]">
            Disubmit oleh: {condition.submittedBy?.name || "-"}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-lg border-2 border-[#1a1a1a] px-3 py-1 text-xs font-bold shadow-[2px_2px_0px_#1a1a1a] ${
            condition.verified ? "bg-green-500 text-white" : "bg-[#f3701e] text-white"
          }`}
        >
          {condition.verified ? <TbCheck size={14} /> : <TbClock size={14} />}
          {condition.verified ? "Terverifikasi" : "Menunggu Verifikasi"}
        </span>
      </div>

      {(condition.schedules?.length ?? 0) > 0 && (
        <div className="mb-3 rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] p-3">
          <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#4b607f]">
            <TbBook2 size={14} /> Jadwal Hari Ini
          </p>
          <div className="space-y-1.5">
            {condition.schedules!.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-[#1a1a1a]">
                <span className="font-bold">{s.title}</span>
                {s.lecturerName && <span className="text-xs text-[#5a5a5a]">Dosen: {s.lecturerName}</span>}
                {s.className && <span className="text-xs text-[#5a5a5a]">Kelas: {s.className}</span>}
                {s.semester && <span className="text-xs text-[#5a5a5a]">Sem {s.semester}</span>}
                <span className="text-xs font-medium text-[#4b607f]">{s.startTime} - {s.endTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(condition.keyLogs?.length ?? 0) > 0 && (
        <div className="mb-3 rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] p-3">
          <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#4b607f]">
            <TbKey size={14} /> Riwayat Kunci
          </p>
          <div className="space-y-1">
            {condition.keyLogs!.map((kl) => (
              <div key={kl.id} className="flex items-center gap-2 text-xs text-[#1a1a1a]">
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold ${
                  kl.action === "TAKEN" ? "bg-[#f3701e]/15 text-[#f3701e]" : "bg-green-100 text-green-700"
                }`}>
                  {kl.action === "TAKEN" ? "Ambil" : "Kembali"}
                </span>
                <TbUser size={12} />
                <span className="font-medium">{kl.user?.name || "-"}</span>
                <TbArrowRight size={10} className="text-[#5a5a5a]" />
                <span className="text-[#5a5a5a]">{kl.keyCode}</span>
                <span className="ml-auto text-[#5a5a5a]">
                  {new Date(kl.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(condition.kerusakanBaru || condition.catatanKondisi) && (
        <div className="mb-3 space-y-2">
          {condition.kerusakanBaru && (
            <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#fff3ec] p-2 text-sm font-medium text-[#1a1a1a]">
              <span className="font-bold">Kerusakan Baru:</span> {condition.kerusakanBaru}
            </div>
          )}
          {condition.catatanKondisi && (
            <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] p-2 text-sm font-medium text-[#1a1a1a]">
              <span className="font-bold">Catatan:</span> {condition.catatanKondisi}
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        <p className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-[#1a1a1a]">
          <TbPhoto size={16} /> Foto Bukti
        </p>
        {condition.fotoBukti?.length ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {condition.fotoBukti.map((photo, index) => (
              <button
                key={`${condition.id}-photo-${index}`}
                type="button"
                onClick={() => onOpenPhoto(toPhotoUrl(photo))}
                className="overflow-hidden rounded-lg border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]"
              >
                <img
                  src={toPhotoUrl(photo)}
                  alt={`Foto kondisi ${index + 1}`}
                  className="max-h-32 w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-[#1a1a1a] bg-[#f7f2ed] p-3 text-sm font-medium text-[#5a5a5a]">
            Tidak ada foto.
          </div>
        )}
      </div>

      {condition.verified ? (
        <div className="rounded-lg border-2 border-[#1a1a1a] bg-green-50 p-2 text-xs font-bold text-green-700">
          Diverifikasi pada {formatDateTime(condition.verifiedAt || undefined)}
        </div>
      ) : canVerify ? (
        <div className="space-y-2">
          {confirmVerify ? (
            <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#fff3ec] p-3">
              <p className="mb-2 text-sm font-bold text-[#1a1a1a]">Verifikasi kondisi ini?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={onVerify}
                  className="rounded-lg border-2 border-[#1a1a1a] bg-[#4b607f] px-3 py-2 text-xs font-bold text-white shadow-[2px_2px_0px_#1a1a1a] disabled:opacity-60"
                >
                  {isVerifying ? "Memproses..." : "Ya, Verifikasi"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmVerify(false)}
                  className="rounded-lg border-2 border-[#1a1a1a] bg-white px-3 py-2 text-xs font-bold text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmVerify(true)}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1a1a1a] bg-[#f3701e] px-3 py-2 text-xs font-bold text-white shadow-[2px_2px_0px_#1a1a1a]"
            >
              <TbShieldCheck size={16} /> Verifikasi Kondisi
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function LogbookPage() {
  const toast = useToast();
  const [role, setRole] = useState<Role>("");

  const [loading, setLoading] = useState(true);

  const [todayLogbook, setTodayLogbook] = useState<Logbook | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [confirmCheckout, setConfirmCheckout] = useState(false);
  const [verifyingConditionId, setVerifyingConditionId] = useState<string | null>(null);
  const [confirmVerifyId, setConfirmVerifyId] = useState<string | null>(null);

  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [logbooks, setLogbooks] = useState<Logbook[]>([]);
  const [selectedLogbook, setSelectedLogbook] = useState<Logbook | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string>("");

  useEffect(() => {
    const parsed = JSON.parse(localStorage.getItem("user") || "{}");
    setRole(parsed.role || "");
  }, []);

  const isAsleb = role === "ASISTEN_LAB";
  const isKoordinator = role === "KOORDINATOR_LAB";

  const fetchTodayLogbook = async () => {
    try {
      const response = await api.get<{ data?: Logbook }>("/logbooks/today");
      const payload = (response?.data as unknown as { data?: Logbook })?.data || response?.data;
      setTodayLogbook(payload || null);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setTodayLogbook(null);
        return;
      }
      throw err;
    }
  };

  const fetchLogbookList = async (page = 1) => {
    const response = await api.get<PaginatedLogbookResponse>(`/logbooks?page=${page}&limit=10`);
    const payload = response?.data as unknown as PaginatedLogbookResponse;
    const items = asArray<Logbook>(payload);
    setLogbooks(items);
    setListPage(payload.page || page);
    setListTotalPages(payload.totalPages || 1);
  };

  const fetchLogbookDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await api.get<{ data?: Logbook }>(`/logbooks/${id}`);
      const payload = (response?.data as unknown as { data?: Logbook })?.data || response?.data;
      if (payload) setSelectedLogbook(payload);
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat detail logbook.");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadData = async () => {
    if (!role) return;
    setLoading(true);
    try {
      if (isAsleb) {
        await fetchTodayLogbook();
      } else if (isKoordinator) {
        await fetchLogbookList(1);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat data logbook.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  const activeDetail = isAsleb ? todayLogbook : selectedLogbook;
  const allConditionsVerified = useMemo(
    () => (activeDetail?.conditions || []).every((condition) => condition.verified),
    [activeDetail]
  );

  const keyReturned = useMemo(() => {
    if (!activeDetail) return false;
    // Check explicit boolean fields from backend first
    const explicit = pickBoolean(
      activeDetail.allKeysReturned,
      activeDetail.keysReturned,
      activeDetail.keyReturned,
      activeDetail.isKeyReturned
    );
    if (typeof explicit === "boolean") return explicit;
    // Compute from keyLogs in conditions: if any key was TAKEN, check all are RETURNED
    const conditions = activeDetail.conditions || [];
    const allKeyLogs = conditions.flatMap((c) => c.keyLogs || []);
    if (allKeyLogs.length === 0) return true; // No keys involved
    const takenKeys = new Set(allKeyLogs.filter((kl) => kl.action === "TAKEN").map((kl) => kl.keyCode));
    const returnedKeys = new Set(allKeyLogs.filter((kl) => kl.action === "RETURNED").map((kl) => kl.keyCode));
    if (takenKeys.size === 0) return true; // No keys taken
    for (const key of takenKeys) {
      if (!returnedKeys.has(key)) return false;
    }
    return true;
  }, [activeDetail]);

  const checkoutAllowed = useMemo(() => {
    if (!activeDetail) return false;
    const eligibility = pickBoolean(
      activeDetail.canCheckout,
      activeDetail.canCheckOut,
      activeDetail.checkoutAllowed
    );

    if (typeof eligibility === "boolean") return eligibility;
    if (typeof keyReturned === "boolean") return keyReturned && allConditionsVerified;
    return allConditionsVerified;
  }, [activeDetail, allConditionsVerified, keyReturned]);

  const handleCheckin = async () => {
    setCheckingIn(true);
    try {
      await api.post("/logbooks/checkin", {});
      await fetchTodayLogbook();
    } catch (err: any) {
      toast.error(err?.message || "Gagal check-in hari ini.");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleVerifyCondition = async (conditionId: string) => {
    setVerifyingConditionId(conditionId);
    try {
      await api.patch(`/logbooks/conditions/${conditionId}/verify`, {});
      if (isAsleb) {
        await fetchTodayLogbook();
      } else if (selectedLogbook?.id) {
        await fetchLogbookDetail(selectedLogbook.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal verifikasi kondisi.");
    } finally {
      setVerifyingConditionId(null);
      setConfirmVerifyId(null);
    }
  };

  const handleCheckout = async () => {
    if (!todayLogbook) return;
    setCheckingOut(true);
    try {
      await api.patch(`/logbooks/${todayLogbook.id}/checkout`, {});
      setConfirmCheckout(false);
      await fetchTodayLogbook();
    } catch (err: any) {
      toast.error(err?.message || "Gagal checkout sesi hari ini.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-xl border-2 border-[#1a1a1a] bg-[#e8d8c9] p-6 shadow-[4px_4px_0px_#1a1a1a]">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Daily Logbook</h1>
        <p className="mt-1 text-sm font-medium text-[#5a5a5a]">
          {isAsleb
            ? "Check-in harian, verifikasi kondisi per lab, lalu checkout sesi."
            : isKoordinator
              ? "Pantau semua logbook harian dan verifikasi kondisi per lab."
              : "Halaman ini hanya tersedia untuk Asisten Lab dan Koordinator Lab."}
        </p>
      </section>

      {loading ? (
        <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-10 text-center text-sm font-bold text-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a]">
          Memuat data logbook...
        </div>
      ) : isAsleb ? (
        <section className="space-y-4">
          {!todayLogbook ? (
            <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-6 shadow-[4px_4px_0px_#1a1a1a]">
              <p className="mb-4 text-sm font-medium text-[#5a5a5a]">
                Belum ada sesi logbook untuk hari ini.
              </p>
              <button
                type="button"
                disabled={checkingIn}
                onClick={handleCheckin}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1a1a1a] bg-[#4b607f] px-4 py-2 font-bold text-white shadow-[4px_4px_0px_#1a1a1a] disabled:opacity-60"
              >
                <TbLogin2 size={18} />
                {checkingIn ? "Memproses..." : "Check-in Hari Ini"}
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-5 shadow-[4px_4px_0px_#1a1a1a]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-xl font-bold text-[#1a1a1a]">Sesi Hari Ini</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#5a5a5a]">
                      <TbClock size={16} /> Check-in: {formatTime(todayLogbook.officialCheckinAt)}
                    </p>
                  </div>
                  <span className="rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] px-3 py-1 text-xs font-bold text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                    Status: {todayLogbook.status || "CHECKED_IN"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-xs font-semibold text-[#1a1a1a] md:grid-cols-2">
                  <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] p-2">
                    Semua kondisi terverifikasi: {allConditionsVerified ? "Ya" : "Belum"}
                  </div>
                  <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] p-2">
                    Semua kunci kembali: {typeof keyReturned === "boolean" ? (keyReturned ? "Ya" : "Belum") : "-"}
                  </div>
                </div>

                {todayLogbook.officialCheckoutAt ? (
                  <div className="mt-4 rounded-lg border-2 border-[#1a1a1a] bg-green-50 p-3 text-sm font-bold text-green-700">
                    Checkout selesai pada {formatDateTime(todayLogbook.officialCheckoutAt)}.
                  </div>
                ) : (
                  <div className="mt-4">
                    {confirmCheckout ? (
                      <div className="rounded-xl border-2 border-[#1a1a1a] bg-[#fff3ec] p-3">
                        <p className="mb-2 text-sm font-bold text-[#1a1a1a]">
                          Lanjut checkout sesi hari ini?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={checkingOut || !checkoutAllowed}
                            onClick={handleCheckout}
                            className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1a1a1a] bg-[#f3701e] px-3 py-2 text-xs font-bold text-white shadow-[2px_2px_0px_#1a1a1a] disabled:opacity-60"
                          >
                            <TbLogout2 size={16} /> {checkingOut ? "Memproses..." : "Ya, Checkout"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCheckout(false)}
                            className="rounded-lg border-2 border-[#1a1a1a] bg-white px-3 py-2 text-xs font-bold text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!checkoutAllowed || checkingOut}
                        onClick={() => setConfirmCheckout(true)}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1a1a1a] bg-[#f3701e] px-4 py-2 font-bold text-white shadow-[4px_4px_0px_#1a1a1a] disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <TbLogout2 size={18} /> Checkout Hari Ini
                      </button>
                    )}
                    {!checkoutAllowed && (
                      <p className="mt-2 text-xs font-bold text-[#5a5a5a]">
                        Checkout aktif setelah semua kondisi terverifikasi dan semua kunci sudah kembali.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Timeline Flow */}
              <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-5 shadow-[4px_4px_0px_#1a1a1a]">
                <p className="font-heading text-lg font-bold text-[#1a1a1a] mb-4">Timeline Sesi</p>
                <div className="flex items-start gap-0 overflow-x-auto pb-2">
                  {[
                    {
                      label: "Check-in",
                      icon: TbLogin2,
                      done: true,
                      time: formatTime(todayLogbook.officialCheckinAt),
                    },
                    {
                      label: "Kunci Diambil",
                      icon: TbKey,
                      done: (todayLogbook.conditions || []).length > 0,
                      time: (todayLogbook.conditions || []).length > 0 ? "✓" : "Menunggu",
                    },
                    {
                      label: "Kondisi Disubmit",
                      icon: TbPhoto,
                      done: (todayLogbook.conditions || []).length > 0,
                      time: (todayLogbook.conditions || []).length > 0
                        ? `${(todayLogbook.conditions || []).length} lab`
                        : "Menunggu",
                    },
                    {
                      label: "Kunci Kembali",
                      icon: TbKey,
                      done: typeof keyReturned === "boolean" ? keyReturned : false,
                      time: keyReturned ? "✓" : "Menunggu",
                    },
                    {
                      label: "Terverifikasi",
                      icon: TbShieldCheck,
                      done: allConditionsVerified && (todayLogbook.conditions || []).length > 0,
                      time: allConditionsVerified && (todayLogbook.conditions || []).length > 0
                        ? "✓"
                        : `${(todayLogbook.conditions || []).filter((c) => c.verified).length}/${(todayLogbook.conditions || []).length}`,
                    },
                    {
                      label: "Checkout",
                      icon: TbLogout2,
                      done: Boolean(todayLogbook.officialCheckoutAt),
                      time: todayLogbook.officialCheckoutAt
                        ? formatTime(todayLogbook.officialCheckoutAt)
                        : "Menunggu",
                    },
                  ].map((step, i, arr) => (
                    <div key={step.label} className="flex items-start shrink-0">
                      <div className="flex flex-col items-center w-20">
                        <div
                          className={`w-10 h-10 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center shadow-[2px_2px_0px_#1a1a1a] ${
                            step.done
                              ? "bg-green-500 text-white"
                              : "bg-[#f5ede6] text-[#5a5a5a]"
                          }`}
                        >
                          {step.done ? <TbCircleCheck size={20} /> : <step.icon size={18} />}
                        </div>
                        <p className="text-[10px] font-bold text-[#1a1a1a] mt-1.5 text-center leading-tight">
                          {step.label}
                        </p>
                        <p className={`text-[10px] mt-0.5 text-center ${step.done ? "text-green-600 font-bold" : "text-[#5a5a5a]"}`}>
                          {step.time}
                        </p>
                      </div>
                      {i < arr.length - 1 && (
                        <div className={`h-0.5 w-6 mt-5 shrink-0 ${step.done ? "bg-green-500" : "bg-[#d0c5b8]"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">
                  Kondisi Per Lab
                </h2>
                {(todayLogbook.conditions || []).length ? (
                  (todayLogbook.conditions || []).map((condition) => (
                    <ConditionCard
                      key={condition.id}
                      condition={condition}
                      canVerify={true}
                      isVerifying={verifyingConditionId === condition.id}
                      confirmVerify={confirmVerifyId === condition.id}
                      setConfirmVerify={(value) =>
                        setConfirmVerifyId(value ? condition.id : null)
                      }
                      onVerify={async () => handleVerifyCondition(condition.id)}
                      onOpenPhoto={setPhotoPreview}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 text-sm font-medium text-[#5a5a5a] shadow-[4px_4px_0px_#1a1a1a]">
                    Belum ada kondisi yang disubmit untuk sesi hari ini.
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      ) : isKoordinator ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 shadow-[4px_4px_0px_#1a1a1a]">
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Daftar Logbook</h2>
              <p className="text-xs font-medium text-[#5a5a5a]">
                Klik satu item untuk melihat detail dan verifikasi kondisi.
              </p>
            </div>

            {(logbooks || []).length ? (
              logbooks.map((logbook) => (
                <button
                  key={logbook.id}
                  type="button"
                  onClick={() => fetchLogbookDetail(logbook.id)}
                  className={`w-full rounded-xl border-2 border-[#1a1a1a] bg-white p-4 text-left shadow-[4px_4px_0px_#1a1a1a] transition hover:translate-x-[1px] hover:translate-y-[1px] ${
                    selectedLogbook?.id === logbook.id ? "ring-2 ring-[#f3701e]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-base font-bold text-[#1a1a1a]">
                      {logbook.officialCheckinBy?.name || "Asleb"}
                    </p>
                    <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                      logbook.status === "COMPLETED"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-[#f3701e] bg-[#fff3ec] text-[#f3701e]"
                    }`}>
                      {logbook.status || "CHECKED_IN"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#5a5a5a]">
                    {logbook.date ? new Date(logbook.date).toLocaleDateString("id-ID", { dateStyle: "long" }) : "-"} · Check-in {formatTime(logbook.officialCheckinAt)}
                    {logbook.officialCheckoutAt ? ` · Checkout ${formatTime(logbook.officialCheckoutAt)}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#5a5a5a]">
                    {(logbook.conditions || []).length} kondisi lab · {(logbook.conditions || []).filter((c) => c.verified).length} terverifikasi
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 text-sm font-medium text-[#5a5a5a] shadow-[4px_4px_0px_#1a1a1a]">
                Belum ada logbook.
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[4px_4px_0px_#1a1a1a]">
              <button
                type="button"
                disabled={listPage <= 1}
                onClick={() => fetchLogbookList(listPage - 1)}
                className="rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] px-3 py-1 text-xs font-bold text-[#1a1a1a] disabled:opacity-50"
              >
                Prev
              </button>
              <p className="text-xs font-bold text-[#1a1a1a]">
                Halaman {listPage} / {listTotalPages}
              </p>
              <button
                type="button"
                disabled={listPage >= listTotalPages}
                onClick={() => fetchLogbookList(listPage + 1)}
                className="rounded-lg border-2 border-[#1a1a1a] bg-[#f7f2ed] px-3 py-1 text-xs font-bold text-[#1a1a1a] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 shadow-[4px_4px_0px_#1a1a1a]">
              <h3 className="font-heading text-xl font-bold text-[#1a1a1a]">Detail Logbook</h3>
            </div>

            {detailLoading ? (
              <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 text-sm font-bold text-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a]">
                Memuat detail...
              </div>
            ) : !selectedLogbook ? (
              <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 text-sm font-medium text-[#5a5a5a] shadow-[4px_4px_0px_#1a1a1a]">
                Pilih logbook dari daftar.
              </div>
            ) : (
              <>
                <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 shadow-[4px_4px_0px_#1a1a1a]">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-heading text-lg font-bold text-[#1a1a1a]">
                      {selectedLogbook.officialCheckinBy?.name || "Asleb"}
                    </p>
                    <span className={`rounded-lg border-2 border-[#1a1a1a] px-2.5 py-0.5 text-xs font-bold shadow-[2px_2px_0px_#1a1a1a] ${
                      selectedLogbook.status === "COMPLETED" ? "bg-green-500 text-white" : "bg-[#f3701e] text-white"
                    }`}>
                      {selectedLogbook.status || "CHECKED_IN"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-[#d0c5b8] bg-[#f7f2ed] p-2">
                      <p className="font-semibold text-[#5a5a5a]">Tanggal</p>
                      <p className="font-bold text-[#1a1a1a]">
                        {selectedLogbook.date ? new Date(selectedLogbook.date).toLocaleDateString("id-ID", { dateStyle: "long" }) : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#d0c5b8] bg-[#f7f2ed] p-2">
                      <p className="font-semibold text-[#5a5a5a]">Check-in</p>
                      <p className="font-bold text-[#1a1a1a]">{formatTime(selectedLogbook.officialCheckinAt)}</p>
                    </div>
                    <div className="rounded-lg border border-[#d0c5b8] bg-[#f7f2ed] p-2">
                      <p className="font-semibold text-[#5a5a5a]">Checkout</p>
                      <p className="font-bold text-[#1a1a1a]">{formatTime(selectedLogbook.officialCheckoutAt)}</p>
                    </div>
                    <div className="rounded-lg border border-[#d0c5b8] bg-[#f7f2ed] p-2">
                      <p className="font-semibold text-[#5a5a5a]">Kondisi</p>
                      <p className="font-bold text-[#1a1a1a]">
                        {(selectedLogbook.conditions || []).filter((c) => c.verified).length}/{(selectedLogbook.conditions || []).length} verified
                      </p>
                    </div>
                  </div>
                </div>

                {(selectedLogbook.conditions || []).length ? (
                  (selectedLogbook.conditions || []).map((condition) => (
                    <ConditionCard
                      key={condition.id}
                      condition={condition}
                      canVerify={true}
                      isVerifying={verifyingConditionId === condition.id}
                      confirmVerify={confirmVerifyId === condition.id}
                      setConfirmVerify={(value) =>
                        setConfirmVerifyId(value ? condition.id : null)
                      }
                      onVerify={async () => handleVerifyCondition(condition.id)}
                      onOpenPhoto={setPhotoPreview}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-4 text-sm font-medium text-[#5a5a5a] shadow-[4px_4px_0px_#1a1a1a]">
                    Tidak ada kondisi pada logbook ini.
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      ) : (
        <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-6 text-sm font-bold text-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a]">
          Role Anda tidak memiliki akses ke halaman ini.
        </div>
      )}

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPhotoPreview("")}
        >
          <div
            className="max-w-3xl rounded-xl border-2 border-[#1a1a1a] bg-white p-2 shadow-[4px_4px_0px_#1a1a1a] relative"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setPhotoPreview("")}
              className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/90 hover:bg-red-100 text-red-500 transition-colors z-10"
            >
              <TbX className="w-5 h-5" />
            </button>
            <img src={photoPreview} alt="Preview foto kondisi" className="max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
