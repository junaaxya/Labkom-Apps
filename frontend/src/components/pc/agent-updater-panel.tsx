"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TbAlertTriangle, TbCheck, TbCloudUpload, TbPlayerPause, TbPlayerPlay, TbRefresh, TbRestore } from "react-icons/tb";
import api from "@/services/api";
import type { PC } from "@/types";

type Release = {
  id: string; version: string; platform: string; architecture: string; sha256: string; sizeBytes: number;
  minimumUpdaterVersion: string; mandatory: boolean; isPublished: boolean; createdAt: string;
};
type Attempt = { id: string; status: string; message?: string | null; updatedAt: string };
type Assignment = {
  id: string; status: string; currentVersion?: string | null; targetVersion: string; lastError?: string | null;
  pc: { id: string; pcCode: string; name: string; labId: string; agentVersion?: string | null };
  attempts: Attempt[];
};
type Rollout = {
  id: string; status: string; scope: string; rolloutPercent: number; checkAfterSeconds: number; createdAt: string;
  release: Release; assignments: Assignment[];
};
type Props = { pcs: PC[]; labs: Array<{ id: string; name: string }>; selectedPcIds: string[] };

const UPDATE_LABEL: Record<string, string> = {
  PENDING: "Pending", DOWNLOADING: "Downloading", VERIFYING: "Verifying", INSTALLING: "Installing",
  AWAITING_HEARTBEAT: "Menunggu heartbeat", SUCCEEDED: "Installed", FAILED: "Failed",
  ROLLING_BACK: "Rolling back", ROLLED_BACK: "Rolled back", CANCELLED: "Cancelled",
};

function currentRole(): string {
  try { return JSON.parse(localStorage.getItem("user") || "{}").role || ""; } catch { return ""; }
}
function responseMessage(error: unknown): string { return error instanceof Error ? error.message : "Operasi updater gagal"; }

