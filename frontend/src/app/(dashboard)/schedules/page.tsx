"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbTrash,
  TbTrashX,
  TbSquare,
  TbSquareCheck,
  TbEdit,
  TbCalendarEvent,
  TbArrowsExchange,
  TbCalendarOff,
  TbCalendarPlus,
  TbCheck,
  TbX,
  TbClock,
  TbLoader2,
} from "react-icons/tb";
import type {
  DayOfWeek,
  Role,
  ScheduleChangeRequest,
  ScheduleChangeStatus,
  ScheduleChangeType,
  ScheduleType,
} from "@/types";
import api from "@/services/api";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/providers/toast-provider";

interface ScheduleItem {
  id: string;
  title: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  labName: string;
  lecturerName: string;
  assistantName?: string;
  semester?: string;
  className?: string;
  type: ScheduleType;
}

interface LabOption {
  id: string;
  name: string;
}

interface LocalUser {
  role?: Role;
  isKetuaKelas?: boolean;
  name?: string;
  className?: string;
}

type ScheduleChangeItem = Omit<ScheduleChangeRequest, "schedule" | "requestedBy" | "approvedBy"> & {
  schedule?: {
    id?: string;
    title?: string;
    day?: DayOfWeek;
    startTime?: string;
    endTime?: string;
    className?: string;
    lab?: { name?: string };
  };
  requestedBy?: {
    id?: string;
    name?: string;
    className?: string;
  };
};

interface ScheduleChangeStats {
  pending: number;
  approved: number;
  rejected: number;
}

type TabKey = "SCHEDULES" | "REQUESTS";

const days: DayOfWeek[] = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"];

const dayLabels: Record<DayOfWeek, string> = {
  SENIN: "Senin",
  SELASA: "Selasa",
  RABU: "Rabu",
  KAMIS: "Kamis",
  JUMAT: "Jumat",
  SABTU: "Sabtu",
  MINGGU: "Minggu",
};

const typeColors: Record<ScheduleType, string> = {
  PRAKTIKUM: "bg-[#4b607f] text-white",
  PEMINJAMAN: "bg-[#f3701e] text-white",
  KEGIATAN: "bg-[#22c55e] text-white",
};

const requestTypeMap: Record<ScheduleChangeType, { label: string; icon: typeof TbArrowsExchange }> = {
  RESCHEDULE: { label: "Pindah Waktu", icon: TbArrowsExchange },
  CANCEL_SESSION: { label: "Batalkan Jadwal", icon: TbCalendarOff },
  EXTRA_SLOT: { label: "Slot Tambahan", icon: TbCalendarPlus },
};

const requestTypeColor: Record<ScheduleChangeType, string> = {
  RESCHEDULE: "bg-[#4b607f] text-white",
  CANCEL_SESSION: "bg-[#f3701e] text-white",
  EXTRA_SLOT: "bg-[#7c5cff] text-white",
};

const statusColor: Record<ScheduleChangeStatus, string> = {
  PENDING: "bg-yellow-300 text-[#1a1a1a]",
  APPROVED: "bg-green-500 text-white",
  REJECTED: "bg-red-500 text-white",
};

