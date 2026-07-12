"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbClock,
  TbClockOff,
  TbPlus,
  TbCalendar,
  TbCheck,
  TbX,
  TbAlertTriangle,
  TbClipboardList,
  TbMapPin,
  TbHourglass,
  TbSend,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { PhotoUpload } from "@/components/ui/photo-upload";
import type {
  AttendanceEntry,
  DailyTaskLog,
  DailyTaskStatus,
  AttendanceStats,
  ShiftSchedule,
  TaskCategoryConfig,
  AttendanceCorrectionRequest,
  Lab,
  AsLabPicketDestination,
} from "@/types";

const attendanceStatusConfig: Record<string, { label: string; color: string }> = {
  CHECKED_IN: { label: "Hadir", color: "bg-green-100 text-green-800" },
  LATE: { label: "Terlambat", color: "bg-yellow-100 text-yellow-800" },
  CHECKED_OUT: { label: "Selesai", color: "bg-blue-100 text-blue-800" },
  WAITING_VERIFICATION: { label: "Menunggu Verifikasi", color: "bg-purple-100 text-purple-800" },
  APPROVED: { label: "Disetujui", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-800" },
  FORGOT_CHECKOUT: { label: "Lupa Checkout", color: "bg-orange-100 text-orange-800" },
  ABSENT: { label: "Tidak Hadir", color: "bg-red-100 text-red-800" },
  SICK: { label: "Sakit", color: "bg-purple-100 text-purple-800" },
  PERMISSION: { label: "Izin", color: "bg-indigo-100 text-indigo-800" },
};

const taskStatusConfig: Record<DailyTaskStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  SUBMITTED: { label: "Diajukan", color: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Disetujui", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-700" },
  NEED_REVISION: { label: "Perlu Revisi", color: "bg-yellow-100 text-yellow-700" },
};

const correctionTypes = [
  { value: "CHECKIN_TIME", label: "Waktu Check-in" },
  { value: "CHECKOUT_TIME", label: "Waktu Check-out" },
  { value: "FORGOT_CHECKOUT", label: "Lupa Checkout" },
  { value: "LOCATION_ERROR", label: "Error Lokasi" },
  { value: "STATUS_CORRECTION", label: "Koreksi Status" },
];

const picketDestinationLabels: Record<AsLabPicketDestination, string> = {
  RUANGAN_ASLAB: "Ruangan Aslab",
  LAB_MULTIMEDIA: "Lab Multimedia",
  LAB_DASAR: "Lab Dasar",
};

function destinationLabel(destination?: AsLabPicketDestination): string {
  return destination ? picketDestinationLabels[destination] : "—";
}

interface LeaveRequestItem {
  id: string;
  type: "SICK" | "PERMISSION" | string;
  date: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  evidenceUrl?: string | null;
  reviewNote?: string | null;
  createdAt: string;
}

type ApiEnvelope<T> = T | { data?: T; items?: T };

function unwrapListPayload<T>(value: unknown): T {
  if (Array.isArray(value)) return value as T;
  if (value && typeof value === "object") {
    const obj = value as { items?: unknown; data?: unknown; rows?: unknown };
    if (Array.isArray(obj.items)) return obj.items as T;
    if (Array.isArray(obj.rows)) return obj.rows as T;
    if (Array.isArray(obj.data)) return obj.data as T;
  }
  return (Array.isArray(value) ? value : []) as T;
}

function extractData<T>(response: unknown): T {
  const env = response as ApiEnvelope<T> | undefined;
  if (env && typeof env === "object") {
    const obj = env as { data?: unknown; items?: unknown };
    if ("data" in obj && obj.data !== undefined) return obj.data as T;
    if ("items" in obj && obj.items !== undefined) return obj.items as T;
  }
  return env as T;
}

function extractListData<T>(response: unknown): T[] {
  return unwrapListPayload<T[]>(extractData(response));
}

