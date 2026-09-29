"use client";

import { useEffect, useMemo, useState } from "react";
import { TbChartBar, TbMessageCircle, TbRefresh, TbThumbDown, TbThumbUp } from "react-icons/tb";
import api from "@/services/api";

interface DailyMetrics { date: string; metrics: Record<string, number>; }

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${date}T00:00:00+07:00`));
}

export default function AiQualityPage() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { const res = await api.get<{ data: DailyMetrics[] }>(`/ai/admin/metrics?days=${days}`); setRows(res.data); }
    catch (err) { setError(err instanceof Error ? err.message : "Metrik AI belum dapat dimuat"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => rows.reduce((acc, row) => {
    acc.total += row.metrics["chat.total"] || 0;
    acc.up += row.metrics["feedback.UP"] || 0;
    acc.down += row.metrics["feedback.DOWN"] || 0;
    acc.latency += row.metrics["latency.sum_ms"] || 0;
    acc.latencyCount += row.metrics["latency.count"] || 0;
    return acc;
  }, { total: 0, up: 0, down: 0, latency: 0, latencyCount: 0 }), [rows]);
  const rated = summary.up + summary.down;
  const helpfulRate = rated ? Math.round(summary.up / rated * 100) : 0;
  const feedbackCoverage = summary.total ? Math.round(rated / summary.total * 100) : 0;
  const averageLatency = summary.latencyCount ? Math.round(summary.latency / summary.latencyCount) : 0;

  const cards = [
    { label: "Total pertanyaan", value: summary.total.toLocaleString("id-ID"), icon: TbMessageCircle, color: "bg-blue-50" },
    { label: "Jawaban membantu", value: rated ? `${helpfulRate}%` : "Belum dinilai", icon: TbThumbUp, color: "bg-green-50" },
    { label: "Perlu diperbaiki", value: summary.down.toLocaleString("id-ID"), icon: TbThumbDown, color: "bg-red-50" },
    { label: "Rata-rata respons", value: averageLatency ? `${(averageLatency / 1000).toFixed(1)} dtk` : "—", icon: TbChartBar, color: "bg-orange-50" },
  ];

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="font-heading text-2xl font-bold sm:text-3xl">Kualitas AI Assistant</h1><p className="mt-1 text-sm text-[#4b607f]">Metrik anonim untuk mengevaluasi akurasi dan pengalaman pengguna.</p></div>
      <div className="flex gap-2" aria-label="Rentang metrik">{[7,30,90].map((value) => <button key={value} onClick={() => setDays(value)} className={`min-h-11 rounded-lg border-2 border-[#1a1a1a] px-4 text-sm font-bold ${days === value ? "bg-[#4b607f] text-white" : "bg-white"}`}>{value} hari</button>)}</div>
    </div>

    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-4"><span>{error}</span><button onClick={() => void load()} className="flex min-h-11 items-center gap-2 font-bold"><TbRefresh /> Coba lagi</button></div>}
    {loading ? <div role="status" className="neo-card p-8 text-center">Memuat metrik AI…</div> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(({label,value,icon:Icon,color}) => <div key={label} className={`neo-card p-4 ${color}`}><Icon className="mb-3 h-6 w-6" /><p className="text-xs font-semibold text-[#4b607f] sm:text-sm">{label}</p><p className="mt-1 break-words font-heading text-xl font-bold sm:text-2xl">{value}</p></div>)}</div>
      <div className="neo-card p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-heading text-lg font-bold">Aktivitas harian</h2><p className="text-xs text-[#4b607f]">Feedback tercatat pada jawaban yang dinilai pengguna.</p></div><span className="rounded-full bg-[#f5ede6] px-3 py-1 text-xs font-bold">Cakupan feedback {feedbackCoverage}%</span></div>
        {rows.every((row) => !(row.metrics["chat.total"] || 0)) ? <div className="py-10 text-center text-[#4b607f]">Belum ada penggunaan AI pada rentang ini.</div> : <div className="space-y-2">{rows.slice().reverse().map((row) => <div key={row.date} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm"><span className="font-semibold">{formatDate(row.date)}</span><span title="Pertanyaan">💬 {row.metrics["chat.total"] || 0}</span><span className="text-green-700" title="Membantu">👍 {row.metrics["feedback.UP"] || 0}</span><span className="text-red-700" title="Tidak membantu">👎 {row.metrics["feedback.DOWN"] || 0}</span></div>)}</div>}
      </div>
      <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900"><strong>Privasi:</strong> halaman ini hanya menampilkan agregat. Isi pertanyaan, jawaban, nama, email, dan identitas pengguna tidak disimpan dalam metrik.</div>
    </>}
  </div>;
}
