"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TbFileSpreadsheet, TbFileTypePdf, TbLoader2, TbChartBar, TbChartPie, TbTrendingUp } from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import dynamic from "next/dynamic";

type ReportResponse = {
  summary?: ReportData;
  labUsage?: ReportData["labUsage"];
  ticketsByCategory?: ReportData["ticketsByCategory"];
  topAssistants?: ReportData["topAssistants"];
};

const RechartsCharts = dynamic(() => import("./charts"), { ssr: false });

interface ReportData {
  logbooks: { total: number; completed: number };
  tickets: { total: number; resolved: number };
  attendance: { total: number; late: number };
  missions: { total: number; approved: number };
  labUsage: { labName: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
  topAssistants: { name: string; points: number }[];
}

const emptyReport: ReportData = {
  logbooks: { total: 0, completed: 0 },
  tickets: { total: 0, resolved: 0 },
  attendance: { total: 0, late: 0 },
  missions: { total: 0, approved: 0 },
  labUsage: [],
  ticketsByCategory: [],
  topAssistants: [],
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full h-3 rounded-full bg-[#f5ede6] neo-border-sm overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

export default function ReportsPage() {
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [report, setReport] = useState<ReportData>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "charts">("charts");

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ReportResponse }>(`/reports/monthly?month=${selectedMonth}`);
      if (res.data) {
        setReport({
          logbooks: res.data.summary?.logbooks || emptyReport.logbooks,
          tickets: res.data.summary?.tickets || emptyReport.tickets,
          attendance: res.data.summary?.attendance || emptyReport.attendance,
          missions: res.data.summary?.missions || emptyReport.missions,
          labUsage: res.data.labUsage || [],
          ticketsByCategory: res.data.ticketsByCategory || [],
          topAssistants: res.data.topAssistants || [],
        });
      }
    } catch {
      setReport(emptyReport);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchReport();
    });
  }, [selectedMonth]);

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format);
    try {
      const endpoint = format === "pdf" ? "/export/report/pdf" : "/export/report/excel";
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

      const response = await fetch(`${baseUrl}${endpoint}?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${selectedMonth}.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal export. Pastikan Anda memiliki akses.");
    } finally {
      setExporting(null);
    }
  };

  const safePercent = (val: number, total: number) => total > 0 ? Math.round((val / total) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Laporan Bulanan</h1>
          <p className="text-[#4b607f] mt-1 text-sm sm:text-base leading-relaxed">Statistik penggunaan lab & performa asisten</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-[#f5ede6] p-1.5 rounded-xl border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] w-full sm:w-auto">
            <button
              onClick={() => setViewMode("charts")}
              className={`flex-1 sm:flex-initial px-4 min-h-[44px] text-sm font-bold flex items-center justify-center gap-2 rounded-lg transition-all ${
                viewMode === "charts" 
                  ? "bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a]" 
                  : "bg-transparent text-[#1a1a1a] hover:bg-white"
              }`}
            >
              <TbChartBar strokeWidth={2.2} className="w-4 h-4" /> Chart
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`flex-1 sm:flex-initial px-4 min-h-[44px] text-sm font-bold flex items-center justify-center gap-2 rounded-lg transition-all ${
                viewMode === "cards" 
                  ? "bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a]" 
                  : "bg-transparent text-[#1a1a1a] hover:bg-white"
              }`}
            >
              <TbTrendingUp strokeWidth={2.2} className="w-4 h-4" /> Cards
            </button>
          </div>
          
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full sm:w-auto px-4 min-h-[44px] bg-white border-2 border-[#1a1a1a] rounded-xl shadow-[2px_2px_0px_#1a1a1a] font-bold text-[#1a1a1a] focus:outline-none focus:shadow-[4px_4px_0px_#1a1a1a] transition-all cursor-pointer"
          />
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting === "pdf"}
              className="neo-btn flex-1 sm:flex-initial px-4 min-h-[44px] bg-[#4b607f] text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              {exporting === "pdf" ? <TbLoader2 className="w-5 h-5 animate-spin" /> : <TbFileTypePdf strokeWidth={2.2} className="w-5 h-5 text-white" />}
              <span>PDF</span>
            </button>
            <button
              onClick={() => handleExport("excel")}
              disabled={exporting === "excel"}
              className="neo-btn flex-1 sm:flex-initial px-4 min-h-[44px] bg-[#f3701e] text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              {exporting === "excel" ? <TbLoader2 className="w-5 h-5 animate-spin" /> : <TbFileSpreadsheet strokeWidth={2.2} className="w-5 h-5 text-white" />}
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 sm:gap-6 mb-4 sm:mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-4 sm:p-6 bg-white neo-card-hover transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider">LOGBOOK</p>
            <div className="bg-[#4b607f] text-white px-2 py-1 rounded text-[10px] font-bold border border-[#1a1a1a]">
              {safePercent(report.logbooks.completed, report.logbooks.total)}%
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-3xl sm:text-4xl font-bold font-heading text-[#1a1a1a]">{report.logbooks.completed}</p>
            <p className="text-sm font-bold text-[#4b607f]">/ {report.logbooks.total}</p>
          </div>
          <ProgressBar value={report.logbooks.completed} max={report.logbooks.total} color="bg-[#4b607f]" />
          <p className="text-xs text-[#4b607f] font-medium mt-3">Logbook selesai dikerjakan</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="neo-card p-4 sm:p-6 bg-white neo-card-hover transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider">TICKET</p>
            <div className="bg-green-500 text-white px-2 py-1 rounded text-[10px] font-bold border border-[#1a1a1a]">
              {safePercent(report.tickets.resolved, report.tickets.total)}%
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-3xl sm:text-4xl font-bold font-heading text-[#1a1a1a]">{report.tickets.resolved}</p>
            <p className="text-sm font-bold text-[#4b607f]">/ {report.tickets.total}</p>
          </div>
          <ProgressBar value={report.tickets.resolved} max={report.tickets.total} color="bg-green-500" />
          <p className="text-xs text-[#4b607f] font-medium mt-3">Ticket berhasil diselesaikan</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="neo-card p-4 sm:p-6 bg-white neo-card-hover transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider">ABSENSI</p>
            <div className="bg-[#f3701e] text-white px-2 py-1 rounded text-[10px] font-bold border border-[#1a1a1a]">
              {safePercent(report.attendance.total - report.attendance.late, report.attendance.total)}%
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-3xl sm:text-4xl font-bold font-heading text-[#1a1a1a]">{report.attendance.total - report.attendance.late}</p>
            <p className="text-sm font-bold text-[#4b607f]">/ {report.attendance.total}</p>
          </div>
          <ProgressBar value={report.attendance.total - report.attendance.late} max={report.attendance.total} color="bg-[#f3701e]" />
          <p className="text-xs text-red-600 font-bold mt-3 bg-red-50 inline-block px-2 py-1 rounded border border-red-200">
            {report.attendance.late} keterlambatan
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="neo-card p-4 sm:p-6 bg-white neo-card-hover transition-all hover:-translate-y-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#4b607f] font-bold uppercase tracking-wider">MISI</p>
            <div className="bg-yellow-500 text-white px-2 py-1 rounded text-[10px] font-bold border border-[#1a1a1a]">
              {safePercent(report.missions.approved, report.missions.total)}%
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-3xl sm:text-4xl font-bold font-heading text-[#1a1a1a]">{report.missions.approved}</p>
            <p className="text-sm font-bold text-[#4b607f]">/ {report.missions.total}</p>
          </div>
          <ProgressBar value={report.missions.approved} max={report.missions.total} color="bg-yellow-500" />
          <p className="text-xs text-[#4b607f] font-medium mt-3">Misi yang disetujui</p>
        </motion.div>
      </div>

      {viewMode === "charts" ? (
        <RechartsCharts report={report} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="neo-card p-6 bg-white shadow-[4px_4px_0px_#1a1a1a]">
              <div className="flex items-center gap-3 mb-6 border-b-2 border-[#1a1a1a]/10 pb-4">
                <div className="bg-[#f5ede6] p-2 rounded-lg border-2 border-[#1a1a1a]">
                  <TbChartBar strokeWidth={2.2} className="w-5 h-5 text-[#4b607f]" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Penggunaan Lab</h3>
              </div>
              <div className="space-y-5">
                {report.labUsage.map((lab) => (
                  <div key={lab.labName}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-[#1a1a1a]">{lab.labName}</span>
                      <span className="text-[#4b607f] font-bold bg-[#f5ede6] px-2 py-0.5 rounded border border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a]">{lab.count} sesi</span>
                    </div>
                    <ProgressBar value={lab.count} max={50} color="bg-[#4b607f]" />
                  </div>
                ))}
                {report.labUsage.length === 0 && (
                  <p className="text-center text-[#4b607f] py-4 italic">Belum ada data penggunaan lab</p>
                )}
              </div>
            </div>

            <div className="neo-card p-6 bg-white shadow-[4px_4px_0px_#1a1a1a]">
              <div className="flex items-center gap-3 mb-6 border-b-2 border-[#1a1a1a]/10 pb-4">
                <div className="bg-[#f5ede6] p-2 rounded-lg border-2 border-[#1a1a1a]">
                  <TbChartPie strokeWidth={2.2} className="w-5 h-5 text-[#f3701e]" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Ticket per Kategori</h3>
              </div>
              <div className="space-y-5">
                {report.ticketsByCategory.map((cat) => {
                  const colors: Record<string, string> = {
                    HARDWARE: "bg-red-500",
                    SOFTWARE: "bg-blue-500",
                    JARINGAN: "bg-purple-500",
                    FASILITAS: "bg-green-500",
                  };
                  return (
                    <div key={cat.category}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-[#1a1a1a]">{cat.category}</span>
                        <span className="text-[#4b607f] font-bold bg-[#f5ede6] px-2 py-0.5 rounded border border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a]">{cat.count} ticket</span>
                      </div>
                      <ProgressBar value={cat.count} max={report.tickets.total} color={colors[cat.category] || "bg-[#4b607f]"} />
                    </div>
                  );
                })}
                {report.ticketsByCategory.length === 0 && (
                  <p className="text-center text-[#4b607f] py-4 italic">Belum ada data ticket</p>
                )}
              </div>
            </div>
          </div>

          <div className="neo-card p-6 bg-white shadow-[4px_4px_0px_#1a1a1a]">
            <div className="flex items-center gap-3 mb-6 border-b-2 border-[#1a1a1a]/10 pb-4">
              <div className="bg-[#f5ede6] p-2 rounded-lg border-2 border-[#1a1a1a]">
                <TbTrendingUp strokeWidth={2.2} className="w-5 h-5 text-[#f3701e]" />
              </div>
              <h3 className="font-heading font-bold text-xl text-[#1a1a1a]">Top 5 Asisten Lab</h3>
            </div>
            <div className="space-y-3">
              {report.topAssistants.map((assistant, i) => (
                <motion.div
                  key={assistant.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-white border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] hover:shadow-[4px_4px_0px_#1a1a1a] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${
                      i === 0 ? "bg-[#f3701e] text-white" : 
                      i === 1 ? "bg-gray-300 text-[#1a1a1a]" : 
                      i === 2 ? "bg-[#4b607f] text-white" : 
                      "bg-[#4b607f]"
                    }`}>
                      #{i + 1}
                    </span>
                    <span className="font-bold text-base text-[#1a1a1a]">{assistant.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 hidden sm:block">
                      <ProgressBar value={assistant.points} max={report.topAssistants[0]?.points || 1} color="bg-[#f3701e]" />
                    </div>
                    <span className="text-sm font-bold bg-[#fff8f0] text-[#f3701e] px-3 py-1.5 rounded-lg border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] min-w-[70px] text-center">
                      {assistant.points} pts
                    </span>
                  </div>
                </motion.div>
              ))}
              {report.topAssistants.length === 0 && (
                <p className="text-center text-[#4b607f] py-8 italic">Belum ada data performa asisten</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
