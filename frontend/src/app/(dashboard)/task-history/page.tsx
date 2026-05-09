"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  TbCalendar,
  TbClockHour4,
  TbFilter,
  TbListCheck,
  TbMapPin,
  TbSparkles,
  TbTool,
  TbClipboardList,
  TbDownload,
  TbUsers,
  TbFileText,
  TbDots,
  TbLoader2,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";

type TaskCategory =
  | "PIKET_BERSIH"
  | "MAINTENANCE_PC"
  | "INVENTARIS"
  | "INSTALASI"
  | "PENDAMPINGAN"
  | "ADMINISTRASI"
  | "LAINNYA";

type VerifiedFilter = "ALL" | "VERIFIED" | "UNVERIFIED";

interface DailyTask {
  id: string;
  task: string;
  description?: string;
  category: TaskCategory;
  duration?: number;
  verified: boolean;
  createdAt: string;
  labId?: string;
  lab?: { id: string; name: string };
}

interface LocalUser {
  userId?: string;
  name?: string;
  role?: string;
}

const categoryConfig: Record<
  TaskCategory,
  {
    label: string;
    badgeClass: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  }
> = {
  PIKET_BERSIH: {
    label: "Piket Bersih",
    badgeClass: "bg-green-100 text-green-700",
    icon: TbSparkles,
  },
  MAINTENANCE_PC: {
    label: "Maintenance PC",
    badgeClass: "bg-blue-100 text-blue-700",
    icon: TbTool,
  },
  INVENTARIS: {
    label: "Inventaris",
    badgeClass: "bg-purple-100 text-purple-700",
    icon: TbClipboardList,
  },
  INSTALASI: {
    label: "Instalasi",
    badgeClass: "bg-orange-100 text-orange-700",
    icon: TbDownload,
  },
  PENDAMPINGAN: {
    label: "Pendampingan",
    badgeClass: "bg-teal-100 text-teal-700",
    icon: TbUsers,
  },
  ADMINISTRASI: {
    label: "Administrasi",
    badgeClass: "bg-gray-100 text-gray-700",
    icon: TbFileText,
  },
  LAINNYA: {
    label: "Lainnya",
    badgeClass: "bg-slate-100 text-slate-700",
    icon: TbDots,
  },
};

const getInitialMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const parseResponseItems = (payload: any): DailyTask[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
};