function normalizeAttendanceStats(raw: unknown): AttendanceStats {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (value: unknown, fallback = 0) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  const present = num(obj.presentDays, num(obj.present));
  const late = num(obj.lateDays, num(obj.late));
  const absent = num(obj.absentDays, num(obj.absent));
  const totalHours = num(obj.totalHours);
  const totalWorkMinutes = num(obj.totalWorkMinutes, Math.round(totalHours * 60));
  const averageWorkMinutes = num(
    obj.averageWorkMinutes,
    Math.round(num(obj.averageHoursPerDay) * 60)
  );

  return {
    totalDays: num(obj.totalDays, present + late + absent),
    presentDays: present,
    lateDays: late,
    absentDays: absent,
    totalWorkMinutes,
    averageWorkMinutes,
    totalTasks: num(obj.totalTasks),
    approvedTasks: num(obj.approvedTasks),
  };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

async function getRequiredCoordinates(actionLabel: "check-in" | "check-out"): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (!("geolocation" in navigator)) {
    throw new Error(`Perangkat Anda tidak mendukung GPS untuk ${actionLabel}`);
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10000,
      enableHighAccuracy: true,
    })
  ).catch(() => null);

  if (!position) {
    throw new Error(`GPS wajib aktif untuk ${actionLabel}`);
  }

  const { latitude, longitude } = position.coords;
  if (latitude === undefined || longitude === undefined) {
    throw new Error(`Koordinat GPS tidak tersedia untuk ${actionLabel}`);
  }

  return { latitude, longitude };
}

