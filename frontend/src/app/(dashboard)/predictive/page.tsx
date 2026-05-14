"use client";

import { useState, useEffect } from "react";
import {
  TbShieldCheck,
  TbAlertTriangle,
  TbAlertCircle,
  TbCircleCheck,
  TbLoader2,
  TbCalendarEvent,
  TbTrendingUp,
  TbTrendingDown,
  TbMinus,
  TbHeartbeat,
  TbDeviceDesktop,
} from "react-icons/tb";
import api from "@/services/api";
import { MobileCard } from "@/components/ui/mobile-card";

interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  detail: string;
}

interface PCRisk {
  pcId: string;
  pcCode: string;
  pcName: string;
  labName: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: RiskFactor[];
  prediction: string;
  recommendedAction: string;
  estimatedFailureDays: number | null;
}

interface MaintenanceItem {
  pcId: string;
  pcCode: string;
  labName: string;
  priority: string;
  reason: string;
  suggestedDate: string;
  estimatedDuration: number;
}

interface TrendData {
  period: string;
  totalTickets: number;
  trend: string;
  percentChange: number;
  topCategories: { category: string; count: number }[];
  hotspots: { labName: string; count: number }[];
}

interface HealthData {
  score: number;
  level: string;
  summary: string;
  metrics: Record<string, number>;
}