export default function SchedulesPage() {
  const toast = useToast();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "ALL">("ALL");
  const [selectedLab, setSelectedLab] = useState<string>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLabsLoading, setIsLabsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const [activeTab, setActiveTab] = useState<TabKey>("SCHEDULES");
  const [user, setUser] = useState<LocalUser>({});

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const [myRequests, setMyRequests] = useState<ScheduleChangeItem[]>([]);
  const [allRequests, setAllRequests] = useState<ScheduleChangeItem[]>([]);
  const [requestStats, setRequestStats] = useState<ScheduleChangeStats>({ pending: 0, approved: 0, rejected: 0 });
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState(false);

  const [approveTarget, setApproveTarget] = useState<ScheduleChangeItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ScheduleChangeItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const [form, setForm] = useState({
    title: "",
    day: "SENIN" as DayOfWeek,
    startTime: "",
    endTime: "",
    labId: "",
    lecturerName: "",
    assistantId: "",
    semester: "",
    className: "",
    type: "PRAKTIKUM" as ScheduleType,
  });

  const [editForm, setEditForm] = useState({
    title: "",
    day: "SENIN" as DayOfWeek,
    startTime: "",
    endTime: "",
    labId: "",
    lecturerName: "",
    assistantId: "",
    semester: "",
    className: "",
    type: "PRAKTIKUM" as ScheduleType,
  });

  const [requestForm, setRequestForm] = useState({
    requestType: "RESCHEDULE" as ScheduleChangeType,
    scheduleId: "",
    reason: "",
    newDay: "SENIN" as DayOfWeek,
    newStartTime: "",
    newEndTime: "",
    newLabId: "",
    cancelDate: "",
  });

  const canReviewRequests = user.role === "KOORDINATOR_LAB" || user.role === "ASISTEN_LAB";
  const isKetuaKelas = user.role === "MAHASISWA" && Boolean(user.isKetuaKelas);
  const canManageSchedules = user.role === "KOORDINATOR_LAB";

  const resetRequestForm = () => {
    setRequestForm({
      requestType: "RESCHEDULE",
      scheduleId: "",
      reason: "",
      newDay: "SENIN",
      newStartTime: "",
      newEndTime: "",
      newLabId: "",
      cancelDate: "",
    });
  };

  const fetchLabs = async () => {
    setIsLabsLoading(true);
    try {
      const response = await api.get<{ data: { id: string; name: string }[] }>("/labs");
      setLabs(response.data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat data lab");
    } finally {
      setIsLabsLoading(false);
    }
  };

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDay !== "ALL") {
        params.set("day", selectedDay);
      }
      if (selectedLab !== "ALL") {
        params.set("labId", selectedLab);
      }

      const query = params.toString();
      const endpoint = query ? `/schedules?${query}` : "/schedules";
      const response = await api.get<{ data: any[] }>(endpoint);

      const mapped: ScheduleItem[] = (response.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        day: item.day,
        startTime: item.startTime,
        endTime: item.endTime,
        labName: item.lab?.name ?? "-",
        lecturerName: item.lecturerName ?? "-",
        assistantName: item.assistant?.name,
        semester: item.semester,
        className: item.className,
        type: item.type,
      }));

      setSchedules(mapped);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat jadwal");
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    setIsRequestsLoading(true);
    try {
      const response = await api.get<{ data: ScheduleChangeItem[] }>("/schedule-changes/my");
      setMyRequests(response.data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat riwayat request");
    } finally {
      setIsRequestsLoading(false);
    }
  };

  const fetchAllRequests = async () => {
    setIsRequestsLoading(true);
    try {
      const response = await api.get<{ data: { items?: ScheduleChangeItem[]; } | ScheduleChangeItem[] }>("/schedule-changes");
      const raw = response.data;
      setAllRequests(Array.isArray(raw) ? raw : (raw as any)?.items ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat request perubahan");
    } finally {
      setIsRequestsLoading(false);
    }
  };

  const fetchRequestStats = async () => {
    setIsStatsLoading(true);
    try {
      const response = await api.get<{ data: { pending?: number; approved?: number; rejected?: number } }>("/schedule-changes/stats");
      const data = response.data ?? {};
      setRequestStats({
        pending: data.pending ?? 0,
        approved: data.approved ?? 0,
        rejected: data.rejected ?? 0,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat statistik request");
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [selectedDay, selectedLab]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(parsed);
    } catch {
      setUser({});
    }
  }, []);

  useEffect(() => {
    if (isKetuaKelas) {
      fetchMyRequests();
    }
  }, [isKetuaKelas]);

  useEffect(() => {
    if (canReviewRequests) {
      fetchRequestStats();
    }
  }, [canReviewRequests]);

  useEffect(() => {
    if (canReviewRequests && activeTab === "REQUESTS") {
      fetchAllRequests();
    }
  }, [canReviewRequests, activeTab]);

  const groupedByDay = useMemo(
    () =>
      days.reduce(
        (acc, day) => {
          const items = schedules.filter((s) => s.day === day);
          if (items.length > 0) acc[day] = items;
          return acc;
        },
        {} as Record<DayOfWeek, ScheduleItem[]>
      ),
    [schedules]
  );

  const pendingRequests = useMemo(
    () => allRequests.filter((item) => item.status === "PENDING"),
    [allRequests]
  );

  const requestHistory = useMemo(
    () => allRequests.filter((item) => item.status !== "PENDING"),
    [allRequests]
  );

  const handleCreateSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      await api.post("/schedules", {
        title: form.title,
        day: form.day,
        startTime: form.startTime,
        endTime: form.endTime,
        labId: form.labId,
        lecturerName: form.lecturerName || undefined,
        assistantId: form.assistantId || undefined,
        semester: form.semester || undefined,
        className: form.className || undefined,
        type: form.type,
      });

      setShowCreateModal(false);
      setForm({
        title: "",
        day: "SENIN",
        startTime: "",
        endTime: "",
        labId: "",
        lecturerName: "",
        assistantId: "",
        semester: "",
        className: "",
        type: "PRAKTIKUM",
      });

      await fetchSchedules();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat jadwal");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteOne = (id: string) => {
    setConfirmModal({
      open: true,
      title: "Hapus Jadwal",
      message: "Yakin ingin menghapus jadwal ini? Aksi ini tidak bisa dibatalkan.",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await api.delete<any>(`/schedules/${id}`);
          await fetchSchedules();
        } catch (err: any) {
          toast.error(err?.message ?? "Gagal menghapus jadwal");
        } finally {
          setIsDeleting(false);
          setConfirmModal((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const openEditModal = async (schedule: ScheduleItem) => {
    try {
      const res = await api.get<{ data: any }>(`/schedules/${schedule.id}`);
      const detail = res.data;
      setEditingSchedule(schedule);
      setEditForm({
        title: detail.title ?? "",
        day: detail.day ?? "SENIN",
        startTime: detail.startTime ?? "",
        endTime: detail.endTime ?? "",
        labId: detail.labId ?? "",
        lecturerName: detail.lecturerName ?? "",
        assistantId: detail.assistantId ?? "",
        semester: detail.semester ?? "",
        className: detail.className ?? "",
        type: detail.type ?? "PRAKTIKUM",
      });
      setShowEditModal(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat detail jadwal");
    }
  };

  const handleEditSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setIsEditing(true);

    try {
      await api.put(`/schedules/${editingSchedule.id}`, {
        title: editForm.title,
        day: editForm.day,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        labId: editForm.labId,
        lecturerName: editForm.lecturerName || undefined,
        assistantId: editForm.assistantId || undefined,
        semester: editForm.semester || undefined,
        className: editForm.className || undefined,
        type: editForm.type,
      });

      setShowEditModal(false);
      setEditingSchedule(null);
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengupdate jadwal");
    } finally {
      setIsEditing(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      open: true,
      title: "Hapus Jadwal Terpilih",
      message: `Yakin ingin menghapus ${selectedIds.size} jadwal yang dipilih?`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await api.post<any>("/schedules/bulk-delete", { ids: Array.from(selectedIds) });
          setSelectedIds(new Set());
          await fetchSchedules();
        } catch (err: any) {
          toast.error(err?.message ?? "Gagal menghapus jadwal");
        } finally {
          setIsDeleting(false);
          setConfirmModal((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleDeleteAll = () => {
    setConfirmModal({
      open: true,
      title: "Hapus Semua Jadwal",
      message: "HAPUS SEMUA jadwal yang ditampilkan? Aksi ini tidak bisa dibatalkan.",
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          const params = new URLSearchParams();
          if (selectedLab !== "ALL") params.set("labId", selectedLab);
          if (selectedDay !== "ALL") params.set("day", selectedDay);
          const query = params.toString();
          await api.delete<any>(`/schedules/all${query ? `?${query}` : ""}`);
          setSelectedIds(new Set());
          await fetchSchedules();
        } catch (err: any) {
          toast.error(err?.message ?? "Gagal menghapus semua jadwal");
        } finally {
          setIsDeleting(false);
          setConfirmModal((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === schedules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(schedules.map((s) => s.id)));
    }
  };

  const getScheduleLabel = (schedule?: ScheduleChangeItem["schedule"]) => {
    if (!schedule) return "-";
    const day = schedule.day ? dayLabels[schedule.day] : "-";
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime} - ${schedule.endTime}` : "-";
    return `${schedule.title || "Jadwal"} • ${day} • ${time}`;
  };

  const getRequestedChangeText = (item: ScheduleChangeItem) => {
    if (item.requestType === "RESCHEDULE") {
      return `Ubah ke ${item.newDay ? dayLabels[item.newDay] : "-"}, ${item.newStartTime || "-"} - ${item.newEndTime || "-"}${item.newLabId ? " dengan lab baru" : ""}`;
    }
    if (item.requestType === "CANCEL_SESSION") {
      return `Batalkan sesi pada ${item.cancelDate || "-"}`;
    }
    return `Tambah slot ${item.newDay ? dayLabels[item.newDay] : "-"}, ${item.newStartTime || "-"} - ${item.newEndTime || "-"}`;
  };

  const handleSubmitRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (requestForm.reason.trim().length < 10) {
      toast.error("Alasan minimal 10 karakter.");
      return;
    }

    if (
      (requestForm.requestType === "RESCHEDULE" || requestForm.requestType === "CANCEL_SESSION") &&
      !requestForm.scheduleId
    ) {
      toast.error("Silakan pilih jadwal yang diajukan.");
      return;
    }

    if (requestForm.requestType === "RESCHEDULE") {
      if (!requestForm.newDay || !requestForm.newStartTime || !requestForm.newEndTime) {
        toast.error("Lengkapi hari dan jam baru untuk reschedule.");
        return;
      }
    }

    if (requestForm.requestType === "CANCEL_SESSION" && !requestForm.cancelDate) {
      toast.error("Tanggal pembatalan wajib diisi.");
      return;
    }

    if (requestForm.requestType === "EXTRA_SLOT") {
      if (!requestForm.newDay || !requestForm.newStartTime || !requestForm.newEndTime || !requestForm.newLabId) {
        toast.error("Untuk slot tambahan, hari, jam, dan lab wajib diisi.");
        return;
      }
    }

    setIsSubmittingRequest(true);
    try {
      await api.post("/schedule-changes", {
        requestType: requestForm.requestType,
        scheduleId:
          requestForm.requestType === "RESCHEDULE" || requestForm.requestType === "CANCEL_SESSION"
            ? requestForm.scheduleId
            : undefined,
        reason: requestForm.reason.trim(),
        newDay:
          requestForm.requestType === "RESCHEDULE" || requestForm.requestType === "EXTRA_SLOT"
            ? requestForm.newDay
            : undefined,
        newStartTime:
          requestForm.requestType === "RESCHEDULE" || requestForm.requestType === "EXTRA_SLOT"
            ? requestForm.newStartTime
            : undefined,
        newEndTime:
          requestForm.requestType === "RESCHEDULE" || requestForm.requestType === "EXTRA_SLOT"
            ? requestForm.newEndTime
            : undefined,
        newLabId:
          requestForm.requestType === "EXTRA_SLOT" || (requestForm.requestType === "RESCHEDULE" && requestForm.newLabId)
            ? requestForm.newLabId || undefined
            : undefined,
        cancelDate: requestForm.requestType === "CANCEL_SESSION" ? requestForm.cancelDate : undefined,
      });

      setShowRequestModal(false);
      resetRequestForm();
      await fetchMyRequests();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengirim request perubahan jadwal");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setRequestActionLoading(true);
    try {
      await api.patch(`/schedule-changes/${approveTarget.id}/approve`, {
        adminNotes: adminNotes.trim() || undefined,
      });
      setApproveTarget(null);
      setAdminNotes("");
      await Promise.all([fetchAllRequests(), fetchRequestStats()]);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal menyetujui request");
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (rejectionReason.trim().length < 5) {
      toast.error("Alasan penolakan minimal 5 karakter.");
      return;
    }

    setRequestActionLoading(true);
    try {
      await api.patch(`/schedule-changes/${rejectTarget.id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setRejectTarget(null);
      setRejectionReason("");
      await Promise.all([fetchAllRequests(), fetchRequestStats()]);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal menolak request");
    } finally {
      setRequestActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="neo-card p-6 bg-[#e8d8c9]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">{activeTab === "SCHEDULES" ? "Jadwal Lab" : "Request Perubahan"}</h1>
            <p className="text-[#5a5a5a] mt-1 font-medium">
              {activeTab === "SCHEDULES"
                ? "Jadwal penggunaan laboratorium per minggu"
                : "Kelola permintaan perubahan jadwal kelas"}
            </p>
          </div>
          {canReviewRequests && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("SCHEDULES")}
                className={`px-4 py-2 rounded-lg font-bold text-sm neo-border-sm ${
                  activeTab === "SCHEDULES" ? "bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"
                }`}
              >
                Jadwal Lab
              </button>
              <button
                onClick={() => setActiveTab("REQUESTS")}
                className={`px-4 py-2 rounded-lg font-bold text-sm neo-border-sm relative ${
                  activeTab === "REQUESTS" ? "bg-[#f3701e] text-white" : "bg-white text-[#1a1a1a]"
                }`}
              >
                Request Perubahan
                {requestStats.pending > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
                    {requestStats.pending}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === "SCHEDULES" && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {canManageSchedules && selectedIds.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-4 py-2.5 bg-red-500 text-white neo-btn text-sm flex items-center gap-2"
                >
                  <TbTrash className="w-4 h-4" />
                  Hapus ({selectedIds.size})
                </motion.button>
              )}
              {canManageSchedules && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteAll}
                  disabled={isDeleting || schedules.length === 0}
                  className="px-4 py-2.5 bg-white text-red-600 border-2 border-red-400 rounded-lg text-sm flex items-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  <TbTrashX className="w-4 h-4" />
                  Hapus Semua
                </motion.button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isKetuaKelas && (
                <button
                  onClick={() => {
                    setShowRequestModal(true);
                  }}
                  className="px-5 py-2.5 bg-[#f3701e] text-white neo-btn flex items-center gap-2"
                >
                  <TbArrowsExchange className="w-4 h-4" />
                  Ajukan Perubahan
                </button>
              )}
              {canManageSchedules && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 bg-[#4b607f] text-white neo-btn"
                >
                  + Tambah Jadwal
                </motion.button>
              )}
            </div>
          </div>

          <div className="neo-border-sm bg-white rounded-xl p-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedDay("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                selectedDay === "ALL"
                  ? "bg-[#4b607f] text-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a]"
                  : "bg-white text-[#1a1a1a] neo-border-sm hover:bg-[#f5ede6] hover:shadow-[2px_2px_0px_#1a1a1a]"
              }`}
            >
              Semua Hari
            </button>
            {days.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  selectedDay === day
                    ? "bg-[#4b607f] text-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a]"
                    : "bg-white text-[#1a1a1a] neo-border-sm hover:bg-[#f5ede6] hover:shadow-[2px_2px_0px_#1a1a1a]"
                }`}
              >
                {dayLabels[day]}
              </button>
            ))}
          </div>

          <div className="neo-border-sm bg-white rounded-xl p-3 flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedLab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                selectedLab === "ALL"
                  ? "bg-[#f3701e] text-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a]"
                  : "bg-white text-[#1a1a1a] neo-border-sm hover:bg-[#f5ede6] hover:shadow-[2px_2px_0px_#1a1a1a]"
              }`}
            >
              Semua Lab
            </button>
            {labs.map((lab) => (
              <button
                key={lab.id}
                onClick={() => setSelectedLab(lab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  selectedLab === lab.id
                    ? "bg-[#f3701e] text-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a]"
                    : "bg-white text-[#1a1a1a] neo-border-sm hover:bg-[#f5ede6] hover:shadow-[2px_2px_0px_#1a1a1a]"
                }`}
              >
                {lab.name}
              </button>
            ))}
          </div>

          {canManageSchedules && schedules.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-[#5a5a5a] hover:text-[#1a1a1a] transition-colors"
              >
                {selectedIds.size === schedules.length ? (
                  <TbSquareCheck className="w-5 h-5 text-[#4b607f]" />
                ) : (
                  <TbSquare className="w-5 h-5" />
                )}
                {selectedIds.size === schedules.length ? "Batal pilih semua" : "Pilih semua"}
              </button>
              {selectedIds.size > 0 && (
                <span className="text-xs text-[#5a5a5a]">
                  {selectedIds.size} dari {schedules.length} dipilih
                </span>
              )}
            </div>
          )}

          {isLabsLoading && <p className="text-sm text-[#5a5a5a]">Memuat daftar lab...</p>}

          <div className="space-y-6">
            {isLoading && (
              <div className="neo-card p-8 text-center">
                <p className="text-[#5a5a5a]">Memuat jadwal...</p>
              </div>
            )}

            {Object.entries(groupedByDay).map(([day, items]) => (
              <motion.div key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="font-heading font-bold text-lg text-[#1a1a1a] mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[#4b607f] neo-border-sm flex items-center justify-center text-white text-xs font-bold">
                    {dayLabels[day as DayOfWeek].charAt(0)}
                  </span>
                  {dayLabels[day as DayOfWeek]}
                </h3>

                <div className="space-y-2">
                  {items.map((schedule, i) => (
                     <motion.div
                      key={schedule.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`neo-card p-4 sm:p-5 neo-hover ${selectedIds.has(schedule.id) ? "ring-2 ring-[#4b607f]" : ""}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                          {canManageSchedules && (
                            <button onClick={() => toggleSelect(schedule.id)} className="flex-shrink-0 mt-0.5 sm:mt-0">
                              {selectedIds.has(schedule.id) ? (
                                <TbSquareCheck className="w-5 h-5 text-[#4b607f]" />
                              ) : (
                                <TbSquare className="w-5 h-5 text-[#9ca3af]" />
                              )}
                            </button>
                          )}
                          <div className="text-center min-w-[70px] sm:min-w-[80px] flex-shrink-0">
                            <p className="font-bold text-sm text-[#1a1a1a]">{schedule.startTime}</p>
                            <p className="text-xs text-[#5a5a5a]">{schedule.endTime}</p>
                          </div>
                          <div className="hidden sm:block w-px h-10 bg-[#1a1a1a]" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm text-[#1a1a1a] truncate">{schedule.title}</p>
                            <p className="text-xs text-[#5a5a5a] truncate">
                              {schedule.labName} &bull; {schedule.lecturerName}
                              {schedule.className && ` • ${schedule.className}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {schedule.assistantName && (
                            <span className="neo-badge px-2 py-0.5 bg-[#f5ede6] text-[#1a1a1a] text-xs truncate max-w-[120px]">{schedule.assistantName}</span>
                          )}
                          <span className={`neo-badge px-2 py-0.5 text-xs ${typeColors[schedule.type]}`}>{schedule.type}</span>
                          {canManageSchedules && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(schedule);
                                }}
                                className="min-w-[44px] min-h-[44px] rounded border-2 border-[#1a1a1a] bg-white text-[#4b607f] flex items-center justify-center hover:bg-[#f5ede6] transition-colors"
                                title="Edit jadwal"
                              >
                                <TbEdit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteOne(schedule.id)}
                                className="min-w-[44px] min-h-[44px] rounded border-2 border-red-300 bg-white text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors"
                                title="Hapus jadwal"
                              >
                                <TbTrash className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}

            {!isLoading && Object.keys(groupedByDay).length === 0 && (
              <div className="neo-card p-12 text-center flex flex-col items-center justify-center">
                <TbCalendarOff className="w-12 h-12 text-[#5a5a5a] mb-3" />
                <h3 className="font-heading text-xl font-bold text-[#1a1a1a] mb-1">Jadwal Kosong</h3>
                <p className="text-[#5a5a5a]">Tidak ada jadwal untuk filter yang dipilih</p>
              </div>
            )}
          </div>

          {isKetuaKelas && (
            <div className="neo-card p-5 bg-[#e8d8c9] border-[#1a1a1a] space-y-3">
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Riwayat Request Saya</h2>
              {isRequestsLoading ? (
                <p className="text-sm text-[#5a5a5a] flex items-center gap-2">
                  <TbLoader2 className="w-4 h-4 animate-spin" /> Memuat request...
                </p>
              ) : myRequests.length === 0 ? (
                <p className="text-sm text-[#5a5a5a]">Belum ada request perubahan jadwal.</p>
              ) : (
                <div className="space-y-2">
                  {myRequests.map((item) => (
                    <div key={item.id} className="neo-card p-3 bg-white space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`neo-badge px-2 py-0.5 text-xs ${requestTypeColor[item.requestType]}`}>
                          {requestTypeMap[item.requestType].label}
                        </span>
                        <span className={`neo-badge px-2 py-0.5 text-xs ${statusColor[item.status]}`}>{item.status}</span>
                        <span className="text-xs text-[#5a5a5a]">{new Date(item.createdAt).toLocaleString("id-ID")}</span>
                      </div>
                      <p className="text-sm text-[#1a1a1a]">{getRequestedChangeText(item)}</p>
                      <p className="text-xs text-[#5a5a5a]">{item.reason}</p>
                      {item.rejectionReason && (
                        <p className="text-xs text-red-600 font-semibold">Alasan ditolak: {item.rejectionReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "REQUESTS" && canReviewRequests && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="neo-card p-4 bg-white">
              <p className="text-xs font-bold text-[#5a5a5a] uppercase">Total Pending</p>
              <p className="font-heading text-2xl sm:text-3xl text-[#f3701e]">{isStatsLoading ? "..." : requestStats.pending}</p>
            </div>
            <div className="neo-card p-4 bg-white">
              <p className="text-xs font-bold text-[#5a5a5a] uppercase">Approved</p>
              <p className="font-heading text-2xl sm:text-3xl text-green-600">{isStatsLoading ? "..." : requestStats.approved}</p>
            </div>
            <div className="neo-card p-4 bg-white">
              <p className="text-xs font-bold text-[#5a5a5a] uppercase">Rejected</p>
              <p className="font-heading text-2xl sm:text-3xl text-red-600">{isStatsLoading ? "..." : requestStats.rejected}</p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Request Pending</h2>
            {isRequestsLoading ? (
              <div className="neo-card p-6 text-sm text-[#5a5a5a] flex items-center gap-2">
                <TbLoader2 className="w-4 h-4 animate-spin" /> Memuat request...
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="neo-card p-6 text-sm text-[#5a5a5a]">Tidak ada request pending.</div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((item) => {
                  const RequestIcon = requestTypeMap[item.requestType].icon;
                  return (
                    <div key={item.id} className="neo-card p-4 bg-white space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`neo-badge px-2 py-0.5 text-xs flex items-center gap-1 ${requestTypeColor[item.requestType]}`}>
                            <RequestIcon className="w-3.5 h-3.5" />
                            {requestTypeMap[item.requestType].label}
                          </span>
                          <span className="neo-badge px-2 py-0.5 text-xs bg-yellow-300 text-[#1a1a1a]">PENDING</span>
                        </div>
                        <span className="text-xs text-[#5a5a5a]">{new Date(item.createdAt).toLocaleString("id-ID")}</span>
                      </div>
                      <p className="text-sm text-[#1a1a1a]">
                        <span className="font-bold">Pemohon:</span> {item.requestedBy?.name || "-"}
                        {item.requestedBy?.className ? ` (${item.requestedBy.className})` : ""}
                      </p>
                      <p className="text-sm text-[#1a1a1a]"><span className="font-bold">Jadwal Saat Ini:</span> {getScheduleLabel(item.schedule)}</p>
                      <p className="text-sm text-[#1a1a1a]"><span className="font-bold">Perubahan:</span> {getRequestedChangeText(item)}</p>
                      <p className="text-sm text-[#5a5a5a]"><span className="font-bold text-[#1a1a1a]">Alasan:</span> {item.reason}</p>
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          onClick={() => {
                            setApproveTarget(item);
                            setAdminNotes("");
                          }}
                          className="neo-btn bg-green-600 text-white text-sm flex items-center justify-center gap-1 min-h-[44px] px-4 py-2"
                        >
                          <TbCheck className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectTarget(item);
                            setRejectionReason("");
                          }}
                          className="neo-btn bg-red-500 text-white text-sm flex items-center justify-center gap-1 min-h-[44px] px-4 py-2"
                        >
                          <TbX className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Riwayat Request</h2>
            {requestHistory.length === 0 ? (
              <div className="neo-card p-6 text-sm text-[#5a5a5a]">Belum ada riwayat approve/reject.</div>
            ) : (
              <div className="space-y-2">
                {requestHistory.map((item) => (
                  <div key={item.id} className="neo-card p-3 bg-white">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`neo-badge px-2 py-0.5 text-xs ${requestTypeColor[item.requestType]}`}>
                        {requestTypeMap[item.requestType].label}
                      </span>
                      <span className={`neo-badge px-2 py-0.5 text-xs ${statusColor[item.status]}`}>{item.status}</span>
                      <span className="text-xs text-[#5a5a5a]">{item.requestedBy?.name || "-"}</span>
                    </div>
                    <p className="text-xs text-[#5a5a5a] mt-1">{getRequestedChangeText(item)}</p>
                    {item.rejectionReason && <p className="text-xs text-red-600">Alasan reject: {item.rejectionReason}</p>}
                    {item.adminNotes && <p className="text-xs text-[#4b607f]">Catatan admin: {item.adminNotes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <AnimatePresence>
        {showRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowRequestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#e8d8c9] shadow-[6px_6px_0px_#1a1a1a]"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a] truncate">Ajukan Perubahan Jadwal</h2>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleSubmitRequest}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Tipe Request</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(
                      [
                        { key: "RESCHEDULE", label: "Pindah Waktu", icon: TbArrowsExchange },
                        { key: "CANCEL_SESSION", label: "Batalkan Jadwal", icon: TbCalendarOff },
                        { key: "EXTRA_SLOT", label: "Slot Tambahan", icon: TbCalendarPlus },
                      ] as { key: ScheduleChangeType; label: string; icon: typeof TbArrowsExchange }[]
                    ).map((type) => {
                      const Icon = type.icon;
                      const active = requestForm.requestType === type.key;
                      return (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => setRequestForm((prev) => ({ ...prev, requestType: type.key, scheduleId: "", newLabId: "" }))}
                          className={`p-3 text-left neo-border-sm rounded-lg flex items-center gap-2 ${
                            active ? "bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm font-bold">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(requestForm.requestType === "RESCHEDULE" || requestForm.requestType === "CANCEL_SESSION") && (
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Pilih Jadwal</label>
                    <select
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                      value={requestForm.scheduleId}
                      onChange={(e) => setRequestForm((prev) => ({ ...prev, scheduleId: e.target.value }))}
                      required
                    >
                      <option value="">Pilih jadwal</option>
                      {schedules.map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.title} • {dayLabels[schedule.day]} • {schedule.startTime}-{schedule.endTime} • {schedule.labName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {requestForm.requestType === "RESCHEDULE" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Hari Baru</label>
                        <select
                          className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                          value={requestForm.newDay}
                          onChange={(e) => setRequestForm((prev) => ({ ...prev, newDay: e.target.value as DayOfWeek }))}
                        >
                          {days.map((d) => (
                            <option key={d} value={d}>
                              {dayLabels[d]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Mulai Baru</label>
                        <input
                          type="time"
                          className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                          value={requestForm.newStartTime}
                          onChange={(e) => setRequestForm((prev) => ({ ...prev, newStartTime: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Selesai Baru</label>
                        <input
                          type="time"
                          className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                          value={requestForm.newEndTime}
                          onChange={(e) => setRequestForm((prev) => ({ ...prev, newEndTime: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lab Baru (Opsional)</label>
                      <select
                        className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                        value={requestForm.newLabId}
                        onChange={(e) => setRequestForm((prev) => ({ ...prev, newLabId: e.target.value }))}
                      >
                        <option value="">Tetap lab saat ini</option>
                        {labs.map((lab) => (
                          <option key={lab.id} value={lab.id}>
                            {lab.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {requestForm.requestType === "CANCEL_SESSION" && (
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Tanggal yang Dibatalkan</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                      value={requestForm.cancelDate}
                      onChange={(e) => setRequestForm((prev) => ({ ...prev, cancelDate: e.target.value }))}
                      required
                    />
                  </div>
                )}

                {requestForm.requestType === "EXTRA_SLOT" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Hari</label>
                      <select
                        className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                        value={requestForm.newDay}
                        onChange={(e) => setRequestForm((prev) => ({ ...prev, newDay: e.target.value as DayOfWeek }))}
                      >
                        {days.map((d) => (
                          <option key={d} value={d}>
                            {dayLabels[d]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lab</label>
                      <select
                        className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                        value={requestForm.newLabId}
                        onChange={(e) => setRequestForm((prev) => ({ ...prev, newLabId: e.target.value }))}
                        required
                      >
                        <option value="">Pilih Lab</option>
                        {labs.map((lab) => (
                          <option key={lab.id} value={lab.id}>
                            {lab.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Mulai</label>
                      <input
                        type="time"
                        className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                        value={requestForm.newStartTime}
                        onChange={(e) => setRequestForm((prev) => ({ ...prev, newStartTime: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Selesai</label>
                      <input
                        type="time"
                        className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                        value={requestForm.newEndTime}
                        onChange={(e) => setRequestForm((prev) => ({ ...prev, newEndTime: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Alasan (minimal 10 karakter)</label>
                  <textarea
                    required
                    minLength={10}
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm min-h-[100px]"
                    placeholder="Jelaskan alasan perubahan jadwal"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={isSubmittingRequest} className="flex-1 py-3 min-h-[44px] bg-[#f3701e] text-white neo-btn">
                    {isSubmittingRequest ? "Mengirim..." : "Kirim Request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 py-3 min-h-[44px] bg-white text-[#1a1a1a] neo-btn"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {approveTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setApproveTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading text-xl font-bold text-[#1a1a1a]">Approve Request</h3>
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#5a5a5a] mb-3">Tambahkan catatan admin (opsional).</p>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-4 py-3 neo-input focus:outline-none text-sm min-h-[90px]"
                placeholder="Catatan untuk pemohon"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={handleApprove} disabled={requestActionLoading} className="flex-1 py-2.5 min-h-[44px] neo-btn bg-green-600 text-white">
                  {requestActionLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Proses...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <TbCheck className="w-4 h-4" /> Konfirmasi
                    </span>
                  )}
                </button>
                <button onClick={() => setApproveTarget(null)} className="flex-1 py-2.5 min-h-[44px] neo-btn bg-white text-[#1a1a1a]">
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setRejectTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-heading text-xl font-bold text-[#1a1a1a]">Reject Request</h3>
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#5a5a5a] mb-3">Alasan penolakan wajib diisi.</p>
              <textarea
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-4 py-3 neo-input focus:outline-none text-sm min-h-[90px]"
                placeholder="Tulis alasan penolakan"
              />
              <div className="flex gap-2 mt-4">
                <button onClick={handleReject} disabled={requestActionLoading} className="flex-1 py-2.5 min-h-[44px] neo-btn bg-red-500 text-white">
                  {requestActionLoading ? (
                    <span className="inline-flex items-center gap-1">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Proses...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <TbX className="w-4 h-4" /> Konfirmasi Reject
                    </span>
                  )}
                </button>
                <button onClick={() => setRejectTarget(null)} className="flex-1 py-2.5 min-h-[44px] neo-btn bg-white text-[#1a1a1a]">
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && canManageSchedules && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a] truncate">Tambah Jadwal Baru</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleCreateSchedule}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Mata Kuliah / Judul</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Pemrograman Web"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lab</label>
                    <select
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                      required
                      value={form.labId}
                      onChange={(e) => setForm((prev) => ({ ...prev, labId: e.target.value }))}
                    >
                      <option value="">Pilih Lab</option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Hari</label>
                    <select
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                      value={form.day}
                      onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value as DayOfWeek }))}
                    >
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {dayLabels[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Mulai</label>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Selesai</label>
                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Semester</label>
                    <input
                      type="text"
                      value={form.semester}
                      onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}
                      placeholder="e.g. 4"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kelas</label>
                    <input
                      type="text"
                      value={form.className}
                      onChange={(e) => setForm((prev) => ({ ...prev, className: e.target.value }))}
                      placeholder="e.g. TI-4A"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Tipe</label>
                  <select
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as ScheduleType }))}
                  >
                    <option value="PRAKTIKUM">Praktikum</option>
                    <option value="PEMINJAMAN">Peminjaman</option>
                    <option value="KEGIATAN">Kegiatan</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama Dosen (Opsional)</label>
                    <input
                      type="text"
                      value={form.lecturerName}
                      onChange={(e) => setForm((prev) => ({ ...prev, lecturerName: e.target.value }))}
                      placeholder="Nama dosen pengampu"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Assistant ID (Opsional)</label>
                    <input
                      type="text"
                      value={form.assistantId}
                      onChange={(e) => setForm((prev) => ({ ...prev, assistantId: e.target.value }))}
                      placeholder="user id"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isCreating}
                    className="flex-1 py-3 min-h-[44px] bg-[#4b607f] text-white neo-btn"
                  >
                    {isCreating ? "Menyimpan..." : "Simpan"}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 min-h-[44px] bg-white text-[#1a1a1a] neo-btn"
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
        {showEditModal && editingSchedule && canManageSchedules && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowEditModal(false);
              setEditingSchedule(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a] truncate">Edit Jadwal</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleEditSchedule}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Mata Kuliah / Judul</label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lab</label>
                    <select
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                      required
                      value={editForm.labId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, labId: e.target.value }))}
                    >
                      <option value="">Pilih Lab</option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Hari</label>
                    <select
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                      value={editForm.day}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, day: e.target.value as DayOfWeek }))}
                    >
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {dayLabels[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Mulai</label>
                    <input
                      type="time"
                      required
                      value={editForm.startTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jam Selesai</label>
                    <input
                      type="time"
                      required
                      value={editForm.endTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Semester</label>
                    <input
                      type="text"
                      value={editForm.semester}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, semester: e.target.value }))}
                      placeholder="e.g. 4"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kelas</label>
                    <input
                      type="text"
                      value={editForm.className}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, className: e.target.value }))}
                      placeholder="e.g. TI-4A"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Tipe</label>
                  <select
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    value={editForm.type}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value as ScheduleType }))}
                  >
                    <option value="PRAKTIKUM">Praktikum</option>
                    <option value="PEMINJAMAN">Peminjaman</option>
                    <option value="KEGIATAN">Kegiatan</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama Dosen (Opsional)</label>
                    <input
                      type="text"
                      value={editForm.lecturerName}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, lecturerName: e.target.value }))}
                      placeholder="Nama dosen pengampu"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Assistant ID (Opsional)</label>
                    <input
                      type="text"
                      value={editForm.assistantId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, assistantId: e.target.value }))}
                      placeholder="user id"
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isEditing}
                    className="flex-1 py-3 min-h-[44px] bg-[#f3701e] text-white neo-btn"
                  >
                    {isEditing ? "Menyimpan..." : "Update Jadwal"}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingSchedule(null);
                    }}
                    className="flex-1 py-3 min-h-[44px] bg-white text-[#1a1a1a] neo-btn"
                  >
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        loading={isDeleting}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
