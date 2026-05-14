"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  TbArrowLeft,
  TbCalendarEvent,
  TbChecklist,
  TbClipboardList,
  TbTargetArrow,
  TbLoader2,
  TbClock,
  TbMapPin,
  TbAlertTriangle,
  TbCircleCheck,
  TbCircleX,
} from "react-icons/tb";
import api from "@/services/api";

interface AslebUser {
  id: string;
  name: string;
  email: string;
  nim?: string;
  phone?: string;
  isActive: boolean;
}

interface AttendanceStats {
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  forgotCheckout: number;
  totalHours: number;
  averageHoursPerDay: number;
}

interface AttendanceRecord {
  id: string;
  status: string;
  checkinAt?: string;
  checkoutAt?: string;
  workDurationMinutes?: number;
  createdAt: string;
  shiftSchedule?: {
    shift?: { name: string; startTime: string; endTime: string };
    lab?: { name: string };
  };
  dailyTasks?: DailyTask[];
}

interface DailyTask {
  id: string;
  task: string;
  description?: string;
  category: string;
  status: string;
  duration?: number;
  createdAt: string;
  lab?: { name: string };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  CHECKED_IN: { label: "Check In", color: "text-blue-700", bg: "bg-blue-50" },
  LATE: { label: "Terlambat", color: "text-orange-700", bg: "bg-orange-50" },
  CHECKED_OUT: { label: "Check Out", color: "text-green-700", bg: "bg-green-50" },
  APPROVED: { label: "Disetujui", color: "text-green-700", bg: "bg-green-50" },
  WAITING_VERIFICATION: { label: "Menunggu", color: "text-yellow-700", bg: "bg-yellow-50" },
  REJECTED: { label: "Ditolak", color: "text-red-700", bg: "bg-red-50" },
  FORGOT_CHECKOUT: { label: "Lupa Checkout", color: "text-purple-700", bg: "bg-purple-50" },
  ABSENT: { label: "Absen", color: "text-red-700", bg: "bg-red-50" },
};

const taskStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Draft", color: "text-gray-700", bg: "bg-gray-100" },
  SUBMITTED: { label: "Submitted", color: "text-blue-700", bg: "bg-blue-50" },
  APPROVED: { label: "Approved", color: "text-green-700", bg: "bg-green-50" },
  REJECTED: { label: "Rejected", color: "text-red-700", bg: "bg-red-50" },
  NEED_REVISION: { label: "Revisi", color: "text-orange-700", bg: "bg-orange-50" },
};