export default function TaskHistoryPage() {
  const toast = useToast();
  const [user, setUser] = useState<LocalUser>({});
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | "ALL">("ALL");
  const [monthFilter, setMonthFilter] = useState(getInitialMonth());
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("ALL");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(storedUser);
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const response = await api.get<any>("/attendance/tasks/me");
        const raw = (response as any)?.data ?? response;
        setTasks(parseResponseItems(raw));
      } catch (err: any) {
        setTasks([]);
        toast.error(err?.message || "Gagal memuat riwayat tugas");
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const taskDate = new Date(task.createdAt);
      const taskMonth = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, "0")}`;

      const passCategory = categoryFilter === "ALL" || task.category === categoryFilter;
      const passMonth = taskMonth === monthFilter;
      const passVerified =
        verifiedFilter === "ALL" ||
        (verifiedFilter === "VERIFIED" && task.verified) ||
        (verifiedFilter === "UNVERIFIED" && !task.verified);

      return passCategory && passMonth && passVerified;
    });
  }, [tasks, categoryFilter, monthFilter, verifiedFilter]);

  const stats = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const verifiedCount = filteredTasks.filter((task) => task.verified).length;
    const totalMinutes = filteredTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    const totalHours = totalMinutes / 60;
    return {
      totalTasks,
      verifiedCount,
      totalHours,
    };
  }, [filteredTasks]);

  return (
    <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4 sm:mb-6 border-b-2 border-[#1a1a1a] pb-4 sm:pb-6">
        <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] text-[#1a1a1a] flex items-center justify-center neo-border-sm shrink-0">
          <TbListCheck size={28} strokeWidth={2.2} />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">Riwayat Tugas</h1>
          <p className="text-[#4b607f] font-medium mt-1">
            Daftar seluruh tugas harian asisten laboratorium
            {user?.name ? ` — ${user.name}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="neo-card p-5 sm:p-6 bg-white neo-card-hover transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl bg-[#fcf8f4] flex items-center justify-center neo-border-sm mb-4 shadow-[2px_2px_0px_#1a1a1a] group-hover:bg-[#4b607f] group-hover:text-white transition-colors duration-200">
            <TbClipboardList size={20} strokeWidth={2.2} />
          </div>
          <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider mb-1">Total Tugas</p>
          <p className="text-3xl font-heading font-bold text-[#1a1a1a]">{stats.totalTasks}</p>
        </div>
        <div className="neo-card p-5 sm:p-6 bg-white neo-card-hover transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl bg-[#fcf8f4] flex items-center justify-center neo-border-sm mb-4 shadow-[2px_2px_0px_#1a1a1a] group-hover:bg-[#25D366] group-hover:text-white transition-colors duration-200">
            <TbListCheck size={20} strokeWidth={2.2} />
          </div>
          <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider mb-1">Sudah Diverifikasi</p>
          <p className="text-3xl font-heading font-bold text-[#25D366]">{stats.verifiedCount}</p>
        </div>
        <div className="neo-card p-5 sm:p-6 bg-white neo-card-hover transition-all duration-200 group">
          <div className="w-10 h-10 rounded-xl bg-[#fcf8f4] flex items-center justify-center neo-border-sm mb-4 shadow-[2px_2px_0px_#1a1a1a] group-hover:bg-[#f3701e] group-hover:text-white transition-colors duration-200">
            <TbClockHour4 size={20} strokeWidth={2.2} />
          </div>
          <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider mb-1">Total Jam Kerja</p>
          <p className="text-3xl font-heading font-bold text-[#f3701e]">{stats.totalHours.toFixed(1)} <span className="text-lg">jam</span></p>
        </div>
      </div>

      <div className="neo-card p-5 sm:p-6 bg-[#fcf8f4] space-y-4">
        <div className="flex items-center gap-2 text-[#1a1a1a] border-b-2 border-[#1a1a1a]/10 pb-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center neo-border-sm shadow-[2px_2px_0px_#1a1a1a]">
            <TbFilter size={18} strokeWidth={2.2} />
          </div>
          <h2 className="font-heading text-lg font-bold text-[#1a1a1a]">Filter Riwayat</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">Kategori</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as TaskCategory | "ALL")}
              className="neo-input w-full bg-white cursor-pointer"
            >
              <option value="ALL">Semua Kategori</option>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">Bulan</label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="neo-input w-full bg-white cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#1a1a1a] uppercase tracking-wider">Status Verifikasi</label>
            <select
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value as VerifiedFilter)}
              className="neo-input w-full bg-white cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="VERIFIED">Sudah Diverifikasi</option>
              <option value="UNVERIFIED">Belum Diverifikasi</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="neo-card p-12 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
            <TbLoader2 className="w-10 h-10 animate-spin text-[#f3701e] mx-auto" strokeWidth={2.2} />
            <p className="font-bold text-[#1a1a1a] mt-4">Memuat riwayat tugas...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="neo-border-sm rounded-xl p-12 text-center bg-[#fcf8f4] border-dashed border-2">
            <div className="w-20 h-20 mx-auto rounded-full bg-white neo-border flex items-center justify-center mb-6 shadow-[4px_4px_0px_#1a1a1a]">
              <TbClipboardList size={40} className="text-[#4b607f]/50" strokeWidth={2.2} />
            </div>
            <p className="font-heading text-xl font-bold text-[#1a1a1a]">Tidak ada riwayat tugas</p>
            <p className="text-[#4b607f] font-medium mt-2">Belum ada tugas yang sesuai dengan filter yang dipilih.</p>
          </div>
        ) : (
          <div className="relative before:absolute before:inset-0 before:ml-5 sm:before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-[#1a1a1a] before:opacity-20 space-y-6">
            {filteredTasks.map((task) => {
              const cfg = categoryConfig[task.category] ?? categoryConfig.LAINNYA;
              const Icon = cfg.icon;
              const formattedDate = new Date(task.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              return (
                <div key={task.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] z-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <Icon className="w-5 h-5 text-[#f3701e]" strokeWidth={2.2} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] neo-card p-5 sm:p-6 bg-white hover:shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div>
                            <p className="font-heading font-bold text-lg text-[#1a1a1a]">{task.task}</p>
                            {task.description ? (
                              <p className="text-sm text-[#4b607f] font-medium mt-1 leading-relaxed">{task.description}</p>
                            ) : (
                              <p className="text-sm text-[#4b607f]/60 font-medium mt-1 italic">Tanpa deskripsi</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`neo-badge px-3 py-1.5 rounded-lg text-xs font-bold shadow-[2px_2px_0px_#1a1a1a] shrink-0 self-start ${
                            task.verified ? "bg-[#25D366] text-white" : "bg-[#e8d8c9] text-[#1a1a1a]"
                          }`}
                        >
                          {task.verified ? "VERIFIED" : "UNVERIFIED"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-4 border-t-2 border-[#1a1a1a]/10">
                        <span className={`neo-badge px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#1a1a1a] ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>

                        <span className="neo-badge px-3 py-1.5 rounded-md text-xs font-bold bg-[#fcf8f4] border-[#4b607f] text-[#4b607f] flex items-center gap-1.5 shadow-[2px_2px_0px_#1a1a1a]">
                          <TbClockHour4 size={16} strokeWidth={2.2} />
                          {task.duration ?? 0} menit
                        </span>

                        <span className="neo-badge px-3 py-1.5 rounded-md text-xs font-bold bg-[#fcf8f4] border-[#f3701e] text-[#f3701e] flex items-center gap-1.5 shadow-[2px_2px_0px_#1a1a1a]">
                          <TbMapPin size={16} strokeWidth={2.2} />
                          {task.lab?.name || task.labId || "Lab"}
                        </span>

                        <span className="neo-badge px-3 py-1.5 rounded-md text-xs font-bold bg-[#e8d8c9] text-[#1a1a1a] flex items-center gap-1.5 shadow-[2px_2px_0px_#1a1a1a] ml-auto">
                          <TbCalendar size={16} strokeWidth={2.2} />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="neo-card p-4 bg-[#e8d8c9] border-[#1a1a1a] text-sm font-bold text-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[2px_2px_0px_#1a1a1a]">
        <div className="flex items-center gap-2">
          <TbListCheck size={20} className="text-[#f3701e]" strokeWidth={2.2} />
          <span>Menampilkan <span className="text-[#f3701e] text-base">{filteredTasks.length}</span> tugas</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#25D366]"></div> Verified: {stats.verifiedCount}</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1a1a1a]/40"></div> Unverified: {stats.totalTasks - stats.verifiedCount}</span>
        </div>
      </div>
    </div>
  );
}
