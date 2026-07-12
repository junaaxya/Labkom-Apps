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
  AsLabPicketDestination,
  DailyTaskLog,
  ShiftSchedule,
  Shift,
  User,
  AttendanceStatus,
  DailyTaskStatus,
  ShiftScheduleStatus,
  AttendanceCorrectionRequest,
  TaskCategoryConfig,
} from "@/types/index";

type MonitoringTab = "TODAY" | "TASKS" | "SHIFTS" | "LEAVES" | "CORRECTIONS" | "CATEGORIES";
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
  destination: AsLabPicketDestination;
  shiftId: string;
  scheduleDate: string;
  notes?: string;
};

type ShiftCreateBulkPayload = {
  userId: string;
  destination: AsLabPicketDestination;
  shiftId: string;
  dates: string[];
  notes?: string;
};

type ShiftFormState = {
  userId: string;
  destination: "" | AsLabPicketDestination;
  shiftId: string;
  scheduleDate: string;
  bulkDatesText: string;
  notes: string;
};

const PICKET_DESTINATIONS: Array<{ value: AsLabPicketDestination; label: string }> = [
  { value: "RUANGAN_ASLAB", label: "Ruangan Aslab" },
  { value: "LAB_MULTIMEDIA", label: "Lab Multimedia" },
  { value: "LAB_DASAR", label: "Lab Dasar" },
];

function destinationLabel(destination?: AsLabPicketDestination): string {
  return PICKET_DESTINATIONS.find((item) => item.value === destination)?.label ?? "-";
}

function scheduleLocationLabel(schedule: ShiftSchedule): string {
  return schedule.lab?.name ?? destinationLabel(schedule.destination);
}

type ApiMaybeWrapped<T> = T | { data?: T; items?: T };

type CategoryFormState = {
  name: string;
  description: string;
  defaultPoints: number;
  isEvidenceRequired: boolean;
  isActive: boolean;
};

