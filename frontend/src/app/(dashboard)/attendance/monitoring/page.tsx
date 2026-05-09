"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TbCalendarStats,
  TbChecklist,
  TbClockCog,
  TbUsers,
  TbUserCheck,
  TbUserX,
  TbAlertTriangle,
  TbClock,
  TbCircleCheck,
  TbCircleX,
  TbClipboardCheck,
  TbRefresh,
  TbLoader2,
  TbEdit,
  TbCheck,
  TbX,
  TbArrowBackUp,
  TbPlus,
  TbTrash,
  TbBuildingWarehouse,
  TbCalendar,
  TbNotes,
  TbFilter,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { MobileCard } from "@/components/ui/mobile-card";
import type {
  AttendanceEntry,
  DailyTaskLog,
  ShiftSchedule,
  Shift,
  User,
  Lab,
  AttendanceStatus,
  DailyTaskStatus,
  ShiftScheduleStatus,
} from "@/types/index";

type MonitoringTab = "TODAY" | "TASKS" | "SHIFTS" | "LEAVES";
type VerifyAction = "APPROVED" | "REJECTED";
type ReviewAction = "APPROVED" | "REJECTED" | "NEED_REVISION";

type TodaySummary = {
  totalAslab: number;
  checkedIn: number;
  notCheckedIn: number;
  late: number;
  onLeave: number;
};

type TodayMonitoringData = {
  summary: TodaySummary;
  attendances: AttendanceEntry[];
  notCheckedInUsers: User[];
};

type ShiftCreatePayload = {
  userId: string;
  labId: string;
  shiftId: string;
  scheduleDate: string;
  notes?: string;
};

type ShiftCreateBulkPayload = {
  schedules: ShiftCreatePayload[];
};

type ApiMaybeWrapped<T> = T | { data?: T; items?: T };

const TABS: Array<{ key: MonitoringTab; label: string; icon: typeof TbCalendarStats }> = [
  { key: "TODAY", label: "Today Monitoring", icon: TbCalendarStats },
  { key: "TASKS", label: "Task Verification", icon: TbChecklist },
  { key: "SHIFTS", label: "Shift Assignment", icon: TbClockCog },
  { key: "LEAVES", label: "Izin / Sakit", icon: TbNotes },
];

const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; className: string; icon: typeof TbCircleCheck }
> = {
  CHECKED_IN: { label: "Checked In", className: "bg-blue-100 text-blue-700", icon: TbCircleCheck },
  LATE: { label: "Terlambat", className: "bg-orange-100 text-orange-700", icon: TbAlertTriangle },
  CHECKED_OUT: { label: "Checked Out", className: "bg-green-100 text-green-700", icon: TbCircleCheck },
  WAITING_VERIFICATION: {
    label: "Menunggu Verifikasi",
    className: "bg-yellow-100 text-yellow-700",
    icon: TbClock,
  },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700", icon: TbCircleCheck },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700", icon: TbCircleX },
  FORGOT_CHECKOUT: {
    label: "Lupa Checkout",
    className: "bg-purple-100 text-purple-700",
    icon: TbAlertTriangle,
  },
  ABSENT: { label: "Absen", className: "bg-red-100 text-red-700", icon: TbUserX },
  SICK: { label: "Sakit", className: "bg-purple-100 text-purple-700", icon: TbAlertTriangle },
  PERMISSION: { label: "Izin", className: "bg-indigo-100 text-indigo-700", icon: TbCalendar },
};

const TASK_STATUS_CONFIG: Record<
  DailyTaskStatus,
  { label: string; className: string; icon: typeof TbCircleCheck }
> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700", icon: TbEdit },
  SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-700", icon: TbClock },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700", icon: TbCheck },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700", icon: TbX },
  NEED_REVISION: {
    label: "Need Revision",
    className: "bg-orange-100 text-orange-700",
    icon: TbArrowBackUp,
  },
};

const SHIFT_STATUS_CONFIG: Record<
  ShiftScheduleStatus,
  { label: string; className: string; icon: typeof TbCircleCheck }
> = {
  SCHEDULED: { label: "Scheduled", className: "bg-blue-100 text-blue-700", icon: TbClock },
  COMPLETED: { label: "Completed", className: "bg-green-100 text-green-700", icon: TbCircleCheck },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700", icon: TbCircleX },
};

const cardPalette = {
  dark: "#1a1a1a",
  gray: "#5a5a5a",
  blueGray: "#4b607f",
  orange: "#f3701e",
  cream: "#f5ede6",
  warm: "#e8d8c9",
};

const defaultTodaySummary: TodaySummary = {
  totalAslab: 0,
  checkedIn: 0,
  notCheckedIn: 0,
  late: 0,
  onLeave: 0,
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapData<T>(value: ApiMaybeWrapped<T>, fallback: T): T {
  if (isObjectRecord(value)) {
    if ("data" in value && value.data !== undefined) return value.data as T;
    if ("items" in value && value.items !== undefined) return value.items as T;
  }
  return (value as T) ?? fallback;
}

function safeArray<T>(value: unknown, keyCandidates: string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isObjectRecord(value)) return [];

  for (const key of keyCandidates) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate as T[];
  }

  if (Array.isArray(value.data)) return value.data as T[];
  if (Array.isArray(value.items)) return value.items as T[];
  return [];
}

