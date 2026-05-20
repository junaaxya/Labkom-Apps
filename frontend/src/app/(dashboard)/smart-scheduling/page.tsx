"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TbClock,
  TbLoader2,
  TbTrendingUp,
  TbUsers,
  TbBulb,
  TbChartBar,
  TbCalendarEvent,
  TbAlertTriangle,
  TbCircleCheck
} from "react-icons/tb";
import api from "@/services/api";

const errMsg = (err: unknown, fallback: string) => {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
};

interface OptimalSlot {
  day: string;
  startTime: string;
  endTime: string;
  labId: string;
  labName: string;
  availabilityScore: number;
  reason: string;
}

interface UsagePattern {
  day: string;
  hour: number;
  usage: number;
  label: string;
}

interface LoadBalance {
  labId: string;
  labName: string;
  totalSlots: number;
  usedSlots: number;
  utilizationPercent: number;
  peakDay: string;
  quietestDay: string;
  recommendation: string;
}

interface Conflict {
  schedule1: {
    title?: string;
    time?: string;
    lab?: string;
    lecturerName?: string;
    assistant?: string;
  };
  schedule2: {
    title?: string;
    time?: string;
    lab?: string;
    lecturerName?: string;
    assistant?: string;
  };
  type: string;
}

interface Workload {
  id: string;
  name: string;
  totalHours: number;
  days: string[];
  balance: string;
}