interface LeaveRequestItem {
  id: string;
  userId?: string;
  user?: User | null;
  type: "SICK" | "PERMISSION" | string;
  date: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  evidenceUrl?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

const TABS: Array<{ key: MonitoringTab; label: string; icon: typeof TbCalendarStats }> = [
  { key: "TODAY", label: "Kehadiran", icon: TbCalendarStats },
  { key: "TASKS", label: "Verifikasi Task", icon: TbChecklist },
  { key: "SHIFTS", label: "Shift", icon: TbClockCog },
  { key: "LEAVES", label: "Izin / Sakit", icon: TbNotes },
  { key: "CORRECTIONS", label: "Koreksi", icon: TbUserCheck },
  { key: "CATEGORIES", label: "Kategori Task", icon: TbClipboardCheck },
];

function ToggleSwitch({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors border-2 border-[#1a1a1a] ${
        checked ? "bg-[#4b607f]" : "bg-gray-300"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <div
        className={`h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </div>
  );
}

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
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [leavesLoading, setLeavesLoading] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequestItem[]>([]);
  const [leaveReviewOpen, setLeaveReviewOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestItem | null>(null);
  const [leaveReviewAction, setLeaveReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [leaveReviewNote, setLeaveReviewNote] = useState("");
  const [leaveReviewSubmitting, setLeaveReviewSubmitting] = useState(false);

  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [correctionReviewOpen, setCorrectionReviewOpen] = useState(false);
  const [reviewingCorrection, setReviewingCorrection] = useState<AttendanceCorrectionRequest | null>(null);
  const [correctionReviewStatus, setCorrectionReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [correctionReviewNote, setCorrectionReviewNote] = useState("");
  const [correctionReviewSubmitting, setCorrectionReviewSubmitting] = useState(false);

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
  const [shiftForm, setShiftForm] = useState<ShiftFormState>({
    userId: "",
    destination: "",
    shiftId: "",
    scheduleDate: "",
    bulkDatesText: "",
    notes: "",
  });

  const [categories, setCategories] = useState<TaskCategoryConfig[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TaskCategoryConfig | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    description: "",
    defaultPoints: 0,
    isEvidenceRequired: false,
    isActive: true,
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
      const [usersRes, shiftsRes] = await Promise.all([
        api.get<ApiMaybeWrapped<User[]> | Record<string, unknown>>("/users?role=ASISTEN_LAB"),
        api.get<ApiMaybeWrapped<Shift[]> | Record<string, unknown>>("/shifts"),
      ]);
      setAslabUsers(safeArray<User>(usersRes, ["users", "rows"]));
      setShifts(safeArray<Shift>(shiftsRes, ["shifts", "rows"]));
    } catch {
      setAslabUsers([]);
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
    queueMicrotask(() => {
      void loadTodayMonitoring();
      void loadTaskVerifications();
      void loadShiftReferences();
    });
  }, [loadTodayMonitoring, loadTaskVerifications, loadShiftReferences]);

  useEffect(() => {
    queueMicrotask(() => void loadShiftSchedules());
  }, [loadShiftSchedules]);

  const loadPendingLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res = await api.get<unknown>("/attendance/leaves/pending");
      const data = safeArray<LeaveRequestItem>(res, ["data"]);
      setPendingLeaves(data);
    } catch {
      setPendingLeaves([]);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  const resetCategoryForm = useCallback(() => {
    setCategoryForm({
      name: "",
      description: "",
      defaultPoints: 0,
      isEvidenceRequired: false,
      isActive: true,
    });
    setEditingCategory(null);
  }, []);

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category: TaskCategoryConfig) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      defaultPoints: category.defaultPoints,
      isEvidenceRequired: category.isEvidenceRequired,
      isActive: category.isActive,
    });
    setIsCategoryModalOpen(true);
  };

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await api.get<unknown>("/attendance/task-categories");
      const data = safeArray<TaskCategoryConfig>(response, ["categories", "rows"]);
      setCategories(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat kategori task.");
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab !== "CATEGORIES") return;
    queueMicrotask(() => void loadCategories());
  }, [activeTab, loadCategories]);

  const handleSaveCategory = async () => {
    setCategoriesLoading(true);
    try {
      if (editingCategory) {
        await api.patch(`/attendance/task-categories/${editingCategory.id}`, categoryForm);
        toast.success("Kategori task berhasil diperbarui");
      } else {
        await api.post("/attendance/task-categories", categoryForm);
        toast.success("Kategori task berhasil ditambahkan");
      }
      setIsCategoryModalOpen(false);
      resetCategoryForm();
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan kategori");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleDeleteCategory = async (category: TaskCategoryConfig) => {
    const confirmed = window.confirm(`Hapus kategori ${category.name}?`);
    if (!confirmed) return;

    setCategoriesLoading(true);
    try {
      await api.delete(`/attendance/task-categories/${category.id}`);
      toast.success("Kategori task berhasil dihapus");
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus kategori");
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "LEAVES") return;
    queueMicrotask(() => void loadPendingLeaves());
  }, [activeTab, loadPendingLeaves]);

  const renderCategoriesTab = () => {
    return (
      <div className="neo-card p-4 sm:p-6 bg-white space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b-2 border-[#1a1a1a] pb-4">
          <div>
            <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Kategori Task</h2>
            <p className="text-[#5a5a5a] font-semibold mt-1 text-sm">
              Kelola jenis tugas harian yang dilaporkan Aslab saat absensi. Kategori ini muncul di form Daily Task Log.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateCategoryModal}
            className="neo-btn min-h-[48px] bg-[#f3701e] text-white hover:bg-[#d95f10] flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <TbPlus size={18} />
            Tambah Kategori
          </button>
        </div>

        {categoriesLoading ? (
          <div className="neo-card p-10 bg-[#f5ede6] flex items-center justify-center gap-2 text-[#1a1a1a] font-bold">
            <TbLoader2 className="animate-spin" size={20} />
            Memuat kategori...
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {categories.map((category) => (
                <MobileCard
                  key={category.id}
                  title={category.name}
                  subtitle={category.description || undefined}
                  badge={
                    <span
                      className={`neo-badge px-3 py-1 text-xs font-bold ${
                        category.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  }
                  fields={[
                    { label: "Default Points", value: String(category.defaultPoints) },
                    {
                      label: "Evidence Required",
                      value: (
                        <span
                          className={`neo-badge px-2 py-0.5 text-xs font-bold ${
                            category.isEvidenceRequired
                              ? "bg-[#4b607f] text-white"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {category.isEvidenceRequired ? "Ya" : "Tidak"}
                        </span>
                      ),
                    },
                  ]}
                  actions={[
                    {
                      label: "Edit",
                      icon: <TbEdit size={16} />,
                      onClick: () => openEditCategoryModal(category),
                      variant: "secondary",
                    },
                    {
                      label: "Hapus",
                      icon: <TbTrash size={16} />,
                      onClick: () => void handleDeleteCategory(category),
                      variant: "danger",
                      disabled: categoriesLoading,
                    },
                  ]}
                />
              ))}
              {categories.length === 0 && (
                <div className="neo-card p-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
                  Belum ada kategori task.
                </div>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto neo-border">
              <table className="w-full min-w-[980px]">
                <thead className="bg-[#e8d8c9]">
                  <tr className="text-left text-[#1a1a1a]">
                    <th className="px-4 py-3 font-bold">Nama</th>
                    <th className="px-4 py-3 font-bold">Deskripsi</th>
                    <th className="px-4 py-3 font-bold">Default Points</th>
                    <th className="px-4 py-3 font-bold">Evidence Required</th>
                    <th className="px-4 py-3 font-bold">Active</th>
                    <th className="px-4 py-3 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-t-2 border-[#1a1a1a] bg-[#f5ede6]">
                      <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{category.name}</td>
                      <td className="px-4 py-3 text-[#5a5a5a]">{category.description || "-"}</td>
                      <td className="px-4 py-3 text-[#5a5a5a]">{category.defaultPoints}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`neo-badge px-3 py-1 text-xs font-bold ${
                            category.isEvidenceRequired
                              ? "bg-[#4b607f] text-white"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {category.isEvidenceRequired ? "Ya" : "Tidak"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`neo-badge px-3 py-1 text-xs font-bold ${
                            category.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="neo-btn bg-white hover:bg-[#e8d8c9]"
                            onClick={() => openEditCategoryModal(category)}
                          >
                            <TbEdit size={18} />
                          </button>
                          <button
                            type="button"
                            className="neo-btn bg-white hover:bg-red-100 text-red-600"
                            onClick={() => void handleDeleteCategory(category)}
                            disabled={categoriesLoading}
                          >
                            <TbTrash size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
                        Belum ada kategori task.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  const openLeaveReview = (leave: LeaveRequestItem) => {
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

  const loadCorrections = useCallback(async () => {
    setCorrectionsLoading(true);
    try {
      const res = await api.get<unknown>("/attendance/corrections/pending");
      const data = safeArray<AttendanceCorrectionRequest>(res, ["data"]);
      setCorrections(data);
    } catch {
      setCorrections([]);
    } finally {
      setCorrectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "CORRECTIONS") return;
    queueMicrotask(() => void loadCorrections());
  }, [activeTab, loadCorrections]);

  const openCorrectionReview = (correction: AttendanceCorrectionRequest, status: "APPROVED" | "REJECTED") => {
    setReviewingCorrection(correction);
    setCorrectionReviewStatus(status);
    setCorrectionReviewNote("");
    setCorrectionReviewOpen(true);
  };

  const submitCorrectionReview = async () => {
    if (!reviewingCorrection) return;
    setCorrectionReviewSubmitting(true);
    try {
      await api.patch(`/attendance/corrections/${reviewingCorrection.id}/review`, {
        status: correctionReviewStatus,
        reviewNote: correctionReviewNote || undefined,
      });
      toast.success(`Koreksi ${correctionReviewStatus === "APPROVED" ? "disetujui" : "ditolak"}`);
      setCorrectionReviewOpen(false);
      setReviewingCorrection(null);
      void loadCorrections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal review koreksi");
    } finally {
      setCorrectionReviewSubmitting(false);
    }
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
      destination: "",
      shiftId: "",
      scheduleDate: "",
      bulkDatesText: "",
      notes: "",
    });
    setShiftModalOpen(true);
  };

  const submitShiftSchedule = async () => {
    const { userId, destination, shiftId, scheduleDate, bulkDatesText, notes } = shiftForm;
    if (!userId || !destination || !shiftId) {
      toast.error("Pilih Aslab, Tujuan Piket, dan Shift terlebih dahulu.");
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
      destination,
      shiftId,
      scheduleDate: date,
      notes: notes.trim() ? notes.trim() : undefined,
    }));

    setShiftSubmitting(true);
    try {
      if (payloads.length === 1) {
        await api.post("/attendance/shift-schedules", payloads[0]);
      } else {
        const bulkBody: ShiftCreateBulkPayload = {
          userId,
          destination,
          shiftId,
          dates: uniqueDates,
          notes: notes.trim() ? notes.trim() : undefined,
        };
        await api.post("/attendance/shift-schedules", bulkBody);
      }
      toast.success("Jadwal shift berhasil ditambahkan. Notifikasi dikirim ke Aslab terkait.");
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
    <div className="space-y-4 sm:space-y-6">
      <header className="neo-card p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-black text-[#1a1a1a] tracking-wide">
              Attendance Monitoring Koordinator
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#5a5a5a] font-medium">
              Pantau kehadiran hari ini, verifikasi task Aslab, dan atur assignment shift dalam satu dashboard.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void loadTodayMonitoring();
                void loadTaskVerifications();
                void loadShiftSchedules();
              }}
              className="md:hidden neo-btn min-h-[44px] min-w-[44px] px-3 py-2 bg-white text-[#1a1a1a]"
              aria-label="Refresh semua data"
            >
              <TbRefresh className="w-5 h-5" />
            </button>
            <div className="hidden md:flex flex-wrap gap-2">
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
        </div>
      </header>

      <div className="neo-card p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`neo-btn min-h-[48px] px-3 py-2.5 text-xs sm:text-sm transition-all ${
                  isActive ? "bg-[#1a1a1a] text-[#f5ede6]" : "bg-white text-[#1a1a1a]"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5 sm:gap-2 font-bold">
                  <TabIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="neo-card p-3 sm:p-4" style={{ backgroundColor: cardPalette.cream }}>
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Total Aslab</p>
                  <div className="mt-2 flex items-center gap-2 sm:gap-3">
                    <TbUsers className="w-5 h-5 sm:w-7 sm:h-7 text-[#4b607f]" />
                    <p className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">{todaySummary.totalAslab}</p>
                  </div>
                </div>
                <div className="neo-card p-3 sm:p-4 bg-green-50">
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Sudah Hadir</p>
                  <div className="mt-2 flex items-center gap-2 sm:gap-3">
                    <TbUserCheck className="w-5 h-5 sm:w-7 sm:h-7 text-green-700" />
                    <p className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">{todaySummary.checkedIn}</p>
                  </div>
                </div>
                <div className="neo-card p-3 sm:p-4 bg-red-50">
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Belum Hadir</p>
                  <div className="mt-2 flex items-center gap-2 sm:gap-3">
                    <TbUserX className="w-5 h-5 sm:w-7 sm:h-7 text-red-700" />
                    <p className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">{todaySummary.notCheckedIn}</p>
                  </div>
                </div>
                <div className="neo-card p-3 sm:p-4 bg-orange-50">
                  <p className="text-xs font-bold text-[#5a5a5a] uppercase">Terlambat</p>
                  <div className="mt-2 flex items-center gap-2 sm:gap-3">
                    <TbAlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-orange-700" />
                    <p className="font-heading text-xl sm:text-2xl font-black text-[#1a1a1a]">{todaySummary.late}</p>
                  </div>
                  <p className="mt-2 text-xs text-[#5a5a5a]">Izin/Sakit: {todaySummary.onLeave}</p>
                </div>
              </div>

              <div className="neo-card p-3 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-base sm:text-lg md:text-xl font-black text-[#1a1a1a]">Kehadiran Hari Ini</h2>
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
                    <div className="md:hidden space-y-3">
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
                    <div className="hidden md:block overflow-x-auto">
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

              <div className="neo-card p-3 sm:p-5">
                <h3 className="font-heading text-base sm:text-lg font-black text-[#1a1a1a] mb-4">Belum Check-in</h3>
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
                    className={`neo-btn min-h-[44px] px-4 py-2 text-sm font-bold ${
                      taskFilter === "PENDING" ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a]"
                    }`}
                  >
                    Menunggu Review
                  </button>
                  <button
                    onClick={() => setTaskFilter("SUBMITTED")}
                    className={`neo-btn min-h-[44px] px-4 py-2 text-sm font-bold ${
                      taskFilter === "SUBMITTED" ? "bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"
                    }`}
                  >
                    Sudah Disubmit
                  </button>
                </div>
              </div>

              <div className="neo-card p-3 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-base sm:text-lg md:text-xl font-black text-[#1a1a1a]">Daftar Verifikasi Tugas</h2>
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
                    <div className="md:hidden space-y-3">
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
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[1100px] border-collapse">
                        <thead>
                          <tr className="bg-[#e8d8c9] text-[#1a1a1a]">
                            <th className="text-left p-3 text-sm font-black">Aslab Name</th>
                            <th className="text-left p-3 text-sm font-black">Task</th>
                            <th className="text-left p-3 text-sm font-black">Category</th>
                            <th className="text-left p-3 text-sm font-black">Duration</th>
                            <th className="text-left p-3 text-sm font-black">Tujuan</th>
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
              <div className="neo-card p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1.5">
                  <label htmlFor="month-filter" className="text-[10px] font-black text-[#5a5a5a] uppercase tracking-wider">
                    Bulan Shift
                  </label>
                  <input
                    id="month-filter"
                    type="month"
                    value={scheduleMonth}
                    onChange={(event) => setScheduleMonth(event.target.value)}
                    className="neo-input neo-border min-h-[48px] px-4 py-3 rounded-xl bg-white text-[#1a1a1a] text-sm font-bold w-full sm:w-auto cursor-pointer"
                  />
                </div>

                <button onClick={openShiftModal} className="neo-btn min-h-[48px] px-4 py-2.5 bg-[#4b607f] text-white font-bold text-sm w-full sm:w-auto">
                  <span className="inline-flex items-center justify-center gap-2">
                    <TbPlus className="w-4 h-4" /> Tambah Jadwal
                  </span>
                </button>
              </div>

              <div className="neo-card p-3 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading text-base sm:text-lg md:text-xl font-black text-[#1a1a1a]">Shift Assignment ({scheduleMonth})</h2>
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
                    <div className="md:hidden space-y-3">
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
                    { label: "Tujuan", value: scheduleLocationLabel(schedule) },
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
                    <div className="hidden md:block overflow-x-auto">
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
                                <td className="p-3 text-sm text-[#5a5a5a]">{scheduleLocationLabel(schedule)}</td>
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

          {activeTab === "CATEGORIES" && renderCategoriesTab()}
        </motion.section>
      </AnimatePresence>

      {activeTab === "LEAVES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base sm:text-xl font-bold text-[#1a1a1a]">
              Pengajuan Izin / Sakit Pending
            </h2>
            <button
              onClick={() => void loadPendingLeaves()}
              className="min-h-[44px] min-w-[44px] p-2 neo-border rounded-lg hover:bg-gray-50 flex items-center justify-center"
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
                <div key={leave.id} className="neo-card p-3 sm:p-5">
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
                    <div className="flex gap-2 ml-3 sm:ml-4">
                      <button
                        onClick={() => { setLeaveReviewAction("APPROVED"); openLeaveReview(leave); }}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg neo-border hover:bg-green-700 flex items-center justify-center"
                      >
                        <TbCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setLeaveReviewAction("REJECTED"); openLeaveReview(leave); }}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg neo-border hover:bg-red-700 flex items-center justify-center"
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

      {activeTab === "CORRECTIONS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base sm:text-xl font-bold text-[#1a1a1a]">
              Koreksi Absensi Pending
            </h2>
            <button
              onClick={() => void loadCorrections()}
              className="min-h-[44px] min-w-[44px] p-2 neo-border rounded-lg hover:bg-gray-50 flex items-center justify-center"
            >
              <TbRefresh className={`w-5 h-5 ${correctionsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {correctionsLoading ? (
            <div className="flex justify-center py-12">
              <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
            </div>
          ) : corrections.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <TbUserCheck className="w-12 h-12 text-[#4b607f]/30 mx-auto mb-3" />
              <p className="font-bold text-[#1a1a1a]">Tidak ada permintaan koreksi yang menunggu review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {corrections.map((correction) => (
                <div key={correction.id} className="neo-card p-3 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-[#1a1a1a] truncate">{correction.user?.name || "—"}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-blue-100 text-blue-700 shrink-0">
                          {correction.requestType}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <p className="text-[#5a5a5a]"><span className="font-bold text-[#1a1a1a]">Nilai Lama:</span> {correction.oldValue || "-"}</p>
                        <p className="text-[#5a5a5a]"><span className="font-bold text-[#1a1a1a]">Nilai Baru:</span> {correction.newValue || "-"}</p>
                      </div>
                      <p className="text-sm text-[#1a1a1a] mt-2">{correction.reason}</p>
                      <p className="text-xs text-[#5a5a5a] mt-1">
                        Diajukan: {formatDateTime(correction.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-3 sm:ml-4">
                      <button
                        onClick={() => openCorrectionReview(correction, "APPROVED")}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg neo-border hover:bg-green-700 flex items-center justify-center"
                      >
                        <TbCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openCorrectionReview(correction, "REJECTED")}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg neo-border hover:bg-red-700 flex items-center justify-center"
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
        {correctionReviewOpen && reviewingCorrection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setCorrectionReviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f5ede6] neo-card p-4 sm:p-6 w-full max-w-md max-h-[80dvh] sm:max-h-[80vh] overflow-y-auto rounded-3xl sm:rounded-xl mb-[calc(80px+env(safe-area-inset-bottom))] sm:mb-0"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-[#1a1a1a] truncate">
                  {correctionReviewStatus === "APPROVED" ? "Setujui" : "Tolak"} Koreksi
                </h3>
                <button
                  type="button"
                  onClick={() => setCorrectionReviewOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <p className="text-sm"><span className="font-bold">Nama:</span> {reviewingCorrection.user?.name}</p>
                <p className="text-sm"><span className="font-bold">Tipe:</span> {reviewingCorrection.requestType}</p>
                <p className="text-sm"><span className="font-bold">Nilai Lama:</span> {reviewingCorrection.oldValue || "-"}</p>
                <p className="text-sm"><span className="font-bold">Nilai Baru:</span> {reviewingCorrection.newValue || "-"}</p>
                <p className="text-sm"><span className="font-bold">Alasan:</span> {reviewingCorrection.reason}</p>
              </div>
              <div className="mb-4">
                <label className="text-sm font-bold text-[#1a1a1a] block mb-2">Catatan (opsional)</label>
                <textarea
                  value={correctionReviewNote}
                  onChange={(e) => setCorrectionReviewNote(e.target.value)}
                  placeholder="Catatan review..."
                  className="w-full px-4 py-3 neo-input text-sm bg-white resize-none h-20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitCorrectionReview}
                  disabled={correctionReviewSubmitting}
                  className={`flex-1 min-h-[44px] py-3 text-white text-sm font-bold rounded-lg neo-border disabled:opacity-50 ${
                    correctionReviewStatus === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {correctionReviewSubmitting ? "Memproses..." : correctionReviewStatus === "APPROVED" ? "Setujui" : "Tolak"}
                </button>
                <button
                  onClick={() => setCorrectionReviewOpen(false)}
                  className="flex-1 min-h-[44px] py-3 bg-white text-[#1a1a1a] text-sm font-bold rounded-lg neo-border"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {leaveReviewOpen && selectedLeave && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setLeaveReviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#f5ede6] neo-card p-4 sm:p-6 w-full max-w-md max-h-[80dvh] sm:max-h-[80vh] overflow-y-auto rounded-3xl sm:rounded-xl mb-[calc(80px+env(safe-area-inset-bottom))] sm:mb-0"
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
                  className={`flex-1 min-h-[44px] py-3 text-white text-sm font-bold rounded-lg neo-border disabled:opacity-50 ${
                    leaveReviewAction === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {leaveReviewSubmitting ? "Memproses..." : leaveReviewAction === "APPROVED" ? "Setujui" : "Tolak"}
                </button>
                <button
                  onClick={() => setLeaveReviewOpen(false)}
                  className="flex-1 min-h-[44px] py-3 bg-white text-[#1a1a1a] text-sm font-bold rounded-lg neo-border"
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
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setVerifyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-lg bg-[#f5ede6] p-4 sm:p-5 max-h-[80dvh] sm:max-h-[80vh] overflow-y-auto rounded-3xl sm:rounded-xl mb-[calc(80px+env(safe-area-inset-bottom))] sm:mb-0"
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

              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4">
                <button
                  onClick={() => setVerifyAction("APPROVED")}
                  className={`neo-btn min-h-[44px] px-4 py-2 text-sm font-bold ${
                    verifyAction === "APPROVED" ? "bg-green-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Approve
                </button>
                <button
                  onClick={() => setVerifyAction("REJECTED")}
                  className={`neo-btn min-h-[44px] px-4 py-2 text-sm font-bold ${
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
                <button onClick={() => setVerifyOpen(false)} className="neo-btn min-h-[44px] px-4 py-2 bg-white text-[#1a1a1a] text-sm font-bold">
                  Batal
                </button>
                <button
                  onClick={() => void submitVerifyAttendance()}
                  disabled={verifySubmitting}
                  className="neo-btn min-h-[44px] px-4 py-2 bg-[#4b607f] text-white text-sm font-bold disabled:opacity-60"
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
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setReviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-xl bg-[#f5ede6] p-4 sm:p-5 max-h-[80dvh] sm:max-h-[80vh] overflow-y-auto rounded-3xl sm:rounded-xl mb-[calc(80px+env(safe-area-inset-bottom))] sm:mb-0"
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

              <div className="grid grid-cols-3 gap-2 mt-4">
                <button
                  onClick={() => setReviewAction("APPROVED")}
                  className={`neo-btn min-h-[44px] px-3 py-2 text-sm font-bold ${
                    reviewAction === "APPROVED" ? "bg-green-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Approve
                </button>
                <button
                  onClick={() => setReviewAction("REJECTED")}
                  className={`neo-btn min-h-[44px] px-3 py-2 text-sm font-bold ${
                    reviewAction === "REJECTED" ? "bg-red-600 text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  Reject
                </button>
                <button
                  onClick={() => setReviewAction("NEED_REVISION")}
                  className={`neo-btn min-h-[44px] px-3 py-2 text-xs font-bold ${
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
                <button onClick={() => setReviewOpen(false)} className="neo-btn min-h-[44px] px-4 py-2 bg-white text-[#1a1a1a] text-sm font-bold">
                  Batal
                </button>
                <button
                  onClick={() => void submitTaskReview()}
                  disabled={reviewSubmitting}
                  className="neo-btn min-h-[44px] px-4 py-2 bg-[#f3701e] text-white text-sm font-bold disabled:opacity-60"
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
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setShiftModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-2xl bg-[#f5ede6] p-4 sm:p-5 max-h-[80dvh] sm:max-h-[80vh] overflow-y-auto rounded-3xl sm:rounded-xl mb-[calc(80px+env(safe-area-inset-bottom))] sm:mb-0"
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
              <p className="mt-2 text-xs font-bold text-[#f3701e]">
                Notifikasi masuk ke panel aplikasi dan WhatsApp jika aktif. Push bar HP native butuh fitur Web Push terpisah.
              </p>

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
                    <TbBuildingWarehouse className="w-4 h-4" /> Tujuan Piket
                  </label>
                  <select
                    value={shiftForm.destination}
                    onChange={(event) => setShiftForm((prev) => ({ ...prev, destination: event.target.value as ShiftFormState["destination"] }))}
                    className="neo-input neo-border mt-1 w-full rounded-lg px-3 py-2 bg-white text-[#1a1a1a]"
                  >
                    <option value="">Pilih Tujuan</option>
                    {PICKET_DESTINATIONS.map((destination) => (
                      <option key={destination.value} value={destination.value}>
                        {destination.label}
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
                  className="neo-btn min-h-[44px] px-4 py-2 bg-white text-[#1a1a1a] text-sm font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={() => void submitShiftSchedule()}
                  disabled={shiftSubmitting}
                  className="neo-btn min-h-[44px] px-4 py-2 bg-[#4b607f] text-white text-sm font-bold disabled:opacity-60"
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

      <AnimatePresence>
        {isCategoryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => {
              setIsCategoryModalOpen(false);
              resetCategoryForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.98, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="neo-card w-full max-w-xl bg-[#f5ede6] p-4 sm:p-6 max-h-[80dvh] sm:max-h-[80vh] overflow-y-auto rounded-3xl sm:rounded-xl mb-[calc(80px+env(safe-area-inset-bottom))] sm:mb-0"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-heading text-xl font-black text-[#1a1a1a]">
                    {editingCategory ? "Edit Kategori Task" : "Tambah Kategori Task"}
                  </h3>
                  <p className="text-sm text-[#5a5a5a] mt-1">Konfigurasi kategori untuk Daily Task Log.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    resetCategoryForm();
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] block">Nama Kategori</label>
                  <input
                    type="text"
                    className="neo-input bg-white min-h-[44px] w-full mt-1"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Contoh: Piket Bersih, Maintenance PC"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] block">Deskripsi</label>
                  <p className="text-[10px] text-[#5a5a5a] mt-0.5 mb-1">Penjelasan singkat tugas ini untuk Aslab.</p>
                  <textarea
                    className="neo-input bg-white min-h-[80px] w-full resize-none"
                    value={categoryForm.description}
                    onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Contoh: Membersihkan ruangan lab sebelum dan sesudah praktikum"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-[#5a5a5a] block">Poin Reward</label>
                  <p className="text-[10px] text-[#5a5a5a] mt-0.5 mb-1">Poin yang didapat Aslab saat tugas ini di-approve.</p>
                  <input
                    type="number"
                    min={0}
                    className="neo-input bg-white min-h-[44px] w-full"
                    value={categoryForm.defaultPoints}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        defaultPoints: Number(event.target.value),
                      }))
                    }
                    placeholder="5"
                  />
                </div>

                <div className="rounded-xl border border-[#1a1a1a]/10 bg-[#f5ede6] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-bold text-sm text-[#1a1a1a]">Wajib Upload Foto</p>
                      <p className="text-[10px] text-[#5a5a5a] mt-0.5">Aslab harus lampirkan foto bukti saat melaporkan tugas ini.</p>
                    </div>
                    <ToggleSwitch
                      checked={categoryForm.isEvidenceRequired}
                      onToggle={() =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          isEvidenceRequired: !prev.isEvidenceRequired,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      resetCategoryForm();
                    }}
                    className="neo-btn min-h-[48px] flex-1 bg-white text-[#1a1a1a] font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveCategory()}
                    disabled={categoriesLoading || !categoryForm.name.trim()}
                    className="neo-btn min-h-[48px] flex-1 bg-[#4b607f] text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {categoriesLoading ? (
                      <TbLoader2 className="animate-spin w-5 h-5" />
                    ) : null}
                    {editingCategory ? "Update" : "Simpan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