export default function PredictivePage() {
  const [tab, setTab] = useState<"risk" | "schedule" | "trends" | "health">("health");
  const [riskScores, setRiskScores] = useState<PCRisk[]>([]);
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<MaintenanceItem[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPC, setSelectedPC] = useState<PCRisk | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (tab) {
        case "health": {
          const res = await api.get<{ data: HealthData }>("/ai/predictive/health");
          setHealth(res.data);
          break;
        }
        case "risk": {
          const res = await api.get<{ data: PCRisk[] }>("/ai/predictive/risk-scores");
          setRiskScores(res.data);
          break;
        }
        case "schedule": {
          const res = await api.get<{ data: MaintenanceItem[] }>("/ai/predictive/maintenance-schedule");
          setMaintenanceSchedule(res.data);
          break;
        }
        case "trends": {
          const res = await api.get<{ data: TrendData[] }>("/ai/predictive/trends?months=3");
          setTrends(res.data);
          break;
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [tab]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "CRITICAL": return "bg-[#ef4444] text-white"; // Red
      case "HIGH": return "bg-[#f3701e] text-white"; // Orange
      case "MEDIUM": return "bg-[#eab308] text-[#1a1a1a]"; // Yellow
      default: return "bg-[#22c55e] text-white"; // Green
    }
  };

  const getRiskBorder = (level: string) => {
    switch (level) {
      case "CRITICAL": return "border-[#ef4444]";
      case "HIGH": return "border-[#f3701e]";
      case "MEDIUM": return "border-[#eab308]";
      default: return "border-[#22c55e]";
    }
  };

  const getHealthColor = (level: string) => {
    switch (level) {
      case "EXCELLENT": return "#22c55e";
      case "GOOD": return "#4b607f";
      case "FAIR": return "#eab308";
      default: return "#ef4444";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "INCREASING": return <TbTrendingUp className="w-5 h-5 text-red-500" />;
      case "DECREASING": return <TbTrendingDown className="w-5 h-5 text-green-500" />;
      default: return <TbMinus className="w-5 h-5 text-[#4b607f]" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1a1a1a] tracking-tight">
          Predictive Maintenance
        </h1>
        <p className="text-[#4b607f] mt-1">
          Analisis risiko kerusakan & rekomendasi maintenance preventif
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {[
          { key: "health", label: "Lab Health", icon: TbHeartbeat },
          { key: "risk", label: "Risk Scores", icon: TbAlertTriangle },
          { key: "schedule", label: "Maintenance Schedule", icon: TbCalendarEvent },
          { key: "trends", label: "Trend Analysis", icon: TbTrendingUp },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`neo-btn flex items-center gap-2 px-5 py-2.5 transition-all duration-200 ${
              tab === t.key 
                ? "bg-[#4b607f] text-white shadow-[4px_4px_0px_#1a1a1a] translate-y-[-2px]" 
                : "bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] hover:shadow-[2px_2px_0px_#1a1a1a] hover:translate-y-[-1px]"
            }`}
          >
            <t.icon className="w-5 h-5" />
            <span className="font-bold">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <TbLoader2 className="w-12 h-12 animate-spin text-[#f3701e]" />
            <span className="font-bold font-heading text-[#4b607f]">Memuat Data Prediktif...</span>
          </div>
        </div>
      ) : (
        <>
          {tab === "health" && health && (
            <div className="space-y-6">
              <div className="neo-card p-8 text-center bg-white neo-card-hover transition-all duration-200">
                <div
                  className="w-40 h-40 rounded-full mx-auto flex items-center justify-center neo-border mb-6 shadow-[4px_4px_0px_#1a1a1a]"
                  style={{ backgroundColor: `${getHealthColor(health.level)}20` }}
                >
                  <span
                    className="text-6xl font-bold font-heading drop-shadow-sm"
                    style={{ color: getHealthColor(health.level) }}
                  >
                    {health.score}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-heading mb-2 tracking-tight">{health.level}</h2>
                <p className="text-[#4b607f] text-lg max-w-2xl mx-auto">{health.summary}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                <div className="neo-card p-4 sm:p-6 text-center hover:bg-[#e8d8c9]/30 transition-colors neo-card-hover">
                  <TbDeviceDesktop className="w-10 h-10 mx-auto text-[#4b607f] mb-3" />
                  <div className="text-3xl sm:text-4xl font-bold font-heading mb-1">{health.metrics.totalPCs}</div>
                  <div className="text-sm font-bold text-[#4b607f]">Total PC</div>
                </div>
                <div className="neo-card p-4 sm:p-6 text-center hover:bg-[#e8d8c9]/30 transition-colors neo-card-hover">
                  <TbCircleCheck className="w-10 h-10 mx-auto text-green-500 mb-3" />
                  <div className="text-3xl sm:text-4xl font-bold font-heading text-green-600 mb-1">{health.metrics.healthyPCs}</div>
                  <div className="text-sm font-bold text-[#4b607f]">Healthy</div>
                </div>
                <div className="neo-card p-4 sm:p-6 text-center hover:bg-[#e8d8c9]/30 transition-colors neo-card-hover">
                  <TbAlertCircle className="w-10 h-10 mx-auto text-red-500 mb-3" />
                  <div className="text-3xl sm:text-4xl font-bold font-heading text-red-600 mb-1">{health.metrics.brokenPCs}</div>
                  <div className="text-sm font-bold text-[#4b607f]">Broken</div>
                </div>
                <div className="neo-card p-4 sm:p-6 text-center hover:bg-[#e8d8c9]/30 transition-colors neo-card-hover">
                  <TbAlertTriangle className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
                  <div className="text-3xl sm:text-4xl font-bold font-heading text-yellow-600 mb-1">{health.metrics.openTickets}</div>
                  <div className="text-sm font-bold text-[#4b607f]">Open Tickets</div>
                </div>
              </div>
            </div>
          )}

          {tab === "risk" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
                  const count = riskScores.filter((r) => r.riskLevel === level).length;
                  return (
                    <div key={level} className="neo-card p-5 text-center bg-white neo-card-hover transition-all duration-200">
                      <div className={`inline-block px-3 py-1.5 rounded-md text-sm font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${getRiskColor(level)}`}>
                        {level}
                      </div>
                      <div className="text-3xl sm:text-4xl font-bold font-heading mt-4">{count}</div>
                    </div>
                  );
                })}
              </div>

              {riskScores.map((pc) => (
                <div
                  key={pc.pcId}
                  className={`neo-card p-5 border-l-8 cursor-pointer hover:translate-x-2 transition-transform duration-200 bg-white shadow-[4px_4px_0px_#1a1a1a] ${getRiskBorder(pc.riskLevel)}`}
                  onClick={() => setSelectedPC(selectedPC?.pcId === pc.pcId ? null : pc)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold font-heading text-xl">{pc.pcCode}</span>
                        <span className={`px-3 py-1 rounded-md text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${getRiskColor(pc.riskLevel)}`}>
                          {pc.riskLevel}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[#4b607f]">{pc.labName} • {pc.pcName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl sm:text-3xl font-bold font-heading">{pc.riskScore}</div>
                      <div className="text-xs font-bold text-[#4b607f] uppercase tracking-wider">Risk Score</div>
                    </div>
                  </div>

                  {selectedPC?.pcId === pc.pcId && (
                    <div className="mt-5 pt-5 border-t-2 border-[#1a1a1a]/10 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <div className="bg-[#f5ede6] p-4 rounded-lg neo-border-sm">
                        <div className="text-sm font-bold font-heading mb-1 text-[#1a1a1a]">Prediksi:</div>
                        <p className="text-sm text-[#4b607f]">{pc.prediction}</p>
                      </div>
                      <div className="bg-[#fff8f0] p-4 rounded-lg neo-border-sm border-[#f3701e]/30">
                        <div className="text-sm font-bold font-heading mb-1 text-[#1a1a1a]">Rekomendasi:</div>
                        <p className="text-sm font-medium text-[#f3701e]">{pc.recommendedAction}</p>
                      </div>
                      {pc.estimatedFailureDays && (
                        <div className="flex items-center gap-2 text-sm bg-red-50 p-3 rounded-lg neo-border-sm border-red-200">
                          <TbAlertTriangle className="text-red-600 w-5 h-5" />
                          <span className="font-bold">Estimasi kegagalan:</span>{" "}
                          <span className="text-red-600 font-bold">{pc.estimatedFailureDays} hari</span>
                        </div>
                      )}
                      <div className="pt-2">
                        <div className="text-sm font-bold font-heading mb-3 text-[#1a1a1a]">Faktor Risiko:</div>
                        <div className="space-y-4">
                          {pc.factors.map((f, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-[#1a1a1a]/10">
                              <div className="flex justify-between text-sm font-bold mb-2">
                                <span>{f.name}</span>
                                <span className="text-[#4b607f]">{f.score}/100 <span className="text-xs font-normal">(weight: {f.weight})</span></span>
                              </div>
                              <div className="w-full h-2.5 bg-[#e8d8c9] rounded-full neo-border-sm overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500 ease-out"
                                  style={{
                                    width: `${f.score}%`,
                                    backgroundColor: f.score > 70 ? "#ef4444" : f.score > 40 ? "#f3701e" : "#22c55e",
                                  }}
                                />
                              </div>
                              <div className="text-xs text-[#4b607f] mt-2">{f.detail}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {riskScores.length === 0 && (
                <div className="neo-card p-12 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
                  <TbShieldCheck className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="font-heading font-bold text-xl mb-2">Semua Aman!</h3>
                  <p className="text-[#4b607f]">Semua PC dalam kondisi baik dan tidak memiliki risiko kerusakan tinggi.</p>
                </div>
              )}
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-6">
              {maintenanceSchedule.length > 0 ? (
                <>
                  <div className="md:hidden space-y-3">
                    {maintenanceSchedule.map((item, i) => (
                      <MobileCard
                        key={i}
                        title={item.pcCode}
                        subtitle={item.labName}
                        badge={
                          <span className={`px-3 py-1 rounded-md text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${
                            item.priority === "URGENT" ? "bg-red-500 text-white" :
                            item.priority === "HIGH" ? "bg-orange-500 text-white" :
                            item.priority === "NORMAL" ? "bg-yellow-400 text-[#1a1a1a]" :
                            "bg-green-500 text-white"
                          }`}>
                            {item.priority}
                          </span>
                        }
                        fields={[
                          {
                            label: "Tanggal",
                            value: new Date(item.suggestedDate).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }),
                          },
                          { label: "Durasi", value: `${item.estimatedDuration} mnt` },
                          { label: "Alasan", value: item.reason, fullWidth: true },
                        ]}
                      />
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto neo-card p-0 shadow-[4px_4px_0px_#1a1a1a] bg-white">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#4b607f] text-white border-b-2 border-[#1a1a1a]">
                          <th className="p-4 text-left font-heading font-bold text-sm">PC</th>
                          <th className="p-4 text-left font-heading font-bold text-sm">Lab</th>
                          <th className="p-4 text-left font-heading font-bold text-sm">Priority</th>
                          <th className="p-4 text-left font-heading font-bold text-sm">Tanggal</th>
                          <th className="p-4 text-left font-heading font-bold text-sm">Durasi</th>
                          <th className="p-4 text-left font-heading font-bold text-sm">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-[#1a1a1a]/10">
                        {maintenanceSchedule.map((item, i) => (
                          <tr key={i} className="hover:bg-[#f5ede6] transition-colors duration-150">
                            <td className="p-4 font-bold font-heading">{item.pcCode}</td>
                            <td className="p-4 text-sm font-medium">{item.labName}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-md text-xs font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${
                                item.priority === "URGENT" ? "bg-red-500 text-white" :
                                item.priority === "HIGH" ? "bg-orange-500 text-white" :
                                item.priority === "NORMAL" ? "bg-yellow-400 text-[#1a1a1a]" :
                                "bg-green-500 text-white"
                              }`}>
                                {item.priority}
                              </span>
                            </td>
                            <td className="p-4 text-sm font-medium whitespace-nowrap">
                              {new Date(item.suggestedDate).toLocaleDateString("id-ID", {
                                weekday: "short", day: "numeric", month: "short",
                              })}
                            </td>
                            <td className="p-4 text-sm font-medium">{item.estimatedDuration} mnt</td>
                            <td className="p-4 text-sm text-[#4b607f] max-w-xs">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="neo-card p-12 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
                  <TbCalendarEvent className="w-16 h-16 mx-auto text-[#4b607f] mb-4" />
                  <h3 className="font-heading font-bold text-xl mb-2">Jadwal Bersih</h3>
                  <p className="text-[#4b607f]">Tidak ada maintenance yang perlu dijadwalkan dalam waktu dekat.</p>
                </div>
              )}
            </div>
          )}

          {tab === "trends" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {trends.map((t, i) => (
                <div key={i} className="neo-card p-4 sm:p-6 bg-white shadow-[4px_4px_0px_#1a1a1a] neo-card-hover hover:-translate-y-1 transition-all duration-200">
                  <div className="flex items-center justify-between mb-4 border-b-2 border-[#1a1a1a]/10 pb-4">
                    <h3 className="font-bold font-heading text-xl">{t.period}</h3>
                    <div className="flex items-center gap-2 bg-[#f5ede6] px-3 py-1.5 rounded-lg border-2 border-[#1a1a1a]">
                      {getTrendIcon(t.trend)}
                      <span className={`text-sm font-bold ${
                        t.percentChange > 0 ? "text-red-600" : t.percentChange < 0 ? "text-green-600" : "text-[#4b607f]"
                      }`}>
                        {t.percentChange > 0 ? "+" : ""}{t.percentChange}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-5">
                    <div>
                      <div className="text-sm font-bold text-[#4b607f] uppercase tracking-wide mb-1">Total Tiket</div>
                      <div className="text-2xl sm:text-3xl font-bold font-heading">{t.totalTickets}</div>
                    </div>
                    <div className="text-sm font-medium text-[#4b607f] bg-[#e8d8c9] px-3 py-1 rounded-full border-2 border-[#1a1a1a]">
                      Trend: <span className="font-bold text-[#1a1a1a]">{t.trend}</span>
                    </div>
                  </div>
                  {t.topCategories.length > 0 && (
                    <div className="bg-[#f5ede6] p-4 rounded-lg neo-border-sm">
                      <div className="text-sm font-bold font-heading mb-3 text-[#1a1a1a]">Top Kategori Kerusakan:</div>
                      <div className="flex flex-wrap gap-2">
                        {t.topCategories.map((c, j) => (
                          <span key={j} className="text-xs font-bold px-3 py-1.5 bg-white rounded-md border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                            {c.category}: <span className="text-[#f3701e]">{c.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {trends.length === 0 && (
                <div className="col-span-full neo-card p-12 text-center bg-white shadow-[4px_4px_0px_#1a1a1a]">
                  <TbTrendingUp className="w-16 h-16 mx-auto text-[#4b607f] mb-4" />
                  <h3 className="font-heading font-bold text-xl mb-2">Belum Ada Data</h3>
                  <p className="text-[#4b607f]">Data tren akan muncul setelah ada cukup laporan tiket kerusakan.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