export default function SmartSchedulingPage() {
  const [tab, setTab] = useState<"suggest" | "patterns" | "balance" | "conflicts" | "workload">("suggest");
  const [slots, setSlots] = useState<OptimalSlot[]>([]);
  const [patterns, setPatterns] = useState<UsagePattern[]>([]);
  const [balance, setBalance] = useState<LoadBalance[]>([]);
  const [conflicts, setConflicts] = useState<{ conflicts: Conflict[]; warnings: string[] }>({ conflicts: [], warnings: [] });
  const [workload, setWorkload] = useState<{ assistants: Workload[]; recommendation: string }>({ assistants: [], recommendation: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(120);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      switch (tab) {
        case "suggest": {
          const res = await api.get<{ data: OptimalSlot[] }>(`/ai/scheduling/suggest?duration=${duration}`);
          setSlots(res.data);
          break;
        }
        case "patterns": {
          const res = await api.get<{ data: UsagePattern[] }>("/ai/scheduling/usage-patterns");
          setPatterns(res.data);
          break;
        }
        case "balance": {
          const res = await api.get<{ data: LoadBalance[] }>("/ai/scheduling/load-balance");
          setBalance(res.data);
          break;
        }
        case "conflicts": {
          const res = await api.get<{ data: { conflicts: Conflict[]; warnings: string[] } }>("/ai/scheduling/conflicts");
          setConflicts(res.data);
          break;
        }
        case "workload": {
          const res = await api.get<{ data: { assistants: Workload[]; recommendation: string } }>("/ai/scheduling/workload");
          setWorkload(res.data);
          break;
        }
      }
    } catch (err) {
      setError(errMsg(err, "Gagal memuat data smart scheduling dari server."));
    } finally {
      setLoading(false);
    }
  }, [tab, duration]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [tab, duration, fetchData]);

  const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

  const getPatternColor = (usage: number) => {
    if (usage === 0) return "bg-[#22c55e] text-white neo-border-sm";
    if (usage === 1) return "bg-[#eab308] text-[#1a1a1a] neo-border-sm";
    if (usage === 2) return "bg-[#f3701e] text-white neo-border-sm";
    return "bg-[#ef4444] text-white neo-border-sm";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1a1a1a] tracking-tight">
          Smart Scheduling
        </h1>
        <p className="text-[#4b607f] mt-1 text-sm sm:text-base leading-relaxed">
          AI-powered jadwal optimal, deteksi konflik, dan load balancing
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[
          { key: "suggest", label: "Suggest Slots", icon: TbBulb },
          { key: "patterns", label: "Usage Heatmap", icon: TbChartBar },
          { key: "balance", label: "Load Balance", icon: TbCalendarEvent },
          { key: "conflicts", label: "Conflicts", icon: TbAlertTriangle },
          { key: "workload", label: "Workload", icon: TbUsers },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`neo-btn flex items-center justify-center gap-2 px-3 sm:px-5 min-h-[44px] transition-all duration-200 ${
              tab === t.key 
                ? "bg-[#4b607f] text-white shadow-[4px_4px_0px_#1a1a1a] translate-y-[-2px]" 
                : "bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] hover:shadow-[2px_2px_0px_#1a1a1a] hover:translate-y-[-1px]"
            }`}
          >
            <t.icon className="w-5 h-5 shrink-0" />
            <span className="font-bold text-xs sm:text-sm truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <TbLoader2 className="w-12 h-12 animate-spin text-[#f3701e]" />
            <span className="font-bold font-heading text-[#4b607f]">Memuat Data Penjadwalan...</span>
          </div>
        </div>
      ) : error ? (
        <div className="neo-card p-6 sm:p-8 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
          <TbAlertTriangle className="w-12 h-12 mx-auto text-[#f3701e] mb-3" />
          <h3 className="font-heading font-bold text-xl text-[#1a1a1a] mb-2">Data real belum bisa dimuat</h3>
          <p className="text-sm text-[#4b607f] mb-4">{error}</p>
          <button type="button" onClick={() => void fetchData()} className="neo-btn bg-[#4b607f] text-white min-h-[44px] px-5">
            Muat Ulang
          </button>
        </div>
      ) : (
        <>
          {tab === "suggest" && (
            <div className="space-y-6">
              <div className="neo-card p-4 sm:p-5 bg-white shadow-[4px_4px_0px_#1a1a1a] space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#f5ede6] p-3 sm:p-2 sm:px-4 rounded-lg border-2 border-[#1a1a1a]">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <TbClock className="w-5 h-5 text-[#f3701e] shrink-0" />
                    <label className="text-sm font-bold font-heading">Durasi (menit):</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="bg-transparent border-none outline-none font-bold text-[#4b607f] cursor-pointer flex-1 sm:flex-initial"
                    >
                      <option value={60}>60</option>
                      <option value={90}>90</option>
                      <option value={120}>120</option>
                      <option value={150}>150</option>
                      <option value={180}>180</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={fetchData} 
                  className="neo-btn bg-[#f3701e] text-white px-6 min-h-[44px] flex items-center justify-center gap-2 hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#1a1a1a] transition-all w-full sm:w-auto"
                >
                  <TbBulb className="w-5 h-5" />
                  <span className="font-bold">Cari Slot Optimal</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {slots.map((slot, i) => (
                  <div key={i} className="neo-card p-6 bg-white neo-card-hover hover:-translate-y-2 hover:shadow-[6px_6px_0px_#1a1a1a] transition-all duration-200">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#1a1a1a]/10">
                      <div className="flex items-center gap-2 bg-[#f5ede6] px-3 py-1.5 rounded-md border-2 border-[#1a1a1a]">
                        <TbCalendarEvent className="w-4 h-4 text-[#f3701e]" />
                        <span className="font-bold font-heading text-sm">{slot.day}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-md border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor: slot.availabilityScore >= 80 ? "#22c55e" :
                              slot.availabilityScore >= 60 ? "#4b607f" : "#eab308",
                          }}
                        />
                        <span className="text-xs font-bold">{slot.availabilityScore}% Score</span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-heading mb-1 text-[#4b607f]">
                      {slot.startTime} <span className="text-[#1a1a1a] opacity-50 font-normal">—</span> {slot.endTime}
                    </div>
                    <div className="text-sm font-bold text-[#1a1a1a] mb-3">{slot.labName}</div>
                    <div className="text-sm text-[#4b607f] bg-[#fff8f0] p-3 rounded-lg border border-[#f3701e]/30 font-medium">
                      {slot.reason}
                    </div>
                  </div>
                ))}
              </div>

              {slots.length === 0 && (
                <div className="neo-card p-12 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
                  <TbCalendarEvent className="w-16 h-16 mx-auto text-[#4b607f] mb-4" />
                  <h3 className="font-heading font-bold text-xl mb-2">Tidak Ada Slot</h3>
                  <p className="text-[#4b607f]">Tidak ada slot real yang bebas untuk durasi {duration} menit. Coba kurangi durasi atau cek jadwal aktif di database.</p>
                </div>
              )}
            </div>
          )}

          {tab === "patterns" && (
            <div className="neo-card p-6 bg-white overflow-x-auto shadow-[4px_4px_0px_#1a1a1a]">
              <h3 className="font-bold font-heading text-xl mb-6">Usage Heatmap</h3>
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-2">
                  <div />
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-sm font-bold font-heading p-2 bg-[#e8d8c9] neo-border-sm">{d.slice(0, 3)}</div>
                  ))}
                  {HOURS.map((hour) => (
                    <>
                      <div key={`h-${hour}`} className="text-sm font-bold font-heading text-right pr-4 py-2 flex items-center justify-end">
                        {String(hour).padStart(2, "0")}:00
                      </div>
                      {DAYS.map((day) => {
                        const pattern = patterns.find((p) => p.day === day && p.hour === hour);
                        return (
                          <div
                            key={`${day}-${hour}`}
                            className={`flex items-center justify-center font-bold text-xs py-1.5 ${getPatternColor(pattern?.usage || 0)}`}
                            title={`${day} ${hour}:00 — ${pattern?.label || "Kosong"} (${pattern?.usage || 0} jadwal)`}
                          >
                            {pattern?.usage || ""}
                          </div>
                        );
                      })}
                    </>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-6 text-xs font-bold">
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-[#22c55e] neo-border-sm" /> Kosong</div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-[#eab308] neo-border-sm" /> 1 Jadwal</div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-[#f3701e] neo-border-sm" /> 2 Jadwal</div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 bg-[#ef4444] neo-border-sm" /> 3+ Jadwal</div>
                </div>
              </div>
            </div>
          )}

          {tab === "balance" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {balance.map((lab) => (
                <div key={lab.labId} className="neo-card p-6 bg-white shadow-[4px_4px_0px_#1a1a1a] neo-card-hover hover:-translate-y-1 transition-all duration-200">
                  <div className="flex items-center justify-between mb-5 border-b-2 border-[#1a1a1a]/10 pb-4">
                    <h3 className="font-bold font-heading text-xl">{lab.labName}</h3>
                    <div className="flex items-center gap-2 bg-[#f5ede6] px-3 py-1.5 rounded-lg border-2 border-[#1a1a1a]">
                      <span className="text-sm font-bold text-[#4b607f]">Utilisasi</span>
                      <span className="text-lg font-bold text-[#f3701e]">{lab.utilizationPercent}%</span>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-[#1a1a1a]">Kapasitas Terpakai</span>
                      <span className="text-[#4b607f]">{lab.usedSlots} / {lab.totalSlots} Slot</span>
                    </div>
                    <div className="w-full h-3 bg-[#e8d8c9] rounded-full neo-border-sm overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${lab.utilizationPercent}%`,
                          backgroundColor: lab.utilizationPercent > 80 ? "#ef4444" :
                            lab.utilizationPercent > 60 ? "#f3701e" : "#22c55e",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5">
                    <div className="bg-[#f5ede6] p-3 rounded-lg border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                      <div className="text-xs font-bold text-[#4b607f] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TbTrendingUp className="w-3.5 h-3.5" /> Hari Tersibuk
                      </div>
                      <div className="font-bold font-heading text-lg">{lab.peakDay}</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                      <div className="text-xs font-bold text-[#4b607f] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TbClock className="w-3.5 h-3.5" /> Hari Paling Sepi
                      </div>
                      <div className="font-bold font-heading text-lg">{lab.quietestDay}</div>
                    </div>
                  </div>
                  
                  <div className="bg-[#fff8f0] p-4 rounded-lg border border-[#f3701e]/30 flex gap-3 items-start">
                    <TbBulb className="w-5 h-5 text-[#f3701e] flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-[#4b607f]">{lab.recommendation}</p>
                  </div>
                </div>
              ))}
              
              {balance.length === 0 && (
                <div className="col-span-full neo-card p-12 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
                  <TbChartBar className="w-16 h-16 mx-auto text-[#4b607f] mb-4" />
                  <h3 className="font-heading font-bold text-xl mb-2">Belum Ada Data Load Balance</h3>
                  <p className="text-[#4b607f]">Data distribusi beban lab belum tersedia saat ini.</p>
                </div>
              )}
            </div>
          )}

          {tab === "conflicts" && (
            <div className="space-y-4">
              {conflicts.conflicts.length > 0 ? (
                conflicts.conflicts.map((c, i) => (
                  <div key={i} className="neo-card p-4 border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-2">
                      <TbAlertTriangle className="w-5 h-5 text-red-500" />
                      <span className="font-bold text-sm">
                        {c.type === "LAB_CONFLICT" ? "Konflik Lab" :
                         c.type === "LECTURER_CONFLICT" ? "Konflik Dosen" : "Konflik Asisten"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                      <div className="bg-red-50 p-2 rounded">
                        <div className="font-bold">{c.schedule1.title}</div>
                        <div className="text-[#4b607f]">{c.schedule1.time} • {c.schedule1.lab || c.schedule1.lecturerName || c.schedule1.assistant}</div>
                      </div>
                      <div className="bg-red-50 p-2 rounded">
                        <div className="font-bold">{c.schedule2.title}</div>
                        <div className="text-[#4b607f]">{c.schedule2.time} • {c.schedule2.lab || c.schedule2.lecturerName || c.schedule2.assistant}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="neo-card p-8 text-center">
                  <TbCircleCheck className="w-12 h-12 mx-auto text-green-500 mb-3" />
                  <p className="font-bold">Tidak ada konflik jadwal!</p>
                  <p className="text-sm text-[#4b607f]">Semua jadwal berjalan tanpa tumpang tindih</p>
                </div>
              )}

              {conflicts.warnings.length > 0 && (
                <div className="neo-card p-4 bg-[#fff8f0]">
                  <h4 className="font-bold mb-2">Peringatan:</h4>
                  {conflicts.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-[#4b607f] mb-1">
                      <TbAlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "workload" && (
            <div className="space-y-6">
              {workload.recommendation && (
                <div className="neo-card p-5 bg-[#fff8f0] border-[#f3701e] shadow-[4px_4px_0px_#1a1a1a]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-[#f3701e] p-2 rounded-lg text-white">
                      <TbBulb className="w-5 h-5" />
                    </div>
                    <span className="font-bold font-heading text-lg text-[#1a1a1a]">Rekomendasi Distribusi Tugas</span>
                  </div>
                  <p className="text-base text-[#4b607f] font-medium leading-relaxed">{workload.recommendation}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workload.assistants.map((a) => (
                  <div key={a.id} className="neo-card p-5 bg-white neo-card-hover hover:-translate-y-1 transition-all duration-200">
                    <div className="flex items-center justify-between mb-4 border-b-2 border-[#1a1a1a]/10 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#e8d8c9] border-2 border-[#1a1a1a] flex items-center justify-center font-bold text-[#1a1a1a]">
                          {a.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold font-heading text-lg leading-tight">{a.name}</div>
                          <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-bold border border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a] ${
                            a.balance === "OVERLOADED" ? "bg-red-500 text-white" :
                            a.balance === "UNDERUTILIZED" ? "bg-yellow-400 text-[#1a1a1a]" :
                            "bg-green-500 text-white"
                          }`}>
                            {a.balance}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold font-heading text-[#4b607f]">{a.totalHours}</div>
                        <div className="text-xs font-bold text-[#1a1a1a] uppercase">Jam / Minggu</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs font-bold text-[#4b607f] uppercase mb-2">Hari Bertugas</div>
                      <div className="flex flex-wrap gap-2">
                        {a.days.map((d) => (
                          <span key={d} className="text-xs font-bold px-3 py-1.5 bg-[#f5ede6] rounded-md border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                            {d.slice(0, 3)}
                          </span>
                        ))}
                        {a.days.length === 0 && (
                          <span className="text-xs italic text-[#4b607f]">Belum ada jadwal</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
