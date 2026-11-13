"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/services/api";

type Process = { pid: number; processName?: string; name?: string; windowTitle?: string; cpuPercent?: number; ramMb?: number };
type ProcessData = { capturedAt: string; processes: Process[]; expiresAt: string };
type Snapshot = { capturedAt: string; mimeType: string; width: number; height: number; sizeBytes: number; imageBase64: string; expiresAt: string };
type Kind = "webcam" | "screen";

export function LiveInspector({ pcId, pcCode, online }: { pcId: string; pcCode: string; online: boolean }) {
  const [tab, setTab] = useState<"processes" | "media">("processes");
  const [processes, setProcesses] = useState<ProcessData | null>(null);
  const [snapshots, setSnapshots] = useState<Record<Kind, Snapshot | null>>({ webcam: null, screen: null });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api.get<{ data: ProcessData | null }>(`/pcs/${pcId}/processes`),
      ...(["webcam", "screen"] as const).map((kind) => api.get<{ data: Snapshot | null }>(`/pcs/${pcId}/media-snapshot?kind=${kind}`)),
    ]).then(([list, webcam, screen]) => {
      if (!cancelled) {
        setProcesses(list.data);
        setSnapshots({ webcam: webcam.data, screen: screen.data });
      }
    }).catch(() => { if (!cancelled) setError("Data inspector tidak dapat dimuat."); });
    return () => { cancelled = true; };
  }, [pcId]);

  async function poll<T>(path: string, previous: string | undefined, onResult: (value: T) => void) {
    // Agent may wait 30s for command polling, 45s for interactive capture, then retry result delivery.
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!pending.current) return;
      const result = await api.get<{ data: T | null }>(path);
      if (result.data && (result.data as { capturedAt?: string }).capturedAt !== previous) {
        onResult(result.data);
        return;
      }
    }
    throw new Error("Agent belum mengirim data baru. Coba lagi.");
  }

  useEffect(() => {
    pending.current = true;
    return () => { pending.current = false; };
  }, [pcId]);

  async function request(command: string, payload?: object, kind?: Kind) {
    if (busy || !online) return;
    setBusy(true);
    setError("");
    try {
      const old = kind ? snapshots[kind]?.capturedAt : processes?.capturedAt;
      await api.post(`/pcs/${pcId}/command`, { command, payload });
      if (command === "LIST_PROCESSES") await poll<ProcessData>(`/pcs/${pcId}/processes`, old, setProcesses);
      if (kind) await poll<Snapshot>(`/pcs/${pcId}/media-snapshot?kind=${kind}`, old, (data) => setSnapshots((current) => ({ ...current, [kind]: data })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Command gagal.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!autoRefresh || !online || tab !== "media") return;
    const timer = window.setInterval(() => {
      if (!busy) void request("CAPTURE_SCREEN", undefined, "screen");
    }, 5000);
    return () => window.clearInterval(timer);
    // Auto refresh issues screen capture only; webcam remains explicitly requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, online, tab, busy, pcId]);

  return <section className="space-y-3 rounded-xl border-2 border-[#1a1a1a] bg-white p-3" aria-label="Live Inspector PC">
    <h3 className="font-heading text-lg font-black">Live Inspector PC</h3>
    <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Inspector PC">
      <button type="button" role="tab" aria-selected={tab === "processes"} onClick={() => setTab("processes")} className="neo-btn min-h-[44px] text-xs">Aplikasi & Proses Aktif</button>
      <button type="button" role="tab" aria-selected={tab === "media"} onClick={() => setTab("media")} className="neo-btn min-h-[44px] text-xs">Kamera & Layar</button>
    </div>
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {!online && <p className="text-sm text-red-700">PC offline. Command hanya tersedia saat online.</p>}
    {tab === "processes" ? <div className="space-y-2" role="tabpanel">
      <button type="button" disabled={busy || !online} onClick={() => void request("LIST_PROCESSES")} className="neo-btn min-h-[44px] w-full bg-[#4b607f] text-white disabled:opacity-50">{busy ? "Menunggu agent..." : "Segarkan Daftar Aplikasi"}</button>
      {processes && <p className="text-xs">Diambil {new Date(processes.capturedAt).toLocaleString("id-ID")}</p>}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {processes?.processes.map((process) => <div key={process.pid} className="min-w-0 rounded-lg border p-2 text-xs">
          <p className="break-words font-bold">{process.processName || process.name || "Proses"} · PID {process.pid}</p>
          <p className="break-words">{process.windowTitle || "Tanpa judul window/tab"}</p>
          <p>CPU {process.cpuPercent ?? "-"}% · RAM {process.ramMb ?? "-"} MB</p>
          <button type="button" disabled={busy || !online} onClick={() => { if (window.confirm(`Tutup paksa PID ${process.pid}?`)) void request("KILL_PROCESS", { pid: process.pid, processName: process.processName || process.name }); }} className="neo-btn mt-2 min-h-[44px] bg-red-100 px-3 disabled:opacity-50">Tutup Paksa</button>
        </div>)}
        {!processes?.processes.length && <p className="text-xs">Belum ada daftar proses.</p>}
      </div>
    </div> : <div className="space-y-3" role="tabpanel">
      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} /> Auto-Refresh (tiap 5 detik, layar)</label>
      {(["webcam", "screen"] as const).map((kind) => {
        const image = snapshots[kind];
        const label = kind === "webcam" ? "Webcam" : "Layar";
        const imageUrl = image ? `data:${image.mimeType};base64,${image.imageBase64}` : "";
        return <div key={kind} className="min-w-0 space-y-2 rounded-lg border p-2">
          <button type="button" disabled={busy || !online} onClick={() => void request(kind === "webcam" ? "CAPTURE_WEBCAM" : "CAPTURE_SCREEN", undefined, kind)} className="neo-btn min-h-[44px] w-full bg-[#4b607f] text-white disabled:opacity-50">{kind === "webcam" ? "Ambil Foto Webcam" : "Ambil Screenshot Layar"}</button>
          {image ? <><img src={imageUrl} alt={`Foto ${label} ${pcCode}`} className="max-h-64 w-full rounded object-contain" /><p className="text-xs">Diambil {new Date(image.capturedAt).toLocaleString("id-ID")} · {image.width}×{image.height} · {Math.ceil(image.sizeBytes / 1024)} KB</p><p className="text-xs">Otomatis dihapus setelah 15 menit (menimpa foto lama).</p><a className="neo-btn inline-flex min-h-[44px] items-center px-3 text-xs" download={`bukti-${pcCode}-${kind}-${new Date(image.capturedAt).getTime()}.jpg`} href={imageUrl}>Download Bukti (.jpg)</a></> : <p className="text-xs">Belum ada foto {label.toLowerCase()}.</p>}
        </div>;
      })}
    </div>}
  </section>;
}