export default function AttendancePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [todayShift, setTodayShift] = useState<ShiftSchedule | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceEntry | null>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [tasks, setTasks] = useState<DailyTaskLog[]>([]);
  const [history, setHistory] = useState<AttendanceEntry[]>([]);
  const [categories, setCategories] = useState<TaskCategoryConfig[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);

  // Modals
  const [showAddTask, setShowAddTask] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [showLeaveRequest, setShowLeaveRequest] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "tasks" | "history" | "corrections" | "leaves">("today");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [leaveForm, setLeaveForm] = useState({ type: "SICK", date: "", reason: "", evidenceUrl: "" });

  // Forms
  const [taskForm, setTaskForm] = useState({
    task: "",
    description: "",
    categoryConfigId: "",
    duration: "",
    labId: "",
    photoUrl: "",
  });
  const [correctionForm, setCorrectionForm] = useState({
    requestType: "CHECKIN_TIME",
    oldValue: "",
    newValue: "",
    reason: "",
    evidenceUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftRes, attendanceRes, statsRes, tasksRes, catsRes, labsRes, correctionsRes, leavesRes] =
        await Promise.allSettled([
          api.get<{ data: ShiftSchedule[] }>("/attendance/shift-schedules/me"),
          api.get<{ data: AttendanceEntry[] }>(`/attendance/me?month=${selectedMonth}`),
          api.get<{ data: AttendanceStats }>(`/attendance/stats?month=${selectedMonth}`),
          api.get<{ data: DailyTaskLog[] }>("/attendance/tasks/me"),
          api.get<{ data: TaskCategoryConfig[] }>("/attendance/task-categories"),
          api.get<{ data: Lab[] }>("/labs"),
          api.get<{ data: AttendanceCorrectionRequest[] }>("/attendance/corrections/me"),
          api.get<{ data: LeaveRequestItem[] }>(`/attendance/leaves/me?month=${selectedMonth}`),
        ]);

      if (shiftRes.status === "fulfilled") {
        const schedules = extractListData<ShiftSchedule>(shiftRes.value);
        const today = new Date().toISOString().split("T")[0];
        const todaySchedule = schedules.find(
          (s) => s.scheduleDate?.split("T")[0] === today && s.status === "SCHEDULED"
        );
        setTodayShift(todaySchedule || null);
      }

      if (attendanceRes.status === "fulfilled") {
        const entries = extractListData<AttendanceEntry>(attendanceRes.value);
        setHistory(entries);
        const today = new Date().toDateString();
        const todayEntry = entries.find(
          (a) => new Date(a.checkinAt || a.createdAt).toDateString() === today
        );
        setTodayAttendance(todayEntry || null);
      }

      if (statsRes.status === "fulfilled") {
        setStats(normalizeAttendanceStats(extractData(statsRes.value)));
      }
      if (tasksRes.status === "fulfilled") {
        setTasks(extractListData<DailyTaskLog>(tasksRes.value));
      }
      if (catsRes.status === "fulfilled") {
        setCategories(extractListData<TaskCategoryConfig>(catsRes.value));
      }
      if (labsRes.status === "fulfilled") {
        setLabs(extractListData<Lab>(labsRes.value));
      }
      if (correctionsRes.status === "fulfilled") {
        setCorrections(extractListData<AttendanceCorrectionRequest>(correctionsRes.value));
      }
      if (leavesRes.status === "fulfilled") {
        setLeaveRequests(extractListData<LeaveRequestItem>(leavesRes.value));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, [fetchData]);

  const handleCheckin = async () => {
    setSubmitting(true);
    try {
      const { latitude, longitude } = await getRequiredCoordinates("check-in");
      await api.post("/attendance/checkin", { latitude, longitude });
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal check-in. Pastikan GPS aktif dan Anda berada di lokasi yang valid."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const { latitude, longitude } = await getRequiredCoordinates("check-out");
      await api.post("/attendance/checkout", { latitude, longitude });
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal check-out. Pastikan GPS aktif dan Anda berada di lokasi yang valid."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTask = async () => {
    if (!taskForm.task.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/attendance/tasks", {
        task: taskForm.task,
        description: taskForm.description || undefined,
        categoryConfigId: taskForm.categoryConfigId || undefined,
        duration: taskForm.duration ? parseInt(taskForm.duration) : undefined,
        labId: taskForm.labId || undefined,
        photoUrl: taskForm.photoUrl || undefined,
      });
      setTaskForm({ task: "", description: "", categoryConfigId: "", duration: "", labId: "", photoUrl: "" });
      setShowAddTask(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal menambah task"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTask = async (taskId: string) => {
    try {
      await api.patch(`/attendance/tasks/${taskId}`, { status: "SUBMITTED" });
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal submit task"));
    }
  };

  const handleSubmitCorrection = async () => {
    if (!correctionForm.reason.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/attendance/corrections", {
        attendanceId: todayAttendance?.id,
        requestType: correctionForm.requestType,
        oldValue: correctionForm.oldValue || undefined,
        newValue: correctionForm.newValue || undefined,
        reason: correctionForm.reason,
        evidenceUrl: correctionForm.evidenceUrl || undefined,
      });
      setCorrectionForm({ requestType: "CHECKIN_TIME", oldValue: "", newValue: "", reason: "", evidenceUrl: "" });
      setShowCorrection(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengajukan koreksi"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitLeave = async () => {
    if (!leaveForm.date || !leaveForm.reason.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/attendance/leaves", {
        type: leaveForm.type,
        date: leaveForm.date,
        reason: leaveForm.reason,
        evidenceUrl: leaveForm.evidenceUrl || undefined,
      });
      setLeaveForm({ type: "SICK", date: "", reason: "", evidenceUrl: "" });
      setShowLeaveRequest(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err, "Gagal mengajukan izin"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 neo-border rounded-full animate-spin border-t-[#f3701e] mx-auto mb-4" />
          <p className="text-[#5a5a5a] font-bold">Memuat data absensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-1">Absensi & Daily Task</h1>
          <p className="text-[#5a5a5a] text-sm">Check-in, task log, shift, & statistik</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="neo-card p-5 text-center">
          <div className="w-12 h-12 rounded-full neo-border bg-[#e8f5e9] flex items-center justify-center mx-auto mb-3">
            <TbCheck className="w-6 h-6 text-green-600" strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-[#4b607f]">{stats?.presentDays || 0}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Hari Hadir</p>
        </div>
        <div className="neo-card p-5 text-center">
          <div className="w-12 h-12 rounded-full neo-border bg-yellow-100 flex items-center justify-center mx-auto mb-3">
            <TbClock className="w-6 h-6 text-yellow-600" strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-[#f3701e]">{stats?.lateDays || 0}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Terlambat</p>
        </div>
        <div className="neo-card p-5 text-center">
          <div className="w-12 h-12 rounded-full neo-border bg-red-100 flex items-center justify-center mx-auto mb-3">
            <TbClockOff className="w-6 h-6 text-red-600" strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-red-500">{stats?.absentDays || 0}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Tidak Hadir</p>
        </div>
        <div className="neo-card p-5 text-center">
          <div className="w-12 h-12 rounded-full neo-border bg-[#e8d8c9] flex items-center justify-center mx-auto mb-3">
            <TbClipboardList className="w-6 h-6 text-[#1a1a1a]" strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-[#1a1a1a]">{stats?.totalTasks ?? tasks.length}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Total Task</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["today", "tasks", "history", "corrections", "leaves"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold rounded-xl neo-border whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a]"
                : "bg-white text-[#1a1a1a] hover:bg-gray-50"
            }`}
          >
            {tab === "today" && "Hari Ini"}
            {tab === "tasks" && "Daily Task"}
            {tab === "history" && "Riwayat"}
            {tab === "corrections" && "Koreksi"}
            {tab === "leaves" && "Izin/Sakit"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "today" && (
        <div className="space-y-4">
          {/* Shift Info */}
          {todayShift && (
            <div className="neo-card p-5">
              <h3 className="font-heading font-bold text-lg text-[#1a1a1a] mb-3 flex items-center gap-2">
                <TbCalendar className="w-5 h-5 text-[#4b607f]" /> Shift Hari Ini
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
                <div>
                  <p className="text-[#5a5a5a] font-medium">Lab</p>
                  <p className="font-bold text-[#1a1a1a]">{todayShift.lab?.name ?? destinationLabel(todayShift.destination)}</p>
                </div>
                <div>
                  <p className="text-[#5a5a5a] font-medium">Waktu</p>
                  <p className="font-bold text-[#1a1a1a]">
                    {todayShift.shift?.startTime || "—"} - {todayShift.shift?.endTime || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[#5a5a5a] font-medium">Status</p>
                  <span className="text-xs font-bold px-2 py-1 rounded-md neo-border-sm bg-blue-100 text-blue-800">
                    {todayShift.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Check-in/Check-out */}
          <div className="neo-card p-4 sm:p-6">
            <h3 className="font-heading font-bold text-xl text-[#1a1a1a] mb-4 flex items-center gap-2">
              <TbMapPin className="w-6 h-6 text-[#4b607f]" /> Absensi
            </h3>

            {!todayAttendance ? (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleCheckin}
                disabled={submitting}
                className="w-full py-4 bg-[#4b607f] text-white neo-btn text-lg font-heading tracking-wide flex items-center justify-center gap-2 hover:bg-[#3a4b63] transition-colors disabled:opacity-50"
              >
                <TbClock className="w-6 h-6" strokeWidth={2.2} />
                {submitting ? "Memproses..." : "Check-in Sekarang"}
              </motion.button>
            ) : !todayAttendance.checkoutAt ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#e8f5e9] neo-border">
                  <div>
                    <p className="text-base font-bold text-green-800">Sudah Check-in</p>
                    <p className="text-sm font-medium text-green-600 mt-1">
                      {formatTime(todayAttendance.checkinAt)} WIB
                    </p>
                    {todayAttendance.checkinLocation && (
                      <p className="text-xs text-green-600 mt-0.5">
                        📍 {todayAttendance.checkinLocation.name}
                      </p>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCheckout}
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#f3701e] text-white neo-btn text-sm font-bold flex items-center gap-2 hover:bg-[#e05b0c] transition-colors disabled:opacity-50"
                  >
                    <TbClockOff className="w-5 h-5" strokeWidth={2.2} />
                    {submitting ? "..." : "Check-out"}
                  </motion.button>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#5a5a5a]">
                  <TbHourglass className="w-4 h-4" />
                  <span>Status: </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${attendanceStatusConfig[todayAttendance.status]?.color || "bg-gray-100 text-gray-700"}`}>
                    {attendanceStatusConfig[todayAttendance.status]?.label || todayAttendance.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-blue-50 neo-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold text-blue-800">Sudah Selesai</p>
                    <p className="text-sm text-blue-600 mt-1">
                      {formatTime(todayAttendance.checkinAt)} — {formatTime(todayAttendance.checkoutAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#5a5a5a]">Durasi Kerja</p>
                    <p className="text-lg font-bold text-[#4b607f]">
                      {formatDuration(todayAttendance.workDurationMinutes)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${attendanceStatusConfig[todayAttendance.status]?.color || "bg-gray-100 text-gray-700"}`}>
                    {attendanceStatusConfig[todayAttendance.status]?.label || todayAttendance.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Daily Task Log</h3>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddTask(true)}
              className="px-4 py-2.5 bg-[#f3701e] text-white neo-btn text-sm font-bold flex items-center gap-2 hover:bg-[#e05b0c] transition-colors"
            >
              <TbPlus className="w-5 h-5" strokeWidth={2.2} /> Tambah Task
            </motion.button>
          </div>

          {tasks.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <TbClipboardList className="w-12 h-12 text-[#4b607f]/30 mx-auto mb-3" />
              <p className="font-bold text-[#1a1a1a]">Belum ada task hari ini</p>
              <p className="text-sm text-[#5a5a5a] mt-1">Tambahkan task harian Anda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="neo-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-[#1a1a1a]">{task.task}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${taskStatusConfig[task.status]?.color || "bg-gray-100 text-gray-700"}`}>
                          {taskStatusConfig[task.status]?.label || task.status}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-sm text-[#5a5a5a] mb-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs">
                        {task.categoryConfig && (
                          <span className="px-2 py-0.5 rounded bg-[#f5ede6] text-[#4b607f] font-medium">
                            {task.categoryConfig.name}
                          </span>
                        )}
                        {task.category && !task.categoryConfig && (
                          <span className="px-2 py-0.5 rounded bg-[#f5ede6] text-[#4b607f] font-medium">
                            {task.category}
                          </span>
                        )}
                        {task.duration && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-[#5a5a5a] font-medium">
                            {task.duration} menit
                          </span>
                        )}
                        {task.lab && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-[#5a5a5a] font-medium">
                            {task.lab.name}
                          </span>
                        )}
                      </div>
                      {task.reviewNote && (
                        <p className="text-xs mt-2 p-2 rounded bg-yellow-50 neo-border-sm text-yellow-800">
                          Catatan: {task.reviewNote}
                        </p>
                      )}
                    </div>
                    {task.status === "DRAFT" && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSubmitTask(task.id)}
                        className="px-3 py-1.5 bg-[#4b607f] text-white neo-btn text-xs font-bold flex items-center gap-1"
                      >
                        <TbSend className="w-3.5 h-3.5" /> Submit
                      </motion.button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Riwayat Absensi</h3>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 neo-input text-sm bg-white"
            />
          </div>

          {history.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <TbCalendar className="w-12 h-12 text-[#4b607f]/30 mx-auto mb-3" />
              <p className="font-bold text-[#1a1a1a]">Belum ada riwayat</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="neo-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <p className="text-xs text-[#5a5a5a]">
                          {new Date(entry.checkinAt || entry.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1a1a1a]">
                          {formatTime(entry.checkinAt)} — {formatTime(entry.checkoutAt)}
                        </p>
                        {entry.workDurationMinutes && (
                          <p className="text-xs text-[#5a5a5a]">
                            Durasi: {formatDuration(entry.workDurationMinutes)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${attendanceStatusConfig[entry.status]?.color || "bg-gray-100 text-gray-700"}`}>
                      {attendanceStatusConfig[entry.status]?.label || entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "corrections" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Koreksi Absensi</h3>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCorrection(true)}
              className="px-4 py-2.5 bg-[#f3701e] text-white neo-btn text-sm font-bold flex items-center gap-2 hover:bg-[#e05b0c] transition-colors"
            >
              <TbPlus className="w-5 h-5" /> Ajukan Koreksi
            </motion.button>
          </div>

          {corrections.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <TbAlertTriangle className="w-12 h-12 text-[#4b607f]/30 mx-auto mb-3" />
              <p className="font-bold text-[#1a1a1a]">Belum ada pengajuan koreksi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {corrections.map((req) => (
                <div key={req.id} className="neo-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-md neo-border-sm bg-[#f5ede6] text-[#4b607f]">
                      {correctionTypes.find((t) => t.value === req.requestType)?.label || req.requestType}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      req.status === "APPROVED" ? "bg-green-100 text-green-800" :
                      req.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                      {req.status === "PENDING" ? "Menunggu" : req.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                    </span>
                  </div>
                  <p className="text-sm text-[#1a1a1a] font-medium">{req.reason}</p>
                  {req.oldValue && (
                    <p className="text-xs text-[#5a5a5a] mt-1">
                      {req.oldValue} → {req.newValue}
                    </p>
                  )}
                  {req.reviewNote && (
                    <p className="text-xs mt-2 p-2 rounded bg-gray-50 neo-border-sm text-[#5a5a5a]">
                      Catatan reviewer: {req.reviewNote}
                    </p>
                  )}
                  <p className="text-xs text-[#5a5a5a] mt-2">{formatDate(req.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "leaves" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Pengajuan Izin / Sakit</h3>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLeaveRequest(true)}
              className="px-4 py-2.5 bg-[#f3701e] text-white neo-btn text-sm font-bold flex items-center gap-2 hover:bg-[#e05b0c] transition-colors"
            >
              <TbPlus className="w-5 h-5" /> Ajukan Izin
            </motion.button>
          </div>

          {leaveRequests.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <TbCalendar className="w-12 h-12 text-[#4b607f]/30 mx-auto mb-3" />
              <p className="font-bold text-[#1a1a1a]">Belum ada pengajuan izin/sakit</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((req) => (
                <div key={req.id} className="neo-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md neo-border-sm ${
                      req.type === "SICK" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {req.type === "SICK" ? "Sakit" : "Izin"}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      req.status === "APPROVED" ? "bg-green-100 text-green-800" :
                      req.status === "REJECTED" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                      {req.status === "PENDING" ? "Menunggu" : req.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#1a1a1a]">
                    {new Date(req.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p className="text-sm text-[#5a5a5a] mt-1">{req.reason}</p>
                  {req.evidenceUrl && (
                    <a href={req.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4b607f] underline mt-1 inline-block">
                      Lihat Bukti
                    </a>
                  )}
                  {req.reviewNote && (
                    <p className="text-xs mt-2 p-2 rounded bg-gray-50 neo-border-sm text-[#5a5a5a]">
                      Catatan: {req.reviewNote}
                    </p>
                  )}
                  <p className="text-xs text-[#5a5a5a] mt-2">Diajukan: {formatDate(req.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leave Request Modal */}
      <AnimatePresence>
        {showLeaveRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaveRequest(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f5ede6] neo-card p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Ajukan Izin / Sakit</h3>
                <button
                  type="button"
                  onClick={() => setShowLeaveRequest(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Tipe *</label>
                  <select
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                  >
                    <option value="SICK">Sakit</option>
                    <option value="PERMISSION">Izin</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Tanggal *</label>
                  <input
                    type="date"
                    value={leaveForm.date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Alasan *</label>
                  <textarea
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Jelaskan alasan izin/sakit..."
                    className="w-full px-4 py-3 min-h-[80px] neo-input text-base bg-white resize-none"
                  />
                </div>
                <div>
                  <PhotoUpload
                    value={leaveForm.evidenceUrl ? [leaveForm.evidenceUrl] : []}
                    onChange={(urls) => setLeaveForm((prev) => ({ ...prev, evidenceUrl: urls[0] || "" }))}
                    category="evidence"
                    label="Bukti (opsional)"
                    maxFiles={1}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmitLeave}
                    disabled={!leaveForm.date || !leaveForm.reason.trim() || submitting}
                    className="flex-1 py-3 bg-[#f3701e] text-white neo-btn text-base font-bold disabled:opacity-50"
                  >
                    {submitting ? "Mengirim..." : "Kirim Pengajuan"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowLeaveRequest(false)}
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn text-base font-bold"
                  >
                    Batal
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddTask(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f5ede6] neo-card p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Tambah Daily Task</h3>
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Nama Task *</label>
                  <input
                    type="text"
                    value={taskForm.task}
                    onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })}
                    placeholder="Apa yang dikerjakan..."
                    className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Deskripsi</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Detail pekerjaan..."
                    className="w-full px-4 py-3 min-h-[80px] neo-input text-base bg-white resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Kategori</label>
                    <select
                      value={taskForm.categoryConfigId}
                      onChange={(e) => setTaskForm({ ...taskForm, categoryConfigId: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                    >
                      <option value="">— Pilih —</option>
                      {categories.filter((c) => c.isActive).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Durasi (menit)</label>
                    <input
                      type="number"
                      value={taskForm.duration}
                      onChange={(e) => setTaskForm({ ...taskForm, duration: e.target.value })}
                      placeholder="30"
                      className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Lab Terkait</label>
                  <select
                    value={taskForm.labId}
                    onChange={(e) => setTaskForm({ ...taskForm, labId: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                  >
                    <option value="">— Pilih Lab (opsional) —</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <PhotoUpload
                    value={taskForm.photoUrl ? [taskForm.photoUrl] : []}
                    onChange={(urls) => setTaskForm((prev) => ({ ...prev, photoUrl: urls[0] || "" }))}
                    category="tasks"
                    label="Foto Bukti"
                    maxFiles={1}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddTask}
                    disabled={!taskForm.task.trim() || submitting}
                    className="flex-1 py-3 bg-[#f3701e] text-white neo-btn text-base font-bold disabled:opacity-50"
                  >
                    {submitting ? "Menyimpan..." : "Simpan Task"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddTask(false)}
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn text-base font-bold"
                  >
                    Batal
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Correction Modal */}
      <AnimatePresence>
        {showCorrection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCorrection(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f5ede6] neo-card p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Ajukan Koreksi Absensi</h3>
                <button
                  type="button"
                  onClick={() => setShowCorrection(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Jenis Koreksi *</label>
                  <select
                    value={correctionForm.requestType}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requestType: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                  >
                    {correctionTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Nilai Lama</label>
                    <input
                      type="text"
                      value={correctionForm.oldValue}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, oldValue: e.target.value })}
                      placeholder="08:30"
                      className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Nilai Baru</label>
                    <input
                      type="text"
                      value={correctionForm.newValue}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, newValue: e.target.value })}
                      placeholder="08:00"
                      className="w-full px-4 py-3 min-h-[44px] neo-input text-base bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Alasan *</label>
                  <textarea
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    placeholder="Jelaskan alasan koreksi..."
                    className="w-full px-4 py-3 min-h-[80px] neo-input text-base bg-white resize-none"
                  />
                </div>
                <div>
                  <PhotoUpload
                    value={correctionForm.evidenceUrl ? [correctionForm.evidenceUrl] : []}
                    onChange={(urls) => setCorrectionForm((prev) => ({ ...prev, evidenceUrl: urls[0] || "" }))}
                    category="evidence"
                    label="URL Bukti"
                    maxFiles={1}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmitCorrection}
                    disabled={!correctionForm.reason.trim() || submitting}
                    className="flex-1 py-3 bg-[#f3701e] text-white neo-btn text-base font-bold disabled:opacity-50"
                  >
                    {submitting ? "Mengirim..." : "Kirim Koreksi"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCorrection(false)}
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn text-base font-bold"
                  >
                    Batal
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