export function AgentUpdaterPanel({ pcs, labs, selectedPcIds }: Props) {
  const [role, setRole] = useState("");
  const [releases, setReleases] = useState<Release[]>([]);
  const [rollouts, setRollouts] = useState<Rollout[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [minimumUpdaterVersion, setMinimumUpdaterVersion] = useState("1.0.0");
  const [mandatory, setMandatory] = useState(false);
  const [releaseId, setReleaseId] = useState("");
  const [scope, setScope] = useState<"PCS" | "LAB" | "ALL">("PCS");
  const [labId, setLabId] = useState("");
  const [rolloutPercent, setRolloutPercent] = useState(100);
  const canManage = role === "KOORDINATOR_LAB";

  const load = useCallback(async () => {
    try {
      const [releaseRes, rolloutRes] = await Promise.all([
        api.get<{ data: Release[] }>("/pcs/agent-updates/releases"),
        api.get<{ data: Rollout[] }>("/pcs/agent-updates/rollouts"),
      ]);
      setReleases(releaseRes.data);
      setRollouts(rolloutRes.data);
      setReleaseId((current) => current || releaseRes.data.find((item) => item.isPublished)?.id || "");
    } catch (error) { setFeedback(responseMessage(error)); }
  }, []);

  useEffect(() => { setRole(currentRole()); void load(); }, [load]);

  const totals = useMemo(() => rollouts.flatMap((item) => item.assignments).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1; return acc;
  }, {}), [rollouts]);

  async function upload() {
    if (!file || !version) return setFeedback("Versi dan artifact ZIP wajib.");
    setBusy(true); setFeedback("");
    try {
      const body = new FormData();
      body.append("artifact", file); body.append("version", version); body.append("platform", "windows");
      body.append("architecture", "x86_64"); body.append("minimumUpdaterVersion", minimumUpdaterVersion);
      body.append("mandatory", String(mandatory));
      await api.post("/pcs/agent-updates/releases", body);
      setFile(null); setVersion(""); setFeedback("Release tersimpan sebagai draft."); await load();
    } catch (error) { setFeedback(responseMessage(error)); } finally { setBusy(false); }
  }

  async function publish(id: string) {
    setBusy(true); try { await api.patch(`/pcs/agent-updates/releases/${id}/publish`, {}); setFeedback("Release published."); await load(); }
    catch (error) { setFeedback(responseMessage(error)); } finally { setBusy(false); }
  }

  async function startRollout() {
    const pcIds = scope === "PCS" ? selectedPcIds : undefined;
    if (scope === "PCS" && !pcIds?.length) return setFeedback("Pilih PC pada tabel monitoring terlebih dahulu.");
    if (scope === "LAB" && !labId) return setFeedback("Pilih lab target.");
    setBusy(true);
    try {
      await api.post("/pcs/agent-updates/rollouts", { releaseId, scope, pcIds, labId: scope === "LAB" ? labId : undefined, rolloutPercent, checkAfterSeconds: 600 });
      setFeedback("Rollout aktif. Agent akan mengambil manifest saat polling berikutnya."); await load();
    } catch (error) { setFeedback(responseMessage(error)); } finally { setBusy(false); }
  }

  async function rolloutAction(id: string, action: "pause" | "resume" | "cancel") {
    setBusy(true); try { await api.patch(`/pcs/agent-updates/rollouts/${id}/${action}`, {}); await load(); }
    catch (error) { setFeedback(responseMessage(error)); } finally { setBusy(false); }
  }

  async function rollback(id: string) {
    if (!window.confirm("Minta semua target rollout kembali ke versi N-1?")) return;
    setBusy(true); try { await api.post(`/pcs/agent-updates/rollouts/${id}/rollback`, {}); setFeedback("Rollback diminta."); await load(); }
    catch (error) { setFeedback(responseMessage(error)); } finally { setBusy(false); }
  }

  return <section className="neo-card overflow-hidden bg-white">
    <header className="flex flex-col gap-3 border-b-2 border-[#1a1a1a] bg-[#e8d8c9] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Signed agent releases</p><h2 className="font-heading text-xl font-black">Agent Updater</h2><p className="text-xs font-semibold text-[#5a5a5a]">{canManage ? "Kelola release dan rollout bertahap." : "Status read-only; rollout dikendalikan koordinator."}</p></div>
      <button type="button" onClick={() => void load()} className="neo-btn min-h-[44px] bg-white px-4 text-sm font-black"><TbRefresh className="inline h-4 w-4" /> Refresh</button>
    </header>
    <div className="space-y-4 p-4">
      {feedback && <div role="status" className="rounded-lg border-2 border-[#1a1a1a] bg-[#fff7ed] p-3 text-sm font-bold">{feedback}</div>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[["PENDING", "Pending"], ["DOWNLOADING", "Downloading"], ["VERIFYING", "Verifying"], ["INSTALLING", "Installing"], ["SUCCEEDED", "Installed"], ["FAILED", "Failed"], ["ROLLED_BACK", "Rolled back"]].map(([key, label]) => <div key={key} className="rounded-xl border-2 border-[#1a1a1a] bg-[#f5ede6] p-3"><p className="text-[10px] font-black uppercase text-[#5a5a5a]">{label}</p><p className="font-heading text-2xl font-black">{totals[key] || 0}</p></div>)}
      </div>

      {canManage && <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border-2 border-[#1a1a1a] p-3"><h3 className="font-black">Upload signed release</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Versi, contoh 1.1.0" className="neo-input min-h-[44px] px-3" />
          <input value={minimumUpdaterVersion} onChange={(e) => setMinimumUpdaterVersion(e.target.value)} placeholder="Minimum updater" className="neo-input min-h-[44px] px-3" />
          <input type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] || null)} className="neo-input min-h-[44px] p-2 sm:col-span-2" />
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} /> Mandatory</label>
          <button type="button" disabled={busy} onClick={() => void upload()} className="neo-btn min-h-[44px] bg-[#f3701e] px-4 font-black"><TbCloudUpload className="inline h-4 w-4" /> Upload draft</button>
        </div></div>
        <div className="rounded-xl border-2 border-[#1a1a1a] p-3"><h3 className="font-black">Mulai rollout</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)} className="neo-input min-h-[44px] px-3"><option value="">Pilih release published</option>{releases.filter((item) => item.isPublished).map((item) => <option key={item.id} value={item.id}>{item.version}</option>)}</select>
          <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="neo-input min-h-[44px] px-3"><option value="PCS">PC terpilih ({selectedPcIds.length})</option><option value="LAB">Satu lab</option><option value="ALL">Semua PC</option></select>
          {scope === "LAB" && <select value={labId} onChange={(e) => setLabId(e.target.value)} className="neo-input min-h-[44px] px-3"><option value="">Pilih lab</option>{labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}</select>}
          <label className="text-xs font-black">Persentase pilot {rolloutPercent}%<input type="range" min="1" max="100" value={rolloutPercent} onChange={(e) => setRolloutPercent(Number(e.target.value))} className="block w-full" /></label>
          <button type="button" disabled={busy || !releaseId} onClick={() => void startRollout()} className="neo-btn min-h-[44px] bg-[#4b607f] px-4 font-black text-white sm:col-span-2"><TbPlayerPlay className="inline h-4 w-4" /> Aktifkan rollout</button>
        </div></div>
      </div>}

      <div className="space-y-3">{releases.map((release) => <article key={release.id} className="flex flex-col gap-2 rounded-xl border-2 border-[#1a1a1a] bg-[#f5ede6] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Agent {release.version} · {release.platform}/{release.architecture}</p><p className="text-xs font-semibold text-[#5a5a5a]">{(release.sizeBytes / 1024 / 1024).toFixed(1)} MB · SHA-256 {release.sha256.slice(0, 12)}… · updater ≥ {release.minimumUpdaterVersion}</p></div><div className="flex items-center gap-2">{release.isPublished ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800"><TbCheck className="inline" /> Published</span> : canManage && <button type="button" disabled={busy} onClick={() => void publish(release.id)} className="neo-btn min-h-[40px] bg-white px-3 text-xs font-black">Publish</button>}</div></article>)}</div>

      <div className="space-y-3">{rollouts.map((rollout) => <article key={rollout.id} className="rounded-xl border-2 border-[#1a1a1a] p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Rollout {rollout.release.version} · {rollout.scope} · {rollout.rolloutPercent}%</p><p className="text-xs font-semibold text-[#5a5a5a]">{rollout.status} · {rollout.assignments.length} target</p></div>{canManage && <div className="flex flex-wrap gap-2">{rollout.status === "ACTIVE" ? <button type="button" onClick={() => void rolloutAction(rollout.id, "pause")} className="neo-btn min-h-[40px] bg-white px-3 text-xs font-black"><TbPlayerPause className="inline" /> Pause</button> : rollout.status === "PAUSED" && <button type="button" onClick={() => void rolloutAction(rollout.id, "resume")} className="neo-btn min-h-[40px] bg-white px-3 text-xs font-black"><TbPlayerPlay className="inline" /> Resume</button>}<button type="button" onClick={() => void rollback(rollout.id)} className="neo-btn min-h-[40px] bg-[#ffcdd2] px-3 text-xs font-black"><TbRestore className="inline" /> Rollback N-1</button></div>}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{rollout.assignments.map((item) => <div key={item.id} className="rounded-lg bg-[#f5ede6] p-2 text-xs"><p className="font-black">{item.pc.pcCode} · {UPDATE_LABEL[item.status] || item.status}</p><p>{item.currentVersion || "-"} → {item.targetVersion}</p>{item.lastError && <p className="mt-1 font-bold text-red-700"><TbAlertTriangle className="inline" /> {item.lastError}</p>}</div>)}</div>
      </article>)}</div>
      {!releases.length && <p className="text-sm font-semibold text-[#5a5a5a]">Belum ada release agent.</p>}
    </div>
  </section>;
}
