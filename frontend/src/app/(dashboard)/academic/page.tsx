"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TbAlertCircle,
  TbArrowLeft,
  TbArrowsExchange,
  TbBook2,
  TbCalendar,
  TbCheck,
  TbChevronRight,
  TbCircleCheck,
  TbClock,
  TbInfoCircle,
  TbLayoutDashboard,
  TbLockOpen,
  TbMapPin,
  TbRefresh,
  TbSearch,
  TbSchool,
  TbSend,
  TbSparkles,
  TbLoader2,
  TbUser,
  TbUserCheck,
  TbUsers,
  TbX,
} from "react-icons/tb";
import api from "@/services/api";
import { useCurrentRole, useCurrentUser } from "@/providers/current-user-context";

type ReportStatus = "TATAP_MUKA" | "ONLINE" | "TIDAK_MASUK" | "PINDAH_JADWAL" | "BELUM_PASTI";

type AcademicOffering = {
  id: string;
  term?: { code?: string; name?: string };
  course?: { code?: string; name?: string };
  academicClass?: { id?: string; code?: string; name?: string };
  dosen?: { name?: string };
  schedule?: {
    date?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    type?: string;
    status?: string;
    labId?: string;
    lab?: { id?: string; name?: string };
  };
  lab?: { name?: string };
};

type AcademicReport = {
  id: string;
  offeringId?: string;
  status: ReportStatus;
  revision: number;
  notes?: string | null;
  reportDate?: string;
  updatedAt?: string;
  updatedBy?: { name?: string };
  offering?: AcademicOffering;
};

type ApiList<T> = { data?: T[]; success?: boolean };

type OccurrenceRelease = {
  id: string;
  reportId: string;
  status: "RELEASED" | "ALLOCATED" | "REVOKED";
  occurrenceDate?: string;
  startTime?: string;
  endTime?: string;
  offering?: AcademicOffering;
};

type SlotRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  releaseId: string;
  targetOffering?: AcademicOffering;
};

type OccurrenceSwap = {
  id: string;
  status: "PENDING_CONFIRMATION" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED";
  occurrenceDate: string;
  sourceOffering?: AcademicOffering;
  targetOffering?: AcademicOffering;
};

type ActualSchedule = {
  offeringId: string;
  occurrenceDate: string;
  startTime: string;
  endTime: string;
  swapId?: string | null;
  lab?: { name?: string };
  course?: { code?: string; name?: string };
  academicClass?: { code?: string; name?: string };
};

type Membership = {
  id: string;
  user?: { id?: string; name?: string; email?: string };
  student?: { id?: string; name?: string; email?: string };
  isActive?: boolean;
};

type Pj = {
  id: string;
  user?: { id?: string; name?: string; email?: string };
  member?: { id?: string; name?: string; email?: string };
  isActive?: boolean;
};

type AcademicFormEvent = { preventDefault: () => void };

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; badgeClass: string; borderClass: string; bgClass: string; textClass: string }
> = {
  TATAP_MUKA: {
    label: "Tatap muka",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-600",
    borderClass: "border-emerald-600",
    bgClass: "bg-emerald-50",
    textClass: "text-emerald-700",
  },
  ONLINE: {
    label: "Online",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-600",
    borderClass: "border-blue-600",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
  },
  TIDAK_MASUK: {
    label: "Tidak masuk",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-600",
    borderClass: "border-rose-600",
    bgClass: "bg-rose-50",
    textClass: "text-rose-700",
  },
  PINDAH_JADWAL: {
    label: "Pindah jadwal",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-600",
    borderClass: "border-amber-600",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
  },
  BELUM_PASTI: {
    label: "Belum pasti",
    badgeClass: "bg-gray-100 text-gray-800 border-gray-600",
    borderClass: "border-gray-500",
    bgClass: "bg-gray-50",
    textClass: "text-gray-700",
  },
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  TATAP_MUKA: "Tatap muka",
  ONLINE: "Online",
  TIDAK_MASUK: "Tidak masuk",
  PINDAH_JADWAL: "Pindah jadwal",
  BELUM_PASTI: "Belum pasti",
};

const SECTIONS = [
  ["ringkasan", "Ringkasan", TbLayoutDashboard],
  ["mata-kuliah", "Mata Kuliah", TbSchool],
  ["kelola-pj", "Kelola PJ", TbUsers],
  ["laporan", "Laporan", TbSend],
  ["ketersediaan-lab", "Ketersediaan Lab", TbLockOpen],
  ["perubahan-jadwal", "Perubahan Jadwal", TbArrowsExchange],
  ["riwayat", "Riwayat", TbBook2],
] as const;

type SectionId = typeof SECTIONS[number][0];

function formatDate(value?: string) {
  if (!value) return "Belum ada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function extractArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== "object") return [];
  const record = response as { data?: unknown; items?: unknown };
  if (Array.isArray(record.data)) return record.data as T[];
  if (Array.isArray(record.items)) return record.items as T[];
  if (record.data && typeof record.data === "object") return extractArray<T>(record.data);
  return [];
}

function offeringLabel(offering?: AcademicOffering) {
  if (!offering) return "Penawaran tidak diketahui";
  return offering.course?.name || offering.course?.code || offering.id;
}

function offeringMeta(offering?: AcademicOffering) {
  if (!offering) return "";
  return [
    offering.course?.code,
    offering.academicClass?.name || offering.academicClass?.code,
    offering.term?.name || offering.term?.code,
  ]
    .filter(Boolean)
    .join(" · ");
}

function memberName(item: Membership | Pj) {
  const candidate = item as Membership & Pj;
  return candidate.user?.name || candidate.student?.name || candidate.member?.name || "Mahasiswa";
}

function durationInMinutes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0;
  return eh * 60 + em - (sh * 60 + sm);
}