function formatDateTime(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

function monthNow(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export default function AttendanceMonitoringPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<MonitoringTab>("TODAY");

  const [todayLoading, setTodayLoading] = useState(false);
  const [todaySummary, setTodaySummary] = useState<TodaySummary>(defaultTodaySummary);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceEntry[]>([]);
  const [notCheckedInUsers, setNotCheckedInUsers] = useState<User[]>([]);

  const [tasksLoading, setTasksLoading] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<DailyTaskLog[]>([]);
  const [submittedTasks, setSubmittedTasks] = useState<DailyTaskLog[]>([]);
  const [taskFilter, setTaskFilter] = useState<"PENDING" | "SUBMITTED">("PENDING");

  const [shiftLoading, setShiftLoading] = useState(false);
  const [scheduleMonth, setScheduleMonth] = useState(monthNow());
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([]);
  const [aslabUsers, setAslabUsers] = useState<User[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [leavesLoading, setLeavesLoading] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [leaveReviewOpen, setLeaveReviewOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [leaveReviewAction, setLeaveReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [leaveReviewNote, setLeaveReviewNote] = useState("");
  const [leaveReviewSubmitting, setLeaveReviewSubmitting] = useState(false);

  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceEntry | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyAction, setVerifyAction] = useState<VerifyAction>("APPROVED");
  const [verifyNote, setVerifyNote] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const [selectedTask, setSelectedTask] = useState<DailyTaskLog | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<ReviewAction>("APPROVED");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    userId: "",
    labId: "",
    shiftId: "",
    scheduleDate: "",
    bulkDatesText: "",
    notes: "",
  });

  const visibleTasks = useMemo(
    () => (taskFilter === "PENDING" ? pendingTasks : submittedTasks),
    [taskFilter, pendingTasks, submittedTasks]
  );

  const loadTodayMonitoring = useCallback(async () => {
    setTodayLoading(true);
    try {
      const response = await api.get<ApiMaybeWrapped<TodayMonitoringData>>("/attendance/monitoring/today");
      const data = unwrapData<TodayMonitoringData>(response, {
        summary: defaultTodaySummary,
        attendances: [],
        notCheckedInUsers: [],
      });

      setTodaySummary({
        totalAslab: data.summary?.totalAslab ?? 0,
        checkedIn: data.summary?.checkedIn ?? 0,
        notCheckedIn: data.summary?.notCheckedIn ?? 0,
        late: data.summary?.late ?? 0,
        onLeave: data.summary?.onLeave ?? 0,
      });
      setTodayAttendances(safeArray<AttendanceEntry>(data.attendances));
      setNotCheckedInUsers(safeArray<User>(data.notCheckedInUsers));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat monitoring hari ini.");
      setTodaySummary(defaultTodaySummary);
      setTodayAttendances([]);
      setNotCheckedInUsers([]);
    } finally {
      setTodayLoading(false);
    }
  }, [toast]);

  const loadTaskVerifications = useCallback(async () => {
    setTasksLoading(true);
    try {
      const [pendingRes, submittedRes] = await Promise.all([
        api.get<ApiMaybeWrapped<DailyTaskLog[]> | Record<string, unknown>>("/attendance/tasks/pending"),
        api.get<ApiMaybeWrapped<DailyTaskLog[]> | Record<string, unknown>>(
          "/attendance/tasks/all?status=SUBMITTED"
        ),
      ]);

      setPendingTasks(safeArray<DailyTaskLog>(pendingRes, ["tasks", "pendingTasks", "rows"]));
      setSubmittedTasks(safeArray<DailyTaskLog>(submittedRes, ["tasks", "submittedTasks", "rows"]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat verifikasi tugas.");
      setPendingTasks([]);
      setSubmittedTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [toast]);

  const loadShiftReferences = useCallback(async () => {
    try {
      const [usersRes, labsRes, shiftsRes] = await Promise.all([
        api.get<ApiMaybeWrapped<User[]> | Record<string, unknown>>("/users?role=ASISTEN_LAB"),
        api.get<ApiMaybeWrapped<Lab[]> | Record<string, unknown>>("/labs"),
        api.get<ApiMaybeWrapped<Shift[]> | Record<string, unknown>>("/attendance/shifts"),
      ]);
      setAslabUsers(safeArray<User>(usersRes, ["users", "rows"]));
      setLabs(safeArray<Lab>(labsRes, ["labs", "rows"]));
      setShifts(safeArray<Shift>(shiftsRes, ["shifts", "rows"]));
    } catch {
      setAslabUsers([]);
      setLabs([]);
      setShifts([]);
    }
  }, []);

  const loadShiftSchedules = useCallback(async () => {
    setShiftLoading(true);
    try {
      const response = await api.get<ApiMaybeWrapped<ShiftSchedule[]> | Record<string, unknown>>(
        `/attendance/shift-schedules?month=${scheduleMonth}`
      );
      setShiftSchedules(safeArray<ShiftSchedule>(response, ["schedules", "rows"]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat jadwal shift.");
      setShiftSchedules([]);
    } finally {
      setShiftLoading(false);
    }
  }, [scheduleMonth, toast]);

  useEffect(() => {
    void loadTodayMonitoring();
    void loadTaskVerifications();
    void loadShiftReferences();
  }, [loadTodayMonitoring, loadTaskVerifications, loadShiftReferences]);

  useEffect(() => {
    void loadShiftSchedules();
  }, [loadShiftSchedules]);

  const loadPendingLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res = await api.get<any>("/attendance/leaves/pending");
      const data = safeArray<any>(res, ["data"]);
      setPendingLeaves(data);
    } catch {
      setPendingLeaves([]);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "LEAVES") void loadPendingLeaves();
  }, [activeTab, loadPendingLeaves]);

  const openLeaveReview = (leave: any) => {
    setSelectedLeave(leave);
    setLeaveReviewAction("APPROVED");
    setLeaveReviewNote("");
    setLeaveReviewOpen(true);
  };

  const submitLeaveReview = async () => {
    if (!selectedLeave) return;
    setLeaveReviewSubmitting(true);
    try {
      await api.patch(`/attendance/leaves/${selectedLeave.id}/review`, {
        action: leaveReviewAction,
        reviewNote: leaveReviewNote || undefined,
      });
      toast.success(`Pengajuan ${leaveReviewAction === "APPROVED" ? "disetujui" : "ditolak"}`);
      setLeaveReviewOpen(false);
      void loadPendingLeaves();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal review pengajuan");
    } finally {
      setLeaveReviewSubmitting(false);
    }
  };

  const openVerifyModal = (attendance: AttendanceEntry) => {
    setSelectedAttendance(attendance);
    setVerifyAction("APPROVED");
    setVerifyNote("");
    setVerifyOpen(true);
  };

  const submitVerifyAttendance = async () => {
    if (!selectedAttendance) return;
    setVerifySubmitting(true);
    try {
      await api.patch(`/attendance/${selectedAttendance.id}/verify`, {
        action: verifyAction,
        notes: verifyNote,
      });
      toast.success("Verifikasi kehadiran berhasil disimpan.");
      setVerifyOpen(false);
      setSelectedAttendance(null);
      await loadTodayMonitoring();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verifikasi kehadiran gagal.");
    } finally {
      setVerifySubmitting(false);
    }
  };

  const openReviewModal = (task: DailyTaskLog) => {
    setSelectedTask(task);
    setReviewAction("APPROVED");
    setReviewNote("");
    setReviewOpen(true);
  };

  const submitTaskReview = async () => {
    if (!selectedTask) return;
    setReviewSubmitting(true);
    try {
      await api.patch(`/attendance/tasks/${selectedTask.id}/review`, {
        action: reviewAction,
        reviewNote,
      });
      toast.success("Review tugas berhasil diperbarui.");
      setReviewOpen(false);
      setSelectedTask(null);
      await loadTaskVerifications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review tugas gagal.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openShiftModal = () => {
    setShiftForm({
      userId: "",
      labId: "",
      shiftId: "",
      scheduleDate: "",
      bulkDatesText: "",
      notes: "",
    });
    setShiftModalOpen(true);
  };

  const submitShiftSchedule = async () => {
    const { userId, labId, shiftId, scheduleDate, bulkDatesText, notes } = shiftForm;
    if (!userId || !labId || !shiftId) {
      toast.error("Pilih Aslab, Lab, dan Shift terlebih dahulu.");
      return;
    }

    const parsedBulkDates = bulkDatesText
      .split(/[,\n]/g)
      .map((item) => item.trim())
      .filter(Boolean);

    const allDates = scheduleDate ? [scheduleDate, ...parsedBulkDates] : parsedBulkDates;
    const uniqueDates = Array.from(new Set(allDates));

    if (uniqueDates.length === 0) {
      toast.error("Isi minimal satu tanggal jadwal.");
      return;
    }

    const payloads: ShiftCreatePayload[] = uniqueDates.map((date) => ({
      userId,
      labId,
      shiftId,
      scheduleDate: date,
      notes: notes.trim() ? notes.trim() : undefined,
    }));

    setShiftSubmitting(true);
    try {
      if (payloads.length === 1) {
        await api.post("/attendance/shift-schedules", payloads[0]);
      } else {
        const bulkBody: ShiftCreateBulkPayload = { schedules: payloads };
        await api.post("/attendance/shift-schedules", bulkBody);
      }
      toast.success("Jadwal shift berhasil ditambahkan.");
      setShiftModalOpen(false);
      await loadShiftSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambahkan jadwal shift.");
    } finally {
      setShiftSubmitting(false);
    }
  };

  const deleteShiftSchedule = async (scheduleId: string) => {
    try {
      await api.delete(`/attendance/shift-schedules/${scheduleId}`);
      toast.success("Jadwal shift berhasil dihapus.");
      await loadShiftSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus jadwal shift.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5ede6] to-[#e8d8c9] p-4 md:p-6 space-y-6">
      <header className="neo-card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#1a1a1a] tracking-wide">
              Attendance Monitoring Koordinator
            </h1>
            <p className="mt-2 text-sm md:text-base text-[#5a5a5a] font-medium">
              Pantau kehadiran hari ini, verifikasi task Aslab, dan atur assignment shift dalam satu dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => void loadTodayMonitoring()} className="neo-btn px-4 py-2 bg-white text-[#1a1a1a]">
              <span className="flex items-center gap-2 font-bold text-sm">
                <TbRefresh className="w-4 h-4" /> Refresh Today
              </span>
            </button>
            <button
              onClick={() => void loadTaskVerifications()}
              className="neo-btn px-4 py-2 bg-[#4b607f] text-white"
            >
              <span className="flex items-center gap-2 font-bold text-sm">
                <TbClipboardCheck className="w-4 h-4" /> Refresh Tasks
              </span>
            </button>
            <button onClick={() => void loadShiftSchedules()} className="neo-btn px-4 py-2 bg-[#f3701e] text-white">
              <span className="flex items-center gap-2 font-bold text-sm">
                <TbClockCog className="w-4 h-4" /> Refresh Shifts
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="neo-card p-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`neo-btn px-4 py-3 text-left transition-all ${
                  isActive ? "bg-[#1a1a1a] text-[#f5ede6]" : "bg-white text-[#1a1a1a]"
                }`}
              >
                <span className="flex items-center gap-2 font-bold text-sm md:text-base">
                  <TabIcon className="w-5 h-5" /> {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {activeTab === "TODAY" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="neo-card p-4" style={{ backgroundColor: cardPalette.cream }}>
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Total Aslab</p>
                  <div className="mt-2 flex items-center gap-3">
                    <TbUsers className="w-7 h-7 text-[#4b607f]" />
                    <p className="font-heading text-2xl font-black text-[#1a1a1a]">{todaySummary.totalAslab}</p>
                  </div>
                </div>
                <div className="neo-card p-4 bg-green-50">
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Sudah Hadir</p>
                  <div className="mt-2 flex items-center gap-3">
                    <TbUserCheck className="w-7 h-7 text-green-700" />
                    <p className="font-heading text-2xl font-black text-[#1a1a1a]">{todaySummary.checkedIn}</p>
                  </div>
                </div>
                <div className="neo-card p-4 bg-red-50">
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Belum Hadir</p>
                  <div className="mt-2 flex items-center gap-3">
                    <TbUserX className="w-7 h-7 text-red-700" />
                    <p className="font-heading text-2xl font-black text-[#1a1a1a]">{todaySummary.notCheckedIn}</p>
                  </div>
                </div>
                <div className="neo-card p-4 bg-orange-50">
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Terlambat</p>
                  <div className="mt-2 flex items-center gap-3">
                    <TbAlertTriangle className="w-7 h-7 text-orange-700" />
                    <p className="font-heading text-2xl font-black text-[#1a1a1a]">{todaySummary.late}</p>
                  </div>
                  <p className="mt-2 text-xs text-[#5a5a5a]">Izin/Sakit: {todaySummary.onLeave}</p>
                </div>
              </div>

              <div className="neo-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-lg md:text-xl font-black text-[#1a1a1a]">Kehadiran Hari Ini</h2>
                  {todayLoading && (
                    <span className="inline-flex items-center gap-2 text-sm text-[#5a5a5a]">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Loading...
                    </span>
                  )}
                </div>

                {todayLoading ? (
                  <div className="py-12 text-center text-[#5a5a5a] font-semibold">Memuat data kehadiran...</div>
                ) : todayAttendances.length === 0 ? (
                  <div className="py-12 text-center text-[#5a5a5a] font-semibold">Belum ada data kehadiran hari ini.</div>
                ) : (
                  <>
                    <div className="lg:hidden space-y-3">
                      {todayAttendances.map((attendance) => {
                        const statusCfg = ATTENDANCE_STATUS_CONFIG[attendance.status];
                        const StatusIcon = statusCfg?.icon ?? TbClock;
                        return (
                          <MobileCard
                            key={attendance.id}
                            title={attendance.user?.name ?? "-"}
                            badge={
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusCfg?.className ?? "bg-gray-100 text-gray-700"}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusCfg?.label ?? attendance.status}
                              </span>
                            }
                            fields={[
                              { label: "Check-in", value: formatDateTime(attendance.checkinAt) },
                              { label: "Durasi Kerja", value: formatDuration(attendance.workDurationMinutes) },
                            ]}
                            actions={[
                              {
                                label: "Verify",
                                icon: <TbCheck className="w-4 h-4" />,
                                onClick: () => openVerifyModal(attendance),
                                variant: "primary",
                              },
                            ]}
                          />
                        );
                      })}
                    </div>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full min-w-[880px] border-collapse">
                        <thead>
                          <tr className="bg-[#e8d8c9] text-[#1a1a1a]">
                            <th className="text-left p-3 text-sm font-black">Nama</th>
                            <th className="text-left p-3 text-sm font-black">Check-in Time</th>
                            <th className="text-left p-3 text-sm font-black">Status</th>
                            <th className="text-left p-3 text-sm font-black">Work Duration</th>
                            <th className="text-left p-3 text-sm font-black">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {todayAttendances.map((attendance) => {
                            const statusCfg = ATTENDANCE_STATUS_CONFIG[attendance.status];
                            const StatusIcon = statusCfg?.icon ?? TbClock;
                            return (
                              <tr key={attendance.id} className="border-b border-[#e8d8c9] hover:bg-[#f5ede6]">
                                <td className="p-3 font-semibold text-[#1a1a1a]">{attendance.user?.name ?? "-"}</td>
                                <td className="p-3 text-[#5a5a5a] text-sm">{formatDateTime(attendance.checkinAt)}</td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusCfg?.className ?? "bg-gray-100 text-gray-700"}`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusCfg?.label ?? attendance.status}
                                  </span>
                                </td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{formatDuration(attendance.workDurationMinutes)}</td>
                                <td className="p-3">
                                  <button onClick={() => openVerifyModal(attendance)} className="neo-btn px-3 py-1.5 bg-[#4b607f] text-white text-xs font-bold">
                                    Verify
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="neo-card p-5">
                <h3 className="font-heading text-lg font-black text-[#1a1a1a] mb-4">Belum Check-in</h3>
                {todayLoading ? (
                  <p className="text-sm text-[#5a5a5a]">Memuat daftar...</p>
                ) : notCheckedInUsers.length === 0 ? (
                  <p className="text-sm text-[#5a5a5a]">Semua Aslab sudah check-in.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {notCheckedInUsers.map((user) => (
                      <div key={user.id} className="neo-card p-3 bg-white flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#1a1a1a] text-sm">{user.name}</p>
                          <p className="text-xs text-[#5a5a5a]">{user.email}</p>
                        </div>
                        <TbUserX className="w-5 h-5 text-red-600" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "TASKS" && (
            <div className="space-y-4">
              <div className="neo-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[#1a1a1a] font-bold">
                  <TbFilter className="w-5 h-5 text-[#4b607f]" /> Filter Sumber Tugas
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTaskFilter("PENDING")}
                    className={`neo-btn px-4 py-2 text-sm font-bold ${
                      taskFilter === "PENDING" ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a]"
                    }`}
                  >
                    Pending Endpoint
                  </button>
                  <button
                    onClick={() => setTaskFilter("SUBMITTED")}
                    className={`neo-btn px-4 py-2 text-sm font-bold ${
                      taskFilter === "SUBMITTED" ? "bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"
                    }`}
                  >
                    Status=SUBMITTED Endpoint
                  </button>
                </div>
              </div>

              <div className="neo-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-lg md:text-xl font-black text-[#1a1a1a]">Daftar Verifikasi Tugas</h2>
                  {tasksLoading ? (
                    <span className="inline-flex items-center gap-2 text-sm text-[#5a5a5a]">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Loading...
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-[#5a5a5a]">{visibleTasks.length} tugas</span>
                  )}
                </div>

                {tasksLoading ? (
                  <div className="py-12 text-center text-[#5a5a5a] font-semibold">Memuat data task...</div>
                ) : visibleTasks.length === 0 ? (
                  <div className="py-12 text-center text-[#5a5a5a] font-semibold">Tidak ada task yang perlu direview.</div>
                ) : (
                  <>
                    <div className="lg:hidden space-y-3">
                      {visibleTasks.map((task) => {
                        const statusCfg = TASK_STATUS_CONFIG[task.status];
                        const StatusIcon = statusCfg?.icon ?? TbClock;
                        return (
                          <MobileCard
                            key={task.id}
                            title={task.user?.name ?? "-"}
                            subtitle={task.task}
                            badge={
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusCfg?.className ?? "bg-gray-100 text-gray-700"}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusCfg?.label ?? task.status}
                              </span>
                            }
                            fields={[
                              { label: "Kategori", value: task.category ?? "-" },
                              { label: "Durasi", value: formatDuration(task.duration) },
                              { label: "Lab", value: task.lab?.name ?? "-" },
                              { label: "Tanggal", value: formatDate(task.createdAt) },
                            ]}
                            actions={[
                              {
                                label: "Review",
                                onClick: () => openReviewModal(task),
                                variant: "warning",
                              },
                            ]}
                          />
                        );
                      })}
                    </div>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full min-w-[1100px] border-collapse">
                        <thead>
                          <tr className="bg-[#e8d8c9] text-[#1a1a1a]">
                            <th className="text-left p-3 text-sm font-black">Aslab Name</th>
                            <th className="text-left p-3 text-sm font-black">Task</th>
                            <th className="text-left p-3 text-sm font-black">Category</th>
                            <th className="text-left p-3 text-sm font-black">Duration</th>
                            <th className="text-left p-3 text-sm font-black">Lab</th>
                            <th className="text-left p-3 text-sm font-black">Status</th>
                            <th className="text-left p-3 text-sm font-black">Date</th>
                            <th className="text-left p-3 text-sm font-black">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleTasks.map((task) => {
                            const statusCfg = TASK_STATUS_CONFIG[task.status];
                            const StatusIcon = statusCfg?.icon ?? TbClock;
                            return (
                              <tr key={task.id} className="border-b border-[#e8d8c9] hover:bg-[#f5ede6]">
                                <td className="p-3 text-sm font-semibold text-[#1a1a1a]">{task.user?.name ?? "-"}</td>
                                <td className="p-3 text-sm text-[#1a1a1a] max-w-[240px]">
                                  <p className="font-semibold truncate">{task.task}</p>
                                </td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{task.category ?? "-"}</td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{formatDuration(task.duration)}</td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{task.lab?.name ?? "-"}</td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusCfg?.className ?? "bg-gray-100 text-gray-700"}`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusCfg?.label ?? task.status}
                                  </span>
                                </td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{formatDate(task.createdAt)}</td>
                                <td className="p-3">
                                  <button onClick={() => openReviewModal(task)} className="neo-btn px-3 py-1.5 bg-[#f3701e] text-white text-xs font-bold">
                                    Review
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "SHIFTS" && (
            <div className="space-y-4">
              <div className="neo-card p-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="space-y-2">
                  <label htmlFor="month-filter" className="text-xs font-bold text-[#5a5a5a] uppercase">
                    Filter Month
                  </label>
                  <input
                    id="month-filter"
                    type="month"
                    value={scheduleMonth}
                    onChange={(event) => setScheduleMonth(event.target.value)}
                    className="neo-input neo-border px-3 py-2 rounded-lg bg-white text-[#1a1a1a]"
                  />
                </div>

                <button onClick={openShiftModal} className="neo-btn px-4 py-2.5 bg-[#4b607f] text-white font-bold text-sm">
                  <span className="inline-flex items-center gap-2">
                    <TbPlus className="w-4 h-4" /> Tambah Jadwal
                  </span>
                </button>
              </div>

              <div className="neo-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-lg md:text-xl font-black text-[#1a1a1a]">Shift Assignment ({scheduleMonth})</h2>
                  {shiftLoading && (
                    <span className="inline-flex items-center gap-2 text-sm text-[#5a5a5a]">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Loading...
                    </span>
                  )}
                </div>

                {shiftLoading ? (
                  <div className="py-12 text-center text-[#5a5a5a] font-semibold">Memuat jadwal shift...</div>
                ) : shiftSchedules.length === 0 ? (
                  <div className="py-12 text-center text-[#5a5a5a] font-semibold">Belum ada jadwal shift untuk bulan ini.</div>
                ) : (
                  <>
                    <div className="lg:hidden space-y-3">
                      {shiftSchedules.map((schedule) => {
                        const statusCfg = SHIFT_STATUS_CONFIG[schedule.status];
                        const StatusIcon = statusCfg?.icon ?? TbClock;
                        const shiftLabel = schedule.shift?.name ?? `${schedule.shift?.startTime ?? "-"} - ${schedule.shift?.endTime ?? "-"}`;
                        return (
                          <MobileCard
                            key={schedule.id}
                            title={schedule.user?.name ?? "-"}
                            subtitle={formatDate(schedule.scheduleDate)}
                            badge={
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusCfg?.className ?? "bg-gray-100 text-gray-700"}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusCfg?.label ?? schedule.status}
                              </span>
                            }
                            fields={[
                              { label: "Lab", value: schedule.lab?.name ?? "-" },
                              { label: "Shift", value: shiftLabel },
                            ]}
                            actions={[
                              {
                                label: "Hapus",
                                icon: <TbTrash className="w-4 h-4" />,
                                onClick: () => void deleteShiftSchedule(schedule.id),
                                variant: "danger",
                              },
                            ]}
                          />
                        );
                      })}
                    </div>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full min-w-[1000px] border-collapse">
                        <thead>
                          <tr className="bg-[#e8d8c9] text-[#1a1a1a]">
                            <th className="text-left p-3 text-sm font-black">Date</th>
                            <th className="text-left p-3 text-sm font-black">Aslab</th>
                            <th className="text-left p-3 text-sm font-black">Lab</th>
                            <th className="text-left p-3 text-sm font-black">Shift Time</th>
                            <th className="text-left p-3 text-sm font-black">Status</th>
                            <th className="text-left p-3 text-sm font-black">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shiftSchedules.map((schedule) => {
                            const statusCfg = SHIFT_STATUS_CONFIG[schedule.status];
                            const StatusIcon = statusCfg?.icon ?? TbClock;
                            const shiftLabel = schedule.shift?.name ?? `${schedule.shift?.startTime ?? "-"} - ${schedule.shift?.endTime ?? "-"}`;
                            return (
                              <tr key={schedule.id} className="border-b border-[#e8d8c9] hover:bg-[#f5ede6]">
                                <td className="p-3 text-sm text-[#1a1a1a]">{formatDate(schedule.scheduleDate)}</td>
                                <td className="p-3 text-sm font-semibold text-[#1a1a1a]">{schedule.user?.name ?? "-"}</td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{schedule.lab?.name ?? "-"}</td>
                                <td className="p-3 text-sm text-[#5a5a5a]">{shiftLabel}</td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusCfg?.className ?? "bg-gray-100 text-gray-700"}`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusCfg?.label ?? schedule.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <button onClick={() => void deleteShiftSchedule(schedule.id)} className="neo-btn px-3 py-1.5 bg-red-600 text-white text-xs font-bold">
                                    <span className="inline-flex items-center gap-1.5">
                                      <TbTrash className="w-3.5 h-3.5" /> Delete
                                    </span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      {activeTab === "LEAVES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">
              Pengajuan Izin / Sakit Pending
            </h2>
            <button
              onClick={() => void loadPendingLeaves()}
              className="p-2 neo-border rounded-lg hover:bg-gray-50"
            >
              <TbRefresh className={`w-5 h-5 ${leavesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {leavesLoading ? (
            <div className="flex justify-center py-12">
              <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
            </div>
          ) : pendingLeaves.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <TbNotes className="w-12 h-12 text-[#4b607f]/30 mx-auto mb-3" />
              <p className="font-bold text-[#1a1a1a]">Tidak ada pengajuan izin yang menunggu review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.map((leave) => (
                <div key={leave.id} className="neo-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-[#1a1a1a]">{leave.user?.name || "—"}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                          leave.type === "SICK" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {leave.type === "SICK" ? "Sakit" : "Izin"}
                        </span>
                      </div>
                      <p className="text-sm text-[#5a5a5a]">
                        Tanggal: {new Date(leave.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <p className="text-sm text-[#1a1a1a] mt-1">{leave.reason}</p>
                      {leave.evidenceUrl && (
                        <a href={leave.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4b607f] underline mt-1 inline-block">
                          Lihat Bukti
                        </a>
                      )}
                      <p className="text-xs text-[#5a5a5a] mt-2">
                        Diajukan: {formatDateTime(leave.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => { setLeaveReviewAction("APPROVED"); openLeaveReview(leave); }}
                        className="px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg neo-border hover:bg-green-700"
                      >
                        <TbCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setLeaveReviewAction("REJECTED"); openLeaveReview(leave); }}
                        className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg neo-border hover:bg-red-700"
                      >
                        <TbX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {leaveReviewOpen && selectedLeave && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
            onClick={() => setLeaveReviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f5ede6] neo-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-[#1a1a1a] truncate">
                  {leaveReviewAction === "APPROVED" ? "Setujui" : "Tolak"} Pengajuan
                </h3>
                <button
                  type="button"
                  onClick={() => setLeaveReviewOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <p className="text-sm"><span className="font-bold">Nama:</span> {selectedLeave.user?.name}</p>
                <p className="text-sm"><span className="font-bold">Tipe:</span> {selectedLeave.type === "SICK" ? "Sakit" : "Izin"}</p>
                <p className="text-sm"><span className="font-bold">Tanggal:</span> {formatDate(selectedLeave.date)}</p>
                <p className="text-sm"><span className="font-bold">Alasan:</span> {selectedLeave.reason}</p>
              </div>
              <div className="mb-4">
                <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Catatan (opsional)</label>
                <textarea
                  value={leaveReviewNote}
                  onChange={(e) => setLeaveReviewNote(e.target.value)}
                  placeholder="Catatan untuk aslab..."
                  className="w-full px-4 py-3 neo-input text-sm bg-white resize-none h-20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitLeaveReview}
                  disabled={leaveReviewSubmitting}
                  className={`flex-1 py-3 text-white text-sm font-bold rounded-lg neo-border disabled:opacity-50 ${
                    leaveReviewAction === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {leaveReviewSubmitting ? "Memproses..." : leaveReviewAction === "APPROVED" ? "Setujui" : "Tolak"}
                </button>
                <button
                  onClick={() => setLeaveReviewOpen(false)}
                  className="flex-1 py-3 bg-white text-[#1a1a1a] text-sm font-bold rounded-lg neo-border"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {verifyOpen && selectedAttendance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
            onClick={() => setVerifyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-lg bg-[#f5ede6] p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-xl font-black text-[#1a1a1a]">Verify Attendance</h3>
                  <p className="text-sm text-[#5a5a5a] mt-1">{selectedAttendance.user?.name ?? "-"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVerifyOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => setVerifyAction("APPROVED")}
                  className={`neo-btn px-4 py-2 text-sm font-bold ${
                    verifyAction === "APPROVED" ? "bg-green-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Approve
                </button>
                <button
                  onClick={() => setVerifyAction("REJECTED")}
                  className={`neo-btn px-4 py-2 text-sm font-bold ${
                    verifyAction === "REJECTED" ? "bg-red-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Reject
                </button>
              </div>

              <label className="block mt-4 text-xs font-bold uppercase text-[#5a5a5a]">Notes</label>
              <textarea
                value={verifyNote}
                onChange={(event) => setVerifyNote(event.target.value)}
                rows={4}
                placeholder="Catatan verifikasi..."
                className="neo-input neo-border mt-2 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
              />

              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setVerifyOpen(false)} className="neo-btn px-4 py-2 bg-white text-[#1a1a1a] text-sm font-bold">
                  Batal
                </button>
                <button
                  onClick={() => void submitVerifyAttendance()}
                  disabled={verifySubmitting}
                  className="neo-btn px-4 py-2 bg-[#4b607f] text-white text-sm font-bold disabled:opacity-60"
                >
                  {verifySubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                    </span>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewOpen && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
            onClick={() => setReviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-xl bg-[#f5ede6] p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-xl font-black text-[#1a1a1a]">Review Task</h3>
                  <p className="text-sm text-[#5a5a5a] mt-1 truncate">
                    {selectedTask.user?.name ?? "-"} · {selectedTask.task}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => setReviewAction("APPROVED")}
                  className={`neo-btn px-3 py-2 text-sm font-bold ${
                    reviewAction === "APPROVED" ? "bg-green-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Approve
                </button>
                <button
                  onClick={() => setReviewAction("REJECTED")}
                  className={`neo-btn px-3 py-2 text-sm font-bold ${
                    reviewAction === "REJECTED" ? "bg-red-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Reject
                </button>
                <button
                  onClick={() => setReviewAction("NEED_REVISION")}
                  className={`neo-btn px-3 py-2 text-sm font-bold ${
                    reviewAction === "NEED_REVISION" ? "bg-orange-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Need Revision
                </button>
              </div>

              <label className="block mt-4 text-xs font-bold uppercase text-[#5a5a5a]">Review Note</label>
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                rows={4}
                placeholder="Catatan review..."
                className="neo-input neo-border mt-2 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
              />

              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setReviewOpen(false)} className="neo-btn px-4 py-2 bg-white text-[#1a1a1a] text-sm font-bold">
                  Batal
                </button>
                <button
                  onClick={() => void submitTaskReview()}
                  disabled={reviewSubmitting}
                  className="neo-btn px-4 py-2 bg-[#f3701e] text-white text-sm font-bold disabled:opacity-60"
                >
                  {reviewSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                    </span>
                  ) : (
                    "Simpan Review"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shiftModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
            onClick={() => setShiftModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 10, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-2xl bg-[#f5ede6] p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-xl font-black text-[#1a1a1a]">Tambah Jadwal Shift</h3>
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] flex items-center gap-1">
                    <TbUsers className="w-4 h-4" /> Aslab
                  </label>
                  <select
                    value={shiftForm.userId}
                    onChange={(event) => setShiftForm((prev) => ({ ...prev, userId: event.target.value }))}
                    className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
                  >
                    <option value="">Pilih Aslab</option>
                    {aslabUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] flex items-center gap-1">
                    <TbBuildingWarehouse className="w-4 h-4" /> Lab
                  </label>
                  <select
                    value={shiftForm.labId}
                    onChange={(event) => setShiftForm((prev) => ({ ...prev, labId: event.target.value }))}
                    className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
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
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] flex items-center gap-1">
                    <TbClock className="w-4 h-4" /> Shift
                  </label>
                  <select
                    value={shiftForm.shiftId}
                    onChange={(event) => setShiftForm((prev) => ({ ...prev, shiftId: event.target.value }))}
                    className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
                  >
                    <option value="">Pilih Shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {(shift.name ?? "Shift")} ({shift.startTime} - {shift.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] flex items-center gap-1">
                    <TbCalendar className="w-4 h-4" /> Tanggal Utama
                  </label>
                  <input
                    type="date"
                    value={shiftForm.scheduleDate}
                    onChange={(event) => setShiftForm((prev) => ({ ...prev, scheduleDate: event.target.value }))}
                    className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-bold uppercase text-[#5a5a5a]">
                  Bulk Dates (pisahkan dengan koma atau baris baru)
                </label>
                <textarea
                  value={shiftForm.bulkDatesText}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, bulkDatesText: event.target.value }))}
                  rows={3}
                  placeholder="2026-05-10, 2026-05-12"
                  className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
                />
              </div>

              <div className="mt-3">
                <label className="text-xs font-bold uppercase text-[#5a5a5a] flex items-center gap-1">
                  <TbNotes className="w-4 h-4" /> Notes
                </label>
                <textarea
                  value={shiftForm.notes}
                  onChange={(event) => setShiftForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  placeholder="Catatan jadwal"
                  className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShiftModalOpen(false)}
                  className="neo-btn px-4 py-2 bg-white text-[#1a1a1a] text-sm font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={() => void submitShiftSchedule()}
                  disabled={shiftSubmitting}
                  className="neo-btn px-4 py-2 bg-[#4b607f] text-white text-sm font-bold disabled:opacity-60"
                >
                  {shiftSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <TbLoader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                    </span>
                  ) : (
                    "Simpan Jadwal"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