export default function AssistantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [user, setUser] = useState<AslebUser | null>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, detailRes] = await Promise.allSettled([
        api.get<{ data: AslebUser }>(`/users/${id}`),
        api.get<{ data: { attendances: AttendanceRecord[]; tasks: DailyTask[]; stats: AttendanceStats } }>(
          `/attendance/detail/${id}?month=${selectedMonth}`
        ),
      ]);

      if (userRes.status === "fulfilled") {
        const raw: unknown = userRes.value.data;
        const detail =
          raw && typeof raw === "object" && "data" in raw
            ? (raw as { data?: unknown }).data
            : raw;
        setUser((detail as AslebUser) ?? null);
      }

      if (detailRes.status === "fulfilled") {
        const raw: unknown = detailRes.value.data;
        const detail =
          raw && typeof raw === "object" && "data" in raw
            ? (raw as { data?: unknown }).data
            : raw;

        const d = (detail ?? {}) as Partial<{
          stats: AttendanceStats;
          attendances: AttendanceRecord[];
          tasks: DailyTask[];
        }>;
        setStats(d.stats ?? null);
        setAttendances(Array.isArray(d.attendances) ? d.attendances : []);
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [id, selectedMonth]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/assistants")}
          className="w-12 h-12 neo-btn bg-white text-[#1a1a1a] flex items-center justify-center"
        >
          <TbArrowLeft className="w-6 h-6" strokeWidth={2.2} />
        </motion.button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[#1a1a1a] tracking-tight">Detail Asisten Lab</h1>
          <p className="text-sm text-[#5a5a5a]">Ringkasan performa, absensi, dan daily tasks</p>
        </div>
      </div>

      <div className="neo-card p-4 sm:p-6 bg-[#e8d8c9]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-xl neo-border bg-white flex items-center justify-center text-2xl font-heading font-bold text-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a]">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex-1">
            <p className="text-2xl font-heading font-bold text-[#1a1a1a]">{user?.name || "User tidak ditemukan"}</p>
            <p className="text-sm font-medium text-[#5a5a5a]">{user?.email || "-"}</p>
            {user?.nim && <p className="text-xs font-bold text-[#4b607f] mt-0.5">NIM: {user.nim}</p>}
          </div>
          <div className="flex items-center gap-3">
            {user?.phone && (
              <span className="text-sm font-bold text-[#1a1a1a] bg-white neo-border px-3 py-1.5 rounded-lg">
                {user.phone}
              </span>
            )}
            <span
              className={`neo-badge px-3 py-1.5 text-xs font-bold neo-border ${
                user?.isActive ? "bg-[#e8f5e9] text-green-800" : "bg-red-50 text-red-700"
              }`}
            >
              {user?.isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-bold text-[#1a1a1a]">Bulan:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="neo-input px-4 py-2 bg-white text-sm"
        />
      </div>

      {stats && (
        <div className="space-y-3">
          <h2 className="font-heading font-bold text-xl text-[#1a1a1a] flex items-center gap-2">
            <TbChecklist className="w-6 h-6 text-[#4b607f]" strokeWidth={2.2} />
            Statistik Kehadiran
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-[#1a1a1a]">{stats.totalDays}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Total Hari</p>
            </div>
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-green-600">{stats.present}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Hadir</p>
            </div>
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-[#f3701e]">{stats.late}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Terlambat</p>
            </div>
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-red-600">{stats.absent}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Absen</p>
            </div>
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-purple-600">{stats.forgotCheckout}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Lupa CO</p>
            </div>
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-[#4b607f]">{stats.totalHours}h</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Total Jam</p>
            </div>
            <div className="neo-card p-4 bg-white text-center">
              <p className="text-2xl font-heading font-bold text-[#1a1a1a]">{stats.averageHoursPerDay}h</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Rata-rata/Hari</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-[#1a1a1a] flex items-center gap-2">
          <TbCalendarEvent className="w-6 h-6 text-[#4b607f]" strokeWidth={2.2} />
          Riwayat Absensi
        </h2>
        {attendances.length === 0 ? (
          <div className="neo-card p-8 text-center bg-white/50 border-dashed">
            <TbCalendarEvent className="w-10 h-10 text-[#4b607f]/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-bold text-[#5a5a5a]">Belum ada data absensi bulan ini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attendances.slice(0, 15).map((att) => {
              const cfg = statusConfig[att.status] || { label: att.status, color: "text-gray-700", bg: "bg-gray-100" };
              return (
                <div key={att.id} className="neo-card p-4 bg-white flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#1a1a1a]">{formatDate(att.createdAt)}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded neo-border-sm ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {att.shiftSchedule && (
                      <p className="text-xs text-[#5a5a5a] mt-1">
                        <TbMapPin className="inline w-3 h-3 mr-1" />
                        {att.shiftSchedule.lab?.name || "-"} • {att.shiftSchedule.shift?.name || "Shift"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-bold text-[#4b607f]">
                      <TbClock className="inline w-4 h-4 mr-1" />
                      {formatTime(att.checkinAt)} - {formatTime(att.checkoutAt)}
                    </span>
                    {att.workDurationMinutes != null && att.workDurationMinutes > 0 && (
                      <span className="text-xs font-bold text-[#1a1a1a] bg-[#f5ede6] px-2 py-1 rounded neo-border-sm">
                        {Math.floor(att.workDurationMinutes / 60)}j {att.workDurationMinutes % 60}m
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {attendances.length > 15 && (
              <p className="text-center text-sm font-bold text-[#4b607f]">
                +{attendances.length - 15} data lainnya
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-[#1a1a1a] flex items-center gap-2">
          <TbClipboardList className="w-6 h-6 text-[#4b607f]" strokeWidth={2.2} />
          Daily Tasks ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <div className="neo-card p-8 text-center bg-white/50 border-dashed">
            <TbClipboardList className="w-10 h-10 text-[#4b607f]/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-bold text-[#5a5a5a]">Belum ada daily task bulan ini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 20).map((task) => {
              const tcfg = taskStatusConfig[task.status] || { label: task.status, color: "text-gray-700", bg: "bg-gray-100" };
              return (
                <div key={task.id} className="neo-card p-4 bg-white flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#1a1a1a]">{task.task}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded neo-border-sm ${tcfg.bg} ${tcfg.color}`}>
                        {tcfg.label}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-[#5a5a5a] mt-1 line-clamp-1">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-[#5a5a5a]">
                    {task.lab && <span className="bg-[#f5ede6] px-2 py-1 rounded">{task.lab.name}</span>}
                    <span className="bg-[#e8d8c9] px-2 py-1 rounded">{task.category}</span>
                    {task.duration && <span>{task.duration} menit</span>}
                    <span>{formatDate(task.createdAt)}</span>
                  </div>
                </div>
              );
            })}
            {tasks.length > 20 && (
              <p className="text-center text-sm font-bold text-[#4b607f]">
                +{tasks.length - 20} task lainnya
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="neo-card p-5 bg-white">
          <h3 className="font-heading font-bold text-lg text-[#1a1a1a] flex items-center gap-2 mb-3">
            <TbCircleCheck className="w-5 h-5 text-green-600" strokeWidth={2.2} /> Task Summary
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[#f5ede6] neo-border-sm p-3 rounded-lg text-center">
              <p className="font-heading font-bold text-2xl text-[#1a1a1a]">{tasks.length}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Total</p>
            </div>
            <div className="bg-green-50 neo-border-sm p-3 rounded-lg text-center">
              <p className="font-heading font-bold text-2xl text-green-600">{tasks.filter((t) => t.status === "APPROVED").length}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Approved</p>
            </div>
            <div className="bg-orange-50 neo-border-sm p-3 rounded-lg text-center">
              <p className="font-heading font-bold text-2xl text-[#f3701e]">{tasks.filter((t) => t.status === "SUBMITTED").length}</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Pending</p>
            </div>
          </div>
        </div>
        <div className="neo-card p-5 bg-white">
          <h3 className="font-heading font-bold text-lg text-[#1a1a1a] flex items-center gap-2 mb-3">
            <TbClock className="w-5 h-5 text-[#4b607f]" strokeWidth={2.2} /> Jam Kerja
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-[#f5ede6] neo-border-sm p-3 rounded-lg text-center">
              <p className="font-heading font-bold text-2xl text-[#4b607f]">{stats?.totalHours || 0}h</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Total Bulan Ini</p>
            </div>
            <div className="bg-[#f5ede6] neo-border-sm p-3 rounded-lg text-center">
              <p className="font-heading font-bold text-2xl text-[#1a1a1a]">{stats?.averageHoursPerDay || 0}h</p>
              <p className="text-xs font-bold text-[#5a5a5a]">Rata-rata/Hari</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