type CoursePickerProps = {
  offerings: AcademicOffering[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  loading?: boolean;
};

function CourseSummary({ offering, onChange }: { offering?: AcademicOffering; onChange: () => void }) {
  if (!offering) return null;
  const schedule = offering.schedule;
  const scheduleText = schedule?.day || schedule?.date
    ? `${schedule.day || schedule.date}${schedule.startTime ? ` · ${schedule.startTime}–${schedule.endTime || ""} WIB` : ""}`
    : "Jadwal belum tersedia";
  return (
    <div className="mt-2 rounded-xl border-2 border-[#1a1a1a] bg-[#f5ede6] p-3 shadow-[2px_2px_0px_0px_#1a1a1a]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-base font-black leading-tight text-[#1a1a1a]">{offering.course?.name || offering.course?.code || offering.id}</p>
          {offering.course?.code && <span className="mt-1 inline-flex rounded-full border border-[#4b607f] bg-white px-2 py-0.5 text-[10px] font-black text-[#4b607f]">{offering.course.code}</span>}
        </div>
        <button type="button" onClick={onChange} className="min-h-[40px] shrink-0 rounded-lg border-2 border-[#1a1a1a] bg-white px-3 text-[11px] font-black text-[#1a1a1a] hover:bg-[#e8d8c9]">Ganti Mata Kuliah</button>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#1a1a1a] sm:grid-cols-2">
        <p className="flex min-w-0 items-center gap-2"><TbUser className="h-4 w-4 shrink-0 text-[#4b607f]" /><span className="truncate">{offering.dosen?.name || "Dosen belum tersedia"}</span></p>
        <p className="flex min-w-0 items-center gap-2"><TbSchool className="h-4 w-4 shrink-0 text-[#4b607f]" /><span className="truncate">{offering.academicClass?.name || offering.academicClass?.code || "Kelas"} · {offering.term?.name || offering.term?.code || "Semester belum tersedia"}</span></p>
        <p className="flex min-w-0 items-center gap-2"><TbClock className="h-4 w-4 shrink-0 text-[#f3701e]" /><span className="truncate">{scheduleText}</span></p>
        <p className="flex min-w-0 items-center gap-2"><TbMapPin className="h-4 w-4 shrink-0 text-[#4b607f]" /><span className="truncate">{schedule?.lab?.name || offering.lab?.name || "Ruangan belum tersedia"}</span></p>
      </div>
    </div>
  );
}

function CoursePicker({ offerings, value, onChange, label, placeholder, loading = false }: CoursePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const selected = offerings.find((offering) => offering.id === value);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return offerings;
    return offerings.filter((offering) => [
      offering.course?.name,
      offering.course?.code,
      offering.academicClass?.name,
      offering.academicClass?.code,
      offering.term?.name,
      offering.term?.code,
      offering.dosen?.name,
    ].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
  }, [offerings, query]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const state = { academicCoursePicker: true };
    window.history.pushState(state, "");
    const handlePopState = () => setOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [open]);

  function close() {
    if (open) window.history.back();
    setOpen(false);
  }

  function choose(offering: AcademicOffering) {
    onChange(offering.id);
    close();
  }

  const modalContent = open ? (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-[#1a1a1a]/60 backdrop-blur-sm sm:items-center sm:justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pilih mata kuliah"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="flex max-h-[88vh] sm:max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border-2 border-b-0 border-[#1a1a1a] bg-[#f5ede6] shadow-[0_-8px_24px_rgba(26,26,26,0.25)] sm:max-w-2xl sm:rounded-2xl sm:border-b-2 sm:shadow-[6px_6px_0px_0px_#1a1a1a]">
        <div className="shrink-0 px-4 pb-3 pt-3 sm:pt-4">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#1a1a1a]/30 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-black text-[#1a1a1a]">Pilih Mata Kuliah</h2>
              <p className="text-xs font-medium text-[#5a5a5a]">Cari berdasarkan nama, kode, kelas, semester, atau dosen.</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#e8d8c9]"
              aria-label="Tutup pemilih mata kuliah"
            >
              <TbX className="h-5 w-5" />
            </button>
          </div>
          <div className="relative mt-3">
            <TbSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4b607f]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
              placeholder="Cari mata kuliah..."
              className="min-h-[48px] w-full rounded-xl border-2 border-[#1a1a1a] bg-white pl-10 pr-10 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#f3701e]"
              aria-label="Cari mata kuliah"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[#5a5a5a]"
                aria-label="Hapus pencarian"
              >
                <TbX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto px-4 pb-8 sm:pb-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm font-bold text-[#4b607f]">
              <TbLoader2 className="h-5 w-5 animate-spin" /> Memuat mata kuliah...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-[#5a5a5a]">
              Tidak ada mata kuliah yang cocok dengan kata kunci...
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((offering) => (
                <button
                  key={offering.id}
                  type="button"
                  onClick={() => choose(offering)}
                  className={`w-full rounded-xl border-2 border-[#1a1a1a] bg-white p-3 text-left shadow-[2px_2px_0px_0px_#1a1a1a] transition hover:bg-[#fff8f2] ${
                    offering.id === value ? "ring-2 ring-[#f3701e]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading text-base font-black leading-tight text-[#1a1a1a]">
                        {offering.course?.name || offering.course?.code}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#4b607f]">
                        {offering.course?.code || "Kode belum tersedia"} · {offering.academicClass?.name || offering.academicClass?.code || "Kelas"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#4b607f] bg-[#f5ede6] px-2 py-1 text-[10px] font-black text-[#4b607f]">
                      {offering.term?.name || offering.term?.code || "Semester"}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-[#5a5a5a] sm:grid-cols-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <TbUser className="h-3.5 w-3.5 shrink-0 text-[#4b607f]" />
                      {offering.dosen?.name || "Dosen belum tersedia"}
                    </span>
                    <span className="flex items-center gap-1.5 truncate">
                      <TbClock className="h-3.5 w-3.5 shrink-0 text-[#f3701e]" />
                      {offering.schedule?.day || offering.schedule?.date || "Jadwal belum tersedia"}
                      {offering.schedule?.startTime ? ` · ${offering.schedule.startTime}–${offering.schedule.endTime || ""}` : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <span className="text-[11px] font-black uppercase tracking-wider text-[#1a1a1a]">{label}</span>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="mt-1 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border-2 border-[#1a1a1a] bg-white px-3 text-left shadow-[1px_1px_0px_0px_#1a1a1a] hover:bg-[#f5ede6]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={selected ? "min-w-0 truncate text-sm font-bold text-[#1a1a1a]" : "text-sm font-semibold text-[#5a5a5a]"}>
          {selected ? offeringLabel(selected) : placeholder}
        </span>
        <TbSearch className="h-5 w-5 shrink-0 text-[#f3701e]" />
      </button>
      {selected && <CourseSummary offering={selected} onChange={() => { setQuery(""); setOpen(true); }} />}
      {mounted && typeof document !== "undefined" && modalContent ? createPortal(modalContent, document.body) : modalContent}
    </div>
  );
}

export default function AcademicPage() {
  const role = useCurrentRole();
  const user = useCurrentUser();
  const canWrite = role === "MAHASISWA" || role === "DOSEN";

  const [activeTab, setActiveTabState] = useState<SectionId>(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("tab") as SectionId | null;
      if (param && SECTIONS.some(([id]) => id === param)) return param;
    }
    return "ringkasan";
  });

  const tabHistoryRef = useRef<SectionId[]>(["ringkasan"]);

  const setActiveTab = useCallback((nextTab: SectionId, recordHistory = true) => {
    setActiveTabState((prev) => {
      if (prev === nextTab) return prev;
      if (recordHistory) {
        tabHistoryRef.current.push(nextTab);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", nextTab);
          window.history.pushState({ tab: nextTab }, "", url.toString());
        }
      }
      return nextTab;
    });
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const stateTab = (event.state?.tab as SectionId | undefined) ||
        (new URLSearchParams(window.location.search).get("tab") as SectionId | null);
      if (stateTab && SECTIONS.some(([id]) => id === stateTab)) {
        setActiveTabState(stateTab);
      } else {
        setActiveTabState("ringkasan");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleBackToRingkasan = useCallback(() => {
    setActiveTab("ringkasan");
  }, [setActiveTab]);
  const [offerings, setOfferings] = useState<AcademicOffering[]>([]);
  const [reports, setReports] = useState<AcademicReport[]>([]);
  const [releases, setReleases] = useState<OccurrenceRelease[]>([]);
  const [slotRequests, setSlotRequests] = useState<SlotRequest[]>([]);
  const [swaps, setSwaps] = useState<OccurrenceSwap[]>([]);
  const [actualSchedules, setActualSchedules] = useState<ActualSchedule[]>([]);

  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [targetOfferingId, setTargetOfferingId] = useState("");
  const [status, setStatus] = useState<ReportStatus>("TATAP_MUKA");
  const [notes, setNotes] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualDate, setActualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [swapSourceOfferingId, setSwapSourceOfferingId] = useState("");
  const [swapTargetOfferingId, setSwapTargetOfferingId] = useState("");
  const [editing, setEditing] = useState<AcademicReport | null>(null);

  const [members, setMembers] = useState<Membership[]>([]);
  const [pjs, setPjs] = useState<Pj[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pjUnavailable, setPjUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      offeringResponse,
      reportResponse,
      releaseResponse,
      requestResponse,
      swapResponse,
      actualResponse,
    ] = await Promise.all([
      api.get<ApiList<AcademicOffering>>("/academic/offerings").catch(() => ({ data: [] })),
      api.get<ApiList<AcademicReport>>("/academic/reports").catch(() => ({ data: [] })),
      api.get<ApiList<OccurrenceRelease>>("/academic/occurrence-releases").catch(() => ({ data: [] })),
      api.get<ApiList<SlotRequest>>("/academic/slot-requests").catch(() => ({ data: [] })),
      api.get<ApiList<OccurrenceSwap>>("/academic/occurrence-swaps").catch(() => ({ data: [] })),
      api
        .get<ApiList<ActualSchedule>>(`/academic/actual-schedules?date=${actualDate}`)
        .catch(() => ({ data: [] })),
    ]);

    setOfferings(extractArray<AcademicOffering>(offeringResponse));
    setReports(extractArray<AcademicReport>(reportResponse));
    setReleases(extractArray<OccurrenceRelease>(releaseResponse));
    setSlotRequests(extractArray<SlotRequest>(requestResponse));
    setSwaps(extractArray<OccurrenceSwap>(swapResponse));
    setActualSchedules(extractArray<ActualSchedule>(actualResponse));
    setLoading(false);
  }, [actualDate]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!selectedOfferingId) {
        setMembers([]);
        setPjs([]);
        return;
      }
      setPjUnavailable(false);
      Promise.allSettled([
        api.get<unknown>(`/academic/offerings/${selectedOfferingId}/memberships`),
        api.get<unknown>(`/academic/offerings/${selectedOfferingId}/pjs`),
      ]).then(([membershipResult, pjResult]) => {
        if (!active) return;
        setMembers(
          membershipResult.status === "fulfilled" ? extractArray<Membership>(membershipResult.value) : []
        );
        setPjs(pjResult.status === "fulfilled" ? extractArray<Pj>(pjResult.value) : []);
        setPjUnavailable(membershipResult.status === "rejected" || pjResult.status === "rejected");
      });
    });
    return () => {
      active = false;
    };
  }, [selectedOfferingId]);

  const reportsByOffering = useMemo(
    () => new Map(reports.map((report) => [report.offeringId || report.offering?.id, report])),
    [reports]
  );
  const releasesByReport = useMemo(
    () => new Map(releases.map((release) => [release.reportId, release])),
    [releases]
  );

  const selectedDateActualSchedules = useMemo(
    () => actualSchedules.filter((item) => (item.occurrenceDate?.slice(0, 10) || item.occurrenceDate) === actualDate),
    [actualSchedules, actualDate]
  );

  const offeringsOnSelectedDate = useMemo(() => {
    const offeringMap = new Map(offerings.map((o) => [o.id, o]));
    return selectedDateActualSchedules
      .map((item) => offeringMap.get(item.offeringId))
      .filter((o): o is AcademicOffering => Boolean(o && o.schedule && (!o.schedule.type || o.schedule.type === "PRAKTIKUM")));
  }, [offerings, selectedDateActualSchedules]);

  const selectedSwapSource = useMemo(
    () => offerings.find((o) => o.id === swapSourceOfferingId),
    [offerings, swapSourceOfferingId]
  );

  const eligibleSwapTargets = useMemo(() => {
    if (!selectedSwapSource?.schedule) return [];
    const srcSched = selectedSwapSource.schedule;
    const srcDuration = durationInMinutes(srcSched.startTime, srcSched.endTime);
    const srcClassId = selectedSwapSource.academicClass?.id || selectedSwapSource.academicClass?.code;
    const srcLab = srcSched.lab?.name || srcSched.labId;

    return offeringsOnSelectedDate.filter((target) => {
      if (target.id === selectedSwapSource.id) return false;
      const targetClassId = target.academicClass?.id || target.academicClass?.code;
      if (srcClassId && targetClassId && srcClassId === targetClassId) return false;
      if (!target.schedule) return false;
      const targetSched = target.schedule;
      const targetLab = targetSched.lab?.name || targetSched.labId;
      if (srcLab && targetLab && srcLab !== targetLab) return false;
      const targetDuration = durationInMinutes(targetSched.startTime, targetSched.endTime);
      if (srcDuration > 0 && targetDuration > 0 && srcDuration !== targetDuration) return false;
      return true;
    });
  }, [selectedSwapSource, offeringsOnSelectedDate]);

  function startEdit(report: AcademicReport) {
    setEditing(report);
    setSelectedOfferingId(report.offeringId || report.offering?.id || "");
    setStatus(report.status);
    setNotes(report.notes || "");
    setReportDate(report.reportDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setMessage(null);
    setActiveTab("laporan");
  }

  async function mutate(action: () => Promise<unknown>, success: string, failure: string) {
    setSaving(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: success, type: "success" });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : failure, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function releaseOccurrence(report: AcademicReport) {
    await mutate(
      () => api.post("/academic/occurrence-releases", { reportId: report.id }),
      "Slot pertemuan dilepas sesuai laporan.",
      "Slot gagal dilepas."
    );
  }

  async function requestSlot(releaseId: string) {
    if (!targetOfferingId) return;
    await mutate(
      async () => {
        await api.post("/academic/slot-requests", { releaseId, targetOfferingId });
        setTargetOfferingId("");
      },
      "Pengajuan slot dikirim ke koordinator.",
      "Pengajuan slot gagal dibuat."
    );
  }

  async function reviewSlotRequest(requestId: string, approved: boolean) {
    await mutate(
      () =>
        api.patch(`/academic/slot-requests/${requestId}/review`, {
          approved,
          ...(approved ? {} : { rejectionReason: "Ditolak koordinator" }),
        }),
      approved ? "Pengajuan slot disetujui." : "Pengajuan slot ditolak.",
      "Pengajuan slot gagal ditinjau."
    );
  }

  async function requestSwap(sourceOfferingId?: string) {
    const srcId = sourceOfferingId || swapSourceOfferingId;
    if (!srcId || !swapTargetOfferingId) return;
    await mutate(
      () =>
        api.post("/academic/occurrence-swaps", {
          sourceOfferingId: srcId,
          targetOfferingId: swapTargetOfferingId,
          occurrenceDate: actualDate,
        }),
      "Pertukaran menunggu konfirmasi kelas tujuan.",
      "Pertukaran gagal diajukan."
    );
  }

  async function confirmSwap(swapId: string) {
    await mutate(
      () => api.post(`/academic/occurrence-swaps/${swapId}/confirm`, {}),
      "Konfirmasi pertukaran tercatat.",
      "Konfirmasi gagal."
    );
  }

  async function reviewSwap(swapId: string, approved: boolean) {
    await mutate(
      () =>
        api.patch(
          `/academic/occurrence-swaps/${swapId}/review`,
          approved ? { approved } : { approved, rejectionReason: "Ditolak koordinator" }
        ),
      approved ? "Pertukaran disetujui." : "Pertukaran ditolak.",
      "Peninjauan gagal."
    );
  }

  async function cancelSwap(swapId: string) {
    await mutate(
      () => api.post(`/academic/occurrence-swaps/${swapId}/cancel`, {}),
      "Pengajuan pertukaran dibatalkan.",
      "Pembatalan gagal."
    );
  }

  async function submit(event: AcademicFormEvent) {
    event.preventDefault();
    if (!selectedOfferingId) return;
    await mutate(
      async () => {
        if (editing) {
          await api.patch(`/academic/reports/${editing.id}`, {
            expectedRevision: editing.revision,
            status,
            notes,
          });
        } else {
          await api.post("/academic/reports", {
            offeringId: selectedOfferingId,
            reportDate,
            status,
            notes,
          });
        }
        setEditing(null);
        setNotes("");
      },
      "Laporan tersimpan.",
      "Laporan gagal disimpan."
    );
  }

  async function assignPj() {
    if (!selectedOfferingId || !selectedMemberId) return;
    await mutate(
      () =>
        api.post(`/academic/offerings/${selectedOfferingId}/pjs`, {
          membershipId: selectedMemberId,
        }),
      "PJ berhasil ditetapkan.",
      "PJ gagal ditetapkan."
    );
  }

  async function replacePj(pj: Pj) {
    if (!selectedOfferingId || !selectedMemberId) return;
    await mutate(
      async () => {
        await api.patch(`/academic/pjs/${pj.id}`, { isActive: false });
        await api.post(`/academic/offerings/${selectedOfferingId}/pjs`, {
          membershipId: selectedMemberId,
        });
      },
      "PJ berhasil diganti.",
      "Penggantian PJ gagal."
    );
  }

  return (
    <div className="academic-page space-y-3 sm:space-y-5 max-w-7xl mx-auto w-full min-w-0 pb-32 sm:pb-16 px-1 sm:px-2">
      <header className="neo-card p-2.5 sm:p-5 bg-gradient-to-br from-[#f5ede6] via-white to-[#e8d8c9] border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[3px_3px_0px_0px_#1a1a1a]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="neo-badge bg-[#f3701e] text-white text-[9px] sm:text-[11px] font-black uppercase tracking-wider py-0.5 px-1.5 sm:px-2">
                Akademik
              </span>
              {user?.isKetuaKelas && (
                <span className="hidden sm:inline-block neo-badge bg-[#4b607f] text-white text-[11px] font-bold py-0.5 px-2">
                  Ketua Kelas
                </span>
              )}
              {role === "DOSEN" && (
                <span className="hidden sm:inline-block neo-badge bg-[#1a1a1a] text-white text-[11px] font-bold py-0.5 px-2">
                  Dosen Pengampu
                </span>
              )}
            </div>
            <h1 className="mt-0.5 sm:mt-1 font-heading text-sm sm:text-2xl md:text-3xl font-black text-[#1a1a1a] tracking-tight truncate leading-tight">
              <span className="sm:hidden">Portal Perkuliahan</span>
              <span className="hidden sm:inline">Portal Perkuliahan & Praktikum</span>
            </h1>
            <p className="hidden sm:block text-xs sm:text-sm text-[#5a5a5a] font-medium mt-0.5 truncate max-w-2xl">
              Kelola penanggung jawab (PJ), status perkuliahan, ketersediaan slot lab, dan pertukaran jadwal secara terpadu.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="neo-btn min-h-[36px] sm:min-h-[44px] min-w-[36px] sm:min-w-[44px] bg-white px-2.5 sm:px-4 py-1.5 sm:py-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a]"
              aria-label="Muat ulang data"
              title="Segarkan data"
            >
              <TbRefresh className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${loading ? "animate-spin text-[#f3701e]" : ""}`} />
              <span className="hidden sm:inline">{loading ? "Memuat..." : "Segarkan"}</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navigasi ruang akademik"
        className="sticky top-2 z-20"
      >
        <div className="sm:hidden">
          <label htmlFor="academic-tab-select" className="sr-only">
            Pilih Fitur Akademik
          </label>
          <div className="relative">
            <select
              id="academic-tab-select"
              aria-label="Pilih tab akademik"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as SectionId)}
              className="neo-input w-full min-h-[44px] pl-3.5 pr-10 py-2.5 font-bold text-xs bg-white text-[#1a1a1a] border border-[#1a1a1a] shadow-[1px_1px_0px_0px_#1a1a1a] appearance-none"
            >
              {SECTIONS.map(([id, label]) => (
                <option key={id} value={id}>
                  Fitur: {label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#1a1a1a]">
              <TbChevronRight className="w-4 h-4 rotate-90 text-[#f3701e]" />
            </div>
          </div>
        </div>

        <div className="hidden sm:block neo-card bg-[#f5ede6] p-1 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a]">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            {SECTIONS.map(([id, label, Icon]) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`neo-btn min-h-[44px] shrink-0 px-3.5 py-2 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? "bg-[#1a1a1a] text-white shadow-[2px_2px_0px_0px_#f3701e] border-2 border-[#1a1a1a]"
                      : "bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] border-2 border-[#1a1a1a]"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#f3701e]" : "text-[#4b607f]"}`} />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {activeTab !== "ringkasan" && (
        <div className="flex h-11 min-h-[44px] items-center gap-2 rounded-xl border border-[#1a1a1a] bg-white px-2 shadow-[1px_1px_0px_0px_#1a1a1a]">
          <button
            type="button"
            onClick={handleBackToRingkasan}
            className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#1a1a1a] hover:bg-[#f5ede6] active:bg-[#e8d8c9] transition-colors shrink-0"
            aria-label="Kembali ke ringkasan"
            title="Kembali ke Ringkasan"
          >
            <TbArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
          </button>
          <div className="h-4 w-px bg-[#1a1a1a]/20 shrink-0" />
          <span className="font-heading text-xs sm:text-sm font-black text-[#1a1a1a] truncate">
            {SECTIONS.find(([id]) => id === activeTab)?.[1] || "Fitur"}
          </span>
        </div>
      )}

      {/* Global Status Banner */}
      {message && (
        <div
          role="status"
          className={`neo-card p-3.5 sm:p-4 text-sm font-bold flex items-center justify-between gap-3 border-2 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-600 shadow-[2px_2px_0px_0px_#059669]"
              : "bg-rose-50 text-rose-900 border-rose-600 shadow-[2px_2px_0px_0px_#e11d48]"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <TbCircleCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <TbAlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="p-1 text-gray-500 hover:text-black min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Tutup pesan"
          >
            <TbX className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === "ringkasan" && (
        <div id="ringkasan" className="space-y-3 sm:space-y-6">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div
              onClick={() => setActiveTab("mata-kuliah")}
              className="neo-card p-3 sm:p-4 bg-white cursor-pointer hover:bg-[#f5ede6] transition-all group border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">Mata Kuliah</span>
                <TbSchool className="w-4 h-4 sm:w-5 sm:h-5 text-[#4b607f]" />
              </div>
              <p className="mt-1 sm:mt-2 font-heading text-xl sm:text-3xl font-black text-[#1a1a1a]">
                {offerings.length}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#5a5a5a] flex items-center gap-1 group-hover:text-[#f3701e] font-semibold">
                Lihat <TbChevronRight className="w-3 h-3" />
              </p>
            </div>

            <div
              onClick={() => setActiveTab("perubahan-jadwal")}
              className="neo-card p-3 sm:p-4 bg-white cursor-pointer hover:bg-[#f5ede6] transition-all group border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">Jadwal Hari Ini</span>
                <TbCalendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#f3701e]" />
              </div>
              <p className="mt-1 sm:mt-2 font-heading text-xl sm:text-3xl font-black text-[#1a1a1a]">
                {actualSchedules.length}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#5a5a5a] flex items-center gap-1 group-hover:text-[#f3701e] font-semibold">
                Cek <TbChevronRight className="w-3 h-3" />
              </p>
            </div>

            <div
              onClick={() => setActiveTab("laporan")}
              className="neo-card p-3 sm:p-4 bg-white cursor-pointer hover:bg-[#f5ede6] transition-all group border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">Laporan Masuk</span>
                <TbSend className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              </div>
              <p className="mt-1 sm:mt-2 font-heading text-xl sm:text-3xl font-black text-[#1a1a1a]">
                {reports.length}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#5a5a5a] flex items-center gap-1 group-hover:text-[#f3701e] font-semibold">
                Tulis <TbChevronRight className="w-3 h-3" />
              </p>
            </div>

            <div
              onClick={() => setActiveTab("ketersediaan-lab")}
              className="neo-card p-3 sm:p-4 bg-white cursor-pointer hover:bg-[#f5ede6] transition-all group border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">Slot Rilis</span>
                <TbLockOpen className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              <p className="mt-1 sm:mt-2 font-heading text-xl sm:text-3xl font-black text-[#1a1a1a]">
                {releases.filter((r) => r.status === "RELEASED").length}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#5a5a5a] flex items-center gap-1 group-hover:text-[#f3701e] font-semibold">
                Slot <TbChevronRight className="w-3 h-3" />
              </p>
            </div>
          </section>

          <section className="neo-card bg-[#f5ede6] p-3 sm:p-5 border border-[#1a1a1a] sm:border-2 shadow-[1.5px_1.5px_0px_0px_#1a1a1a] sm:shadow-[3px_3px_0px_0px_#1a1a1a]">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="font-heading text-sm sm:text-lg font-black text-[#1a1a1a] flex items-center gap-1.5 sm:gap-2">
                <TbSparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#f3701e]" />
                Aksi Cepat Ruang Akademik
              </h2>
              <span className="text-[11px] text-[#5a5a5a] font-medium hidden sm:inline">
                Sesuai peran {role || "Pengguna"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {canWrite && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("laporan")}
                    className="neo-btn min-h-[44px] bg-white p-2.5 sm:p-3 text-left font-bold text-xs sm:text-sm flex items-center justify-between hover:bg-[#e8d8c9] border border-[#1a1a1a] sm:border-2"
                  >
                    <span className="flex items-center gap-2 text-[#1a1a1a] truncate">
                      <TbSend className="w-4 h-4 text-[#f3701e] shrink-0" /> Buat / Revisi Laporan
                    </span>
                    <TbChevronRight className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("kelola-pj")}
                    className="neo-btn min-h-[44px] bg-white p-2.5 sm:p-3 text-left font-bold text-xs sm:text-sm flex items-center justify-between hover:bg-[#e8d8c9] border border-[#1a1a1a] sm:border-2"
                  >
                    <span className="flex items-center gap-2 text-[#1a1a1a] truncate">
                      <TbUsers className="w-4 h-4 text-[#4b607f] shrink-0" /> Kelola PJ Kelas
                    </span>
                    <TbChevronRight className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("perubahan-jadwal")}
                    className="neo-btn min-h-[44px] bg-white p-2.5 sm:p-3 text-left font-bold text-xs sm:text-sm flex items-center justify-between hover:bg-[#e8d8c9] border border-[#1a1a1a] sm:border-2"
                  >
                    <span className="flex items-center gap-2 text-[#1a1a1a] truncate">
                      <TbArrowsExchange className="w-4 h-4 text-amber-600 shrink-0" /> Ajukan Tukar Jadwal
                    </span>
                    <TbChevronRight className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("mata-kuliah")}
                className="neo-btn min-h-[44px] bg-white p-2.5 sm:p-3 text-left font-bold text-xs sm:text-sm flex items-center justify-between hover:bg-[#e8d8c9] border border-[#1a1a1a] sm:border-2"
              >
                <span className="flex items-center gap-2 text-[#1a1a1a] truncate">
                  <TbSchool className="w-4 h-4 text-[#4b607f] shrink-0" /> Daftar Mata Kuliah
                </span>
                <TbChevronRight className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ketersediaan-lab")}
                className="neo-btn min-h-[44px] bg-white p-2.5 sm:p-3 text-left font-bold text-xs sm:text-sm flex items-center justify-between hover:bg-[#e8d8c9] border border-[#1a1a1a] sm:border-2"
              >
                <span className="flex items-center gap-2 text-[#1a1a1a] truncate">
                  <TbLockOpen className="w-4 h-4 text-indigo-600 shrink-0" /> Ketersediaan Slot Lab
                </span>
                <TbChevronRight className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("riwayat")}
                className="neo-btn min-h-[44px] bg-white p-2.5 sm:p-3 text-left font-bold text-xs sm:text-sm flex items-center justify-between hover:bg-[#e8d8c9] border border-[#1a1a1a] sm:border-2"
              >
                <span className="flex items-center gap-2 text-[#1a1a1a] truncate">
                  <TbBook2 className="w-4 h-4 text-[#5a5a5a] shrink-0" /> Riwayat Laporan
                </span>
                <TbChevronRight className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
              </button>
            </div>
          </section>

          <section className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm sm:text-xl font-bold text-[#1a1a1a] flex items-center gap-1.5 sm:gap-2">
                <TbCalendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#f3701e]" /> Jadwal Hari Ini
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab("perubahan-jadwal")}
                className="text-[11px] sm:text-xs font-bold text-[#4b607f] hover:underline"
              >
                Semua Jadwal →
              </button>
            </div>

            {actualSchedules.length === 0 ? (
              <div className="neo-card p-4 sm:p-6 bg-white text-center border border-[#1a1a1a] sm:border-2">
                <TbCalendar className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-1.5" />
                <p className="font-bold text-xs sm:text-sm text-[#1a1a1a]">Tidak ada jadwal praktikum hari ini</p>
                <p className="text-[11px] text-[#5a5a5a] mt-0.5">
                  Buka tab Perubahan Jadwal untuk melihat tanggal lain atau mengajukan tukar jadwal.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {actualSchedules.slice(0, 4).map((item) => (
                  <article key={item.offeringId} className="neo-card bg-white p-3 sm:p-4 space-y-1.5 border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading font-bold text-sm sm:text-base text-[#1a1a1a] line-clamp-1">
                        {item.course?.name || item.course?.code || "Mata kuliah"}
                      </h3>
                      {item.swapId && (
                        <span className="neo-badge bg-amber-100 text-amber-800 text-[9px] sm:text-[10px] shrink-0 font-bold py-0.5 px-1.5">
                          Tukar
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-[11px] sm:text-xs text-[#5a5a5a]">
                      <p className="flex items-center gap-1.5 font-medium text-[#1a1a1a] truncate">
                        <TbUsers className="w-3.5 h-3.5 text-[#4b607f] shrink-0" />
                        Kelas: {item.academicClass?.name || item.academicClass?.code || "Kelas"}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <TbClock className="w-3.5 h-3.5 text-[#f3701e] shrink-0" />
                        {item.startTime}–{item.endTime} WIB
                      </p>
                      <p className="flex items-center gap-1.5 truncate">
                        <TbMapPin className="w-3.5 h-3.5 text-[#4b607f] shrink-0" />
                        {item.lab?.name || "Laboratorium"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm sm:text-xl font-bold text-[#1a1a1a] flex items-center gap-1.5 sm:gap-2">
                <TbSend className="w-4 h-4 sm:w-5 sm:h-5 text-[#4b607f]" /> Status Perkuliahan Terkini
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab("riwayat")}
                className="text-[11px] sm:text-xs font-bold text-[#4b607f] hover:underline"
              >
                Buka Riwayat →
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="neo-card p-4 sm:p-6 bg-white text-center border border-[#1a1a1a] sm:border-2">
                <TbBook2 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-1.5" />
                <p className="font-bold text-xs sm:text-sm text-[#1a1a1a]">Belum ada laporan perkuliahan</p>
                <p className="text-[11px] text-[#5a5a5a] mt-0.5">
                  Laporan yang dibuat dosen atau PJ akan tampil di sini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                {reports.slice(0, 3).map((report) => {
                  const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.BELUM_PASTI;
                  const offering = report.offering || offerings.find((o) => o.id === report.offeringId);
                  return (
                    <article
                      key={report.id}
                      className="neo-card bg-white p-3 sm:p-4 space-y-1.5 border border-[#1a1a1a] sm:border-2 flex flex-col justify-between shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-heading font-bold text-sm sm:text-base text-[#1a1a1a] line-clamp-1">
                            {offeringLabel(offering)}
                          </h3>
                          <span className={`neo-badge text-[10px] sm:text-xs font-black shrink-0 ${statusConf.badgeClass} py-0.5 px-1.5`}>
                            {statusConf.label}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-[#5a5a5a] mt-0.5 font-medium">{offeringMeta(offering)}</p>
                        {report.notes && (
                          <p className="text-[11px] sm:text-xs text-gray-700 mt-1.5 bg-[#f5ede6] p-1.5 sm:p-2 border-l-2 border-[#1a1a1a]">
                            &ldquo;{report.notes}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#5a5a5a] pt-1.5 border-t border-gray-200">
                        <span>{formatDate(report.reportDate || report.updatedAt)}</span>
                        <span>Revisi {report.revision}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: MATA KULIAH */}
      {activeTab === "mata-kuliah" && (
        <div id="mata-kuliah" className="space-y-4">
          <div className="neo-card p-4 sm:p-5 bg-white border-2 border-[#1a1a1a]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#4b607f]/10 rounded border border-[#4b607f]">
                <TbSchool className="w-6 h-6 text-[#4b607f]" />
              </div>
              <div>
                <h2 className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">Daftar Mata Kuliah</h2>
                <p className="text-xs sm:text-sm text-[#5a5a5a] font-medium">
                  Penawaran akademik aktif semester ini, jadwal praktikum, dan penanggung jawab kelas.
                </p>
              </div>
            </div>
          </div>

          {offerings.length === 0 ? (
            <div className="neo-card bg-white p-8 text-center border-2 border-[#1a1a1a]">
              <TbSchool className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="font-bold text-base text-[#1a1a1a]">Belum ada penawaran akademik</p>
              <p className="text-xs text-[#5a5a5a] mt-1">
                Data mata kuliah yang terhubung dengan kelas Anda akan tampil di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offerings.map((offering) => {
                const report = reportsByOffering.get(offering.id);
                const statusConf = report ? STATUS_CONFIG[report.status] : null;
                return (
                  <article
                    key={offering.id}
                    className="neo-card bg-white p-4 sm:p-5 border-2 border-[#1a1a1a] flex flex-col justify-between space-y-4 hover:shadow-[4px_4px_0px_0px_#1a1a1a] transition-shadow"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-heading font-black text-lg sm:text-xl text-[#1a1a1a] leading-snug break-words">
                            {offering.course?.name || offering.course?.code || offering.id}
                          </h3>
                          <p className="text-xs text-[#5a5a5a] font-semibold mt-1">
                            {offeringMeta(offering)}
                          </p>
                        </div>
                        {statusConf ? (
                          <span className={`neo-badge text-xs font-black shrink-0 ${statusConf.badgeClass}`}>
                            {statusConf.label}
                          </span>
                        ) : (
                          <span className="neo-badge bg-gray-100 text-gray-600 text-xs shrink-0 font-medium">
                            Belum ada laporan
                          </span>
                        )}
                      </div>

                      <div className="mt-3.5 space-y-1.5 text-xs text-[#1a1a1a] bg-[#f5ede6] p-3 border-2 border-[#1a1a1a]">
                        <p className="flex items-center gap-2">
                          <TbUser className="w-4 h-4 text-[#4b607f] shrink-0" />
                          <span className="font-bold">Dosen:</span> {offering.dosen?.name || "Belum tersedia"}
                        </p>
                        <p className="flex items-center gap-2">
                          <TbClock className="w-4 h-4 text-[#f3701e] shrink-0" />
                          <span className="font-bold">Waktu:</span>{" "}
                          {offering.schedule?.day || offering.schedule?.date || "Jadwal belum tersedia"}{" "}
                          {offering.schedule?.startTime && `(${offering.schedule.startTime}–${offering.schedule.endTime || ""})`}
                        </p>
                        <p className="flex items-center gap-2">
                          <TbMapPin className="w-4 h-4 text-[#4b607f] shrink-0" />
                          <span className="font-bold">Ruangan:</span>{" "}
                          {offering.schedule?.lab?.name || offering.lab?.name || "Lab belum ditentukan"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOfferingId(offering.id);
                          setActiveTab("kelola-pj");
                        }}
                        className="neo-btn min-h-[44px] flex-1 bg-white px-3 py-2 text-xs font-bold border-2 border-[#1a1a1a] hover:bg-[#e8d8c9] flex items-center justify-center gap-1.5"
                      >
                        <TbUsers className="w-4 h-4 text-[#4b607f]" /> Kelola PJ
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOfferingId(offering.id);
                            setActiveTab("laporan");
                          }}
                          className="neo-btn min-h-[44px] flex-1 bg-[#f3701e] px-3 py-2 text-xs font-bold text-white border-2 border-[#1a1a1a] hover:bg-[#e05b0c] flex items-center justify-center gap-1.5"
                        >
                          <TbSend className="w-4 h-4" /> Laporkan
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "kelola-pj" && (
        <div id="kelola-pj" className="space-y-3 sm:space-y-4">
          <div className="neo-card p-3 sm:p-5 bg-white border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a]">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="p-1.5 sm:p-2 bg-[#4b607f]/10 rounded border border-[#4b607f]">
                <TbUsers className="w-5 h-5 sm:w-6 sm:h-6 text-[#4b607f]" />
              </div>
              <div>
                <h2 className="font-heading text-base sm:text-2xl font-black text-[#1a1a1a]">
                  Kelola Penanggung Jawab (PJ)
                </h2>
                <p className="text-[11px] sm:text-sm text-[#5a5a5a] font-medium">
                  Ketua kelas aktif dapat menetapkan atau mengganti PJ penawaran kelas.
                </p>
              </div>
            </div>
          </div>

          <div className="neo-card p-3 sm:p-6 bg-white border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a] space-y-3 sm:space-y-4">
            <CoursePicker
              offerings={offerings}
              value={selectedOfferingId}
              onChange={setSelectedOfferingId}
              label="1. Pilih Mata Kuliah untuk Kelola PJ"
              placeholder="Pilih Mata Kuliah & Kelas"
              loading={loading}
            />

            {pjUnavailable ? (
              <div className="neo-card border border-[#f3701e] sm:border-2 bg-[#f5ede6] p-3 sm:p-4 text-xs sm:text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
                <TbAlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#f3701e] shrink-0" />
                <span>Kelola PJ tidak tersedia untuk akun ini atau penawaran ini.</span>
              </div>
            ) : selectedOfferingId ? (
              <div className="flex flex-col md:grid md:grid-cols-2 gap-3 sm:gap-4 pt-1">
                <div className="neo-card p-3 sm:p-4 bg-[#f5ede6] border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a] space-y-2.5 sm:space-y-3 order-1 md:order-2">
                  <div className="border-b border-[#1a1a1a]/15 pb-1.5 flex items-center justify-between">
                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#1a1a1a] flex items-center gap-1.5">
                      <TbUserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" /> 2. PJ aktif saat ini
                    </p>
                    <span className="text-[10px] sm:text-[11px] font-bold text-[#5a5a5a]">Penanggung Jawab</span>
                  </div>

                  {pjs.filter((pj) => pj.isActive !== false).map((pj) => (
                    <div
                      key={pj.id}
                      className="p-2.5 sm:p-3 bg-white border border-[#1a1a1a] sm:border-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-[1px_1px_0px_0px_#1a1a1a]"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold text-[#5a5a5a]">PJ Aktif:</p>
                        <strong className="text-xs sm:text-base font-heading font-black text-[#1a1a1a] block truncate">
                          {memberName(pj)}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => void replacePj(pj)}
                        disabled={saving || !selectedMemberId}
                        className="neo-btn min-h-[44px] w-full sm:w-auto bg-[#f3701e] px-4 py-2 text-xs font-black text-white disabled:opacity-50 border border-[#1a1a1a] shrink-0"
                      >
                        Ganti PJ
                      </button>
                    </div>
                  ))}

                  {!pjs.some((pj) => pj.isActive !== false) && (
                    <div className="p-3 bg-white border border-dashed border-[#1a1a1a] text-center space-y-2">
                      <p className="text-[11px] sm:text-xs text-[#5a5a5a] font-medium">
                        Belum ada penanggung jawab aktif untuk mata kuliah ini.
                      </p>
                      <button
                        type="button"
                        onClick={() => void assignPj()}
                        disabled={saving || !selectedMemberId}
                        className="neo-btn min-h-[44px] w-full bg-[#4b607f] px-4 py-2 text-xs font-black text-white disabled:opacity-50 border border-[#1a1a1a]"
                      >
                        Tetapkan PJ Baru
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] sm:text-[11px] text-[#5a5a5a] italic border-t border-[#1a1a1a]/10 pt-1.5">
                    *Pilih anggota kelas di bawah/sebelah kiri, lalu klik &quot;Tetapkan PJ Baru&quot; atau &quot;Ganti PJ&quot;.
                  </p>
                </div>

                <div className="neo-card p-3 sm:p-4 bg-[#f5ede6] border border-[#1a1a1a] sm:border-2 shadow-[1px_1px_0px_0px_#1a1a1a] sm:shadow-[2px_2px_0px_0px_#1a1a1a] space-y-2.5 sm:space-y-3 order-2 md:order-1">
                  <div className="flex items-center justify-between border-b border-[#1a1a1a]/15 pb-1.5">
                    <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#1a1a1a] flex items-center gap-1.5">
                      <TbUsers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4b607f]" /> 3. Pilih anggota kelas
                    </p>
                    <span className="text-[10px] sm:text-[11px] font-bold text-[#5a5a5a]">{members.length} Mahasiswa</span>
                  </div>

                  {members.length ? (
                    <ul className="space-y-1.5 max-h-60 sm:max-h-80 overflow-y-auto pr-1">
                      {members.map((member) => (
                        <li key={member.id}>
                          <label className={`flex min-h-[44px] items-center gap-2.5 p-2 text-xs sm:text-sm font-bold border border-[#1a1a1a] sm:border-2 cursor-pointer transition-all ${
                            selectedMemberId === member.id
                              ? "bg-[#1a1a1a] text-white shadow-[1px_1px_0px_0px_#f3701e]"
                              : "bg-white text-[#1a1a1a] hover:bg-white/90"
                          }`}>
                            <input
                              type="radio"
                              name="pj-member"
                              checked={selectedMemberId === member.id}
                              onChange={() => setSelectedMemberId(member.id)}
                              className="w-4 h-4 accent-[#f3701e] shrink-0"
                            />
                            <span className="truncate">{memberName(member)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#5a5a5a] italic py-3 text-center">
                      Data anggota kelas belum tersedia.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6 bg-[#f5ede6] border border-dashed border-[#1a1a1a] sm:border-2 text-center">
                <TbInfoCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#4b607f] mx-auto mb-1" />
                <p className="text-xs sm:text-sm font-bold text-[#1a1a1a]">Silakan pilih mata kuliah di atas</p>
                <p className="text-[11px] sm:text-xs text-[#5a5a5a]">
                  Daftar mahasiswa anggota kelas dan PJ akan muncul setelah mata kuliah dipilih.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LAPORAN */}
      {activeTab === "laporan" && (
        <div id="laporan" className="space-y-4">
          <div className="neo-card p-4 sm:p-5 bg-white border-2 border-[#1a1a1a]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#f3701e]/10 rounded border border-[#f3701e]">
                <TbSend className="w-6 h-6 text-[#f3701e]" />
              </div>
              <div>
                <h2 className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">
                  {editing ? "Revisi Laporan Perkuliahan" : "Laporan Status Perkuliahan"}
                </h2>
                <p className="text-xs sm:text-sm text-[#5a5a5a] font-medium">
                  {canWrite
                    ? "Laporkan apakah pertemuan tatap muka, daring/online, atau tidak masuk."
                    : "Laporan baru dan revisi hanya tersedia untuk penawaran dosen atau penawaran yang diizinkan backend."}
                </p>
              </div>
            </div>
          </div>

          {canWrite ? (
            <form onSubmit={submit} className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-4">
              {editing && (
                <div className="p-3 bg-amber-50 border-2 border-amber-500 flex items-center justify-between gap-2 text-xs font-bold text-amber-900">
                  <span>Sedang merevisi laporan (Revisi {editing.revision})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setNotes("");
                    }}
                    className="underline hover:text-black"
                  >
                    Batal revisi
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <CoursePicker
                    offerings={offerings}
                    value={selectedOfferingId}
                    onChange={setSelectedOfferingId}
                    label="Mata Kuliah"
                    placeholder="Pilih Mata Kuliah"
                    loading={loading}
                  />
                </div>

                <label className="block text-sm font-bold text-[#1a1a1a]">
                  Tanggal Perkuliahan
                  <input
                    required
                    type="date"
                    value={reportDate}
                    onChange={(event) => setReportDate(event.target.value)}
                    className="neo-input mt-1 min-h-[44px] w-full border-2 border-[#1a1a1a] text-sm"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">
                  Status Perkuliahan
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => {
                    const isSelected = status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStatus(value as ReportStatus)}
                        className={`neo-btn min-h-[44px] p-2 text-xs font-black flex items-center justify-center gap-1.5 border-2 transition-all ${
                          isSelected
                            ? "bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-[2px_2px_0px_0px_#f3701e]"
                            : "bg-white text-[#1a1a1a] border-[#1a1a1a] hover:bg-[#e8d8c9]"
                        }`}
                      >
                        <span>{config.label}</span>
                        {isSelected && <TbCheck className="w-3.5 h-3.5 text-[#f3701e]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block text-sm font-bold text-[#1a1a1a]">
                Catatan / Keterangan
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Tambahkan informasi materi atau alasan daring/tidak masuk..."
                  className="neo-input mt-1 min-h-[80px] w-full border-2 border-[#1a1a1a] text-sm p-3"
                  rows={3}
                />
              </label>

              <button
                type="submit"
                disabled={saving || !selectedOfferingId}
                className="neo-btn min-h-[44px] w-full sm:w-auto bg-[#f3701e] px-6 py-2.5 font-black text-sm text-white border-2 border-[#1a1a1a] shadow-[3px_3px_0px_0px_#1a1a1a] disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : editing ? "Simpan revisi" : "Kirim laporan"}
              </button>
            </form>
          ) : (
            <div className="neo-card p-6 bg-white border-2 border-[#1a1a1a] text-center space-y-2">
              <TbInfoCircle className="w-8 h-8 text-[#4b607f] mx-auto" />
              <p className="text-sm font-bold text-[#1a1a1a]">Akses Pelaporan Terbatas</p>
              <p className="text-xs text-[#5a5a5a] max-w-md mx-auto">
                Laporan baru dan revisi hanya tersedia untuk penawaran dosen atau penawaran yang diizinkan backend.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: KETERSEDIAAN LAB */}
      {activeTab === "ketersediaan-lab" && (
        <div id="ketersediaan-lab" className="space-y-4">
          <div className="neo-card p-4 sm:p-5 bg-[#f5ede6] border-2 border-[#1a1a1a]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#f3701e]/10 rounded border border-[#f3701e]">
                <TbLockOpen className="w-6 h-6 text-[#f3701e]" />
              </div>
              <div>
                <h2 className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">Ketersediaan Lab</h2>
                <p className="text-xs sm:text-sm text-[#5a5a5a] font-medium">
                  Slot dilepas dari laporan dan pengajuan penggunaan diproses melalui alur akademik.
                </p>
              </div>
            </div>
          </div>

          {/* Pelepasan Slot */}
          <section className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-3">
            <h3 className="font-heading text-base sm:text-lg font-black text-[#1a1a1a]">
              Pelepasan Slot Dari Laporan Online / Tidak Masuk
            </h3>
            <p className="text-xs text-[#5a5a5a]">
              Jika perkuliahan dialihkan online atau ditiadakan, Anda dapat melepaskan slot lab agar dapat dimanfaatkan kelas lain.
            </p>

            <div className="space-y-2.5 pt-2">
              {reports.filter((r) => r.status === "ONLINE" || r.status === "TIDAK_MASUK").length === 0 ? (
                <p className="text-xs text-[#5a5a5a] italic py-3 text-center bg-[#f5ede6] border border-dashed border-[#1a1a1a]">
                  Tidak ada laporan Online atau Tidak Masuk yang dapat dilepas saat ini.
                </p>
              ) : (
                reports
                  .filter((r) => r.status === "ONLINE" || r.status === "TIDAK_MASUK")
                  .map((report) => {
                    const release = releasesByReport.get(report.id);
                    const offering = report.offering || offerings.find((o) => o.id === report.offeringId);
                    return (
                      <div
                        key={report.id}
                        className="p-3 bg-[#f5ede6] border-2 border-[#1a1a1a] flex flex-wrap items-center justify-between gap-2 shadow-[2px_2px_0px_0px_#1a1a1a]"
                      >
                        <div>
                          <strong className="text-sm font-heading font-black text-[#1a1a1a] block">
                            {offeringLabel(offering)}
                          </strong>
                          <p className="text-xs text-[#5a5a5a]">
                            Tanggal: {formatDate(report.reportDate)} · Status: {STATUS_LABEL[report.status]}
                          </p>
                        </div>
                        {release ? (
                          <span className="neo-badge bg-[#4b607f] text-white text-xs font-bold">
                            Slot: {release.status}
                          </span>
                        ) : (
                          canWrite && (
                            <button
                              type="button"
                              onClick={() => void releaseOccurrence(report)}
                              disabled={saving}
                              className="neo-btn min-h-[44px] bg-[#f3701e] px-4 py-2 font-black text-xs text-white border-2 border-[#1a1a1a] flex items-center gap-1.5"
                            >
                              <TbLockOpen className="w-4 h-4" /> Lepaskan slot
                            </button>
                          )
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          {/* Pengajuan Penggunaan Slot Rilis */}
          {releases.some((release) => release.status === "RELEASED") && (
            <section className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-4">
              <h3 className="font-heading text-base sm:text-lg font-black text-[#1a1a1a] flex items-center gap-2">
                <TbSparkles className="w-5 h-5 text-[#f3701e]" /> Ajukan penggunaan slot rilis
              </h3>
              <p className="text-xs text-[#5a5a5a]">
                Pilih mata kuliah Anda, kemudian klik slot yang tersedia untuk mengajukan penggunaan ruangan kepada koordinator.
              </p>

              <CoursePicker
                offerings={offerings}
                value={targetOfferingId}
                onChange={setTargetOfferingId}
                label="Penawaran target"
                placeholder="Pilih penawaran target Anda"
                loading={loading}
              />

              <div className="flex flex-wrap gap-2 pt-1">
                {releases
                  .filter((release) => release.status === "RELEASED")
                  .map((release) => (
                    <button
                      key={release.id}
                      type="button"
                      disabled={saving || !targetOfferingId}
                      onClick={() => void requestSlot(release.id)}
                      className="neo-btn min-h-[44px] bg-[#4b607f] px-4 py-2 font-bold text-xs text-white border-2 border-[#1a1a1a] disabled:opacity-50"
                    >
                      Ajukan {release.occurrenceDate?.slice(0, 10) || "slot"}
                    </button>
                  ))}
              </div>
            </section>
          )}

          {/* Permintaan Penggunaan Slot Terkirim */}
          <section className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-3">
            <h3 className="font-heading text-base sm:text-lg font-black text-[#1a1a1a]">
              Permintaan Penggunaan Slot Terkirim
            </h3>
            {slotRequests.length === 0 ? (
              <p className="text-xs text-[#5a5a5a] italic text-center py-3 bg-[#f5ede6] border border-dashed border-[#1a1a1a]">
                Belum ada pengajuan penggunaan slot.
              </p>
            ) : (
              <div className="space-y-2">
                {slotRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-3 bg-[#f5ede6] border-2 border-[#1a1a1a] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#1a1a1a]">
                        Target: {offeringLabel(request.targetOffering)}
                      </span>
                      <p className="text-[#5a5a5a] mt-0.5">Status Pengajuan: {request.status}</p>
                    </div>
                    {role === "KOORDINATOR_LAB" && request.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void reviewSlotRequest(request.id, true)}
                          disabled={saving}
                          className="neo-btn min-h-[36px] bg-emerald-600 px-3 py-1 font-bold text-white text-xs border border-[#1a1a1a]"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewSlotRequest(request.id, false)}
                          disabled={saving}
                          className="neo-btn min-h-[36px] bg-rose-600 px-3 py-1 font-bold text-white text-xs border border-[#1a1a1a]"
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 6: PERUBAHAN JADWAL */}
      {activeTab === "perubahan-jadwal" && (
        <div id="perubahan-jadwal" className="space-y-4">
          <div className="neo-card p-4 sm:p-5 bg-white border-2 border-[#1a1a1a]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 rounded border border-amber-600">
                  <TbArrowsExchange className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">
                    Perubahan Jadwal
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5a5a5a] font-medium">
                    Pertukaran jadwal praktikum antar-kelas pada tanggal tertentu secara aman.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#1a1a1a] shrink-0">
                <span>Pilih Tanggal:</span>
                <input
                  type="date"
                  value={actualDate}
                  onChange={(event) => setActualDate(event.target.value)}
                  className="neo-input min-h-[44px] text-xs font-bold border-2 border-[#1a1a1a]"
                />
              </label>
            </div>
            <p className="text-xs text-[#5a5a5a] mt-3 bg-[#f5ede6] p-2.5 border-l-2 border-[#f3701e] font-semibold">
              Pertukaran hanya berlaku pada tanggal ini. Jadwal praktikum resmi tidak diubah.
            </p>
          </div>

          {/* Wizard 4 Langkah Tukar Jadwal */}
          {canWrite && (
            <section className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-5">
              <div className="border-b border-[#1a1a1a]/15 pb-3">
                <h3 className="font-heading text-lg sm:text-xl font-black text-[#1a1a1a] flex items-center gap-2">
                  <TbSparkles className="w-5 h-5 text-[#f3701e]" /> Panduan Pengajuan Pertukaran Jadwal
                </h3>
                <p className="text-xs text-[#5a5a5a] mt-0.5">
                  Ikuti 4 langkah terarah untuk mengajukan pertukaran jadwal antar-kelas pada tanggal tertentu.
                </p>
              </div>

              {/* Langkah 1: Pilih Tanggal */}
              <div className="rounded-xl border border-[#1a1a1a] bg-[#f5ede6] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1a1a1a]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-[10px] text-white">1</span>
                    Tanggal Pertukaran
                  </span>
                  <span className="text-[11px] font-bold text-[#4b607f]">{actualDate}</span>
                </div>
                <input
                  type="date"
                  value={actualDate}
                  onChange={(event) => {
                    setActualDate(event.target.value);
                    setSwapSourceOfferingId("");
                    setSwapTargetOfferingId("");
                  }}
                  className="neo-input min-h-[44px] w-full text-xs font-bold border-2 border-[#1a1a1a] bg-white"
                  aria-label="Pilih tanggal pertukaran jadwal"
                />
              </div>

              {/* Langkah 2: Jadwal Kelas Sendiri (Source) */}
              <div className="rounded-xl border border-[#1a1a1a] bg-[#f5ede6] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1a1a1a]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-[10px] text-white">2</span>
                    Pilih Jadwal Kelas Anda (Sumber)
                  </span>
                  {selectedSwapSource && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-600">
                      Terpilih
                    </span>
                  )}
                </div>

                {offeringsOnSelectedDate.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#1a1a1a] bg-white p-3 text-center text-xs text-[#5a5a5a]">
                    Tidak ada jadwal praktikum kelas Anda yang terdaftar pada tanggal {actualDate}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <CoursePicker
                      offerings={offeringsOnSelectedDate}
                      value={swapSourceOfferingId}
                      onChange={(id) => {
                        setSwapSourceOfferingId(id);
                        setSwapTargetOfferingId("");
                      }}
                      label="Mata kuliah kelas Anda"
                      placeholder="Pilih mata kuliah kelas Anda yang akan ditukar"
                      loading={loading}
                    />
                  </div>
                )}
              </div>

              {/* Langkah 3: Pilih Jadwal Tujuan (Target) */}
              <div className="rounded-xl border border-[#1a1a1a] bg-[#f5ede6] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1a1a1a]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-[10px] text-white">3</span>
                    Pilih Jadwal Tujuan (Target Pertukaran)
                  </span>
                  {swapTargetOfferingId && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-600">
                      Target siap
                    </span>
                  )}
                </div>

                {!selectedSwapSource ? (
                  <div className="rounded-lg border border-dashed border-[#1a1a1a] bg-white p-3 text-center text-xs text-[#5a5a5a]">
                    Selesaikan Langkah 2 terlebih dahulu dengan memilih jadwal kelas Anda.
                  </div>
                ) : eligibleSwapTargets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#1a1a1a] bg-white p-3 text-center text-xs text-[#5a5a5a]">
                    Tidak ada jadwal kelas lain yang memenuhi syarat pertukaran (harus tanggal sama, kelas berbeda, ruangan lab sama, dan durasi sama).
                  </div>
                ) : (
                  <CoursePicker
                    offerings={eligibleSwapTargets}
                    value={swapTargetOfferingId}
                    onChange={setSwapTargetOfferingId}
                    label="Tukar dengan penawaran"
                    placeholder="Pilih penawaran tujuan pertukaran"
                    loading={loading}
                  />
                )}
              </div>

              {/* Langkah 4: Ajukan Pertukaran */}
              <div className="rounded-xl border-2 border-[#1a1a1a] bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#1a1a1a]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-[10px] text-white">4</span>
                    Konfirmasi dan Ajukan
                  </span>
                </div>
                <button
                  type="button"
                  disabled={saving || !swapSourceOfferingId || !swapTargetOfferingId}
                  onClick={() => void requestSwap(swapSourceOfferingId)}
                  className="neo-btn min-h-[48px] w-full bg-[#f3701e] px-4 py-2 font-black text-xs text-white border-2 border-[#1a1a1a] disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <TbArrowsExchange className="w-4 h-4" /> Ajukan Pertukaran Jadwal
                </button>
              </div>
            </section>
          )}

          {/* Jadwal Aktual Hari Terpilih */}
          <section className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-4">
            <h3 className="font-heading text-base sm:text-lg font-black text-[#1a1a1a]">
              Jadwal Praktikum Tanggal {actualDate}
            </h3>

            {actualSchedules.length === 0 ? (
              <p className="text-xs text-[#5a5a5a] italic text-center py-4 bg-[#f5ede6] border border-dashed border-[#1a1a1a]">
                Tidak ada jadwal praktikum pada tanggal ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {actualSchedules.map((item) => (
                  <article
                    key={item.offeringId}
                    className="p-3.5 bg-[#f5ede6] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a] flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <strong className="text-sm font-heading font-black text-[#1a1a1a] block">
                        {item.course?.name || item.course?.code || "Mata kuliah"}
                      </strong>
                      <p className="text-xs text-[#5a5a5a] mt-1">
                        {item.academicClass?.name || item.academicClass?.code || "Kelas"} · {item.startTime}–{item.endTime} WIB · {item.lab?.name || "Lab"}
                      </p>
                    </div>
                    {canWrite && (
                      <button
                        type="button"
                        disabled={saving || !swapTargetOfferingId}
                        onClick={() => void requestSwap(item.offeringId)}
                        className="neo-btn min-h-[44px] bg-[#4b607f] px-4 py-2 font-bold text-xs text-white border-2 border-[#1a1a1a] disabled:opacity-50"
                      >
                        Ajukan tukar slot
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Daftar Pengajuan Pertukaran */}
          <section className="neo-card p-4 sm:p-6 bg-white border-2 border-[#1a1a1a] space-y-3">
            <h3 className="font-heading text-base sm:text-lg font-black text-[#1a1a1a]">
              Daftar Pengajuan Pertukaran Jadwal
            </h3>

            {swaps.length === 0 ? (
              <p className="text-xs text-[#5a5a5a] italic text-center py-4 bg-[#f5ede6] border border-dashed border-[#1a1a1a]">
                Belum ada pengajuan pertukaran jadwal.
              </p>
            ) : (
              <div className="space-y-3">
                {swaps.map((swap) => (
                  <div
                    key={swap.id}
                    className="p-3.5 bg-[#f5ede6] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-[#1a1a1a]">
                        <strong>{offeringLabel(swap.sourceOffering)}</strong> ⇄{" "}
                        <strong>{offeringLabel(swap.targetOffering)}</strong>
                      </p>
                      <p className="text-[#5a5a5a]">
                        Tanggal: {swap.occurrenceDate?.slice(0, 10)} · Status: <span className="font-bold text-[#1a1a1a]">{swap.status}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canWrite && swap.status === "PENDING_CONFIRMATION" && (
                        <button
                          type="button"
                          onClick={() => void confirmSwap(swap.id)}
                          disabled={saving}
                          className="neo-btn min-h-[40px] bg-emerald-600 px-3.5 py-1.5 font-black text-xs text-white border-2 border-[#1a1a1a]"
                        >
                          Konfirmasi kelas
                        </button>
                      )}
                      {(canWrite || role === "KOORDINATOR_LAB") &&
                        (swap.status === "PENDING_CONFIRMATION" || swap.status === "PENDING_APPROVAL") && (
                          <button
                            type="button"
                            onClick={() => void cancelSwap(swap.id)}
                            disabled={saving}
                            className="neo-btn min-h-[40px] bg-rose-600 px-3 py-1.5 font-bold text-xs text-white border-2 border-[#1a1a1a]"
                          >
                            Batalkan
                          </button>
                        )}
                      {role === "KOORDINATOR_LAB" && swap.status === "PENDING_APPROVAL" && (
                        <>
                          <button
                            type="button"
                            onClick={() => void reviewSwap(swap.id, true)}
                            disabled={saving}
                            className="neo-btn min-h-[40px] bg-emerald-600 px-3.5 py-1.5 font-black text-xs text-white border-2 border-[#1a1a1a]"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewSwap(swap.id, false)}
                            disabled={saving}
                            className="neo-btn min-h-[40px] bg-rose-600 px-3 py-1.5 font-bold text-xs text-white border-2 border-[#1a1a1a]"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 7: RIWAYAT */}
      {activeTab === "riwayat" && (
        <div id="riwayat" className="space-y-4">
          <div className="neo-card p-4 sm:p-5 bg-white border-2 border-[#1a1a1a]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#4b607f]/10 rounded border border-[#4b607f]">
                <TbBook2 className="w-6 h-6 text-[#4b607f]" />
              </div>
              <div>
                <h2 className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">Riwayat</h2>
                <p className="text-xs sm:text-sm text-[#5a5a5a] font-medium">
                  Catatan historis seluruh laporan perkuliahan dan perubahannya.
                </p>
              </div>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="neo-card p-8 bg-white border-2 border-[#1a1a1a] text-center">
              <TbBook2 className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="font-bold text-base text-[#1a1a1a]">Belum ada riwayat laporan</p>
              <p className="text-xs text-[#5a5a5a] mt-1">Laporan yang telah disimpan akan tercatat di sini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.BELUM_PASTI;
                const offering = report.offering || offerings.find((o) => o.id === report.offeringId);
                return (
                  <article
                    key={report.id}
                    className="neo-card bg-white p-4 sm:p-5 border-2 border-[#1a1a1a] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[2px_2px_0px_0px_#1a1a1a]"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-heading font-black text-base sm:text-lg text-[#1a1a1a]">
                          {offering?.course?.name || offering?.course?.code || "Mata kuliah"}
                        </strong>
                        <span className={`neo-badge text-xs font-black ${statusConf.badgeClass}`}>
                          {statusConf.label}
                        </span>
                        <span className="neo-badge bg-[#e8d8c9] text-xs font-bold">
                          Revisi {report.revision}
                        </span>
                      </div>
                      <p className="text-xs text-[#5a5a5a] font-semibold">
                        Kelas: {offering?.academicClass?.name || offering?.academicClass?.code || "Kelas"} ·{" "}
                        Semester: {offering?.term?.name || offering?.term?.code || "-"} ·{" "}
                        Dosen: {offering?.dosen?.name || "Belum ditentukan"}
                      </p>
                      <p className="text-xs text-[#5a5a5a]">
                        Tanggal Pelaporan: {formatDate(report.reportDate || report.updatedAt)}
                      </p>
                      {report.notes && (
                        <p className="text-xs text-gray-800 bg-[#f5ede6] p-2 border-l-2 border-[#1a1a1a] mt-1">
                          Catatan: &ldquo;{report.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {canWrite && (
                      <div className="shrink-0 pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => startEdit(report)}
                          className="neo-btn min-h-[44px] bg-white px-4 py-2 font-bold text-xs border-2 border-[#1a1a1a] hover:bg-[#e8d8c9]"
                        >
                          Revisi
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
