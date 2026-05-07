"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TbDeviceDesktop,
  TbWifi,
  TbWifiOff,
  TbRefresh,
  TbSearch,
  TbPower,
  TbPlayerPlay,
  TbLock,
  TbMessage,
  TbChevronRight,
  TbCpu,
  TbAlertTriangle,
  TbCheck,
  TbX,
  TbLoader2,
  TbCopy,
  TbKey,
  TbQuestionMark,
  TbActivity,
  TbDeviceDesktopAnalytics,
} from "react-icons/tb";
import api from "@/services/api";
import type {
  PC,
  PCDetail,
  PCAnalytics,
  AgentStatus,
  HealthStatus,
  PcWarning,
  PcAgentLog,
} from "@/types/index";

const AGENT_STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  ONLINE: { label: "Online", color: "text-green-700", bg: "bg-green-100" },
  OFFLINE: { label: "Offline", color: "text-red-700", bg: "bg-red-100" },
  UNKNOWN: { label: "Unknown", color: "text-gray-700", bg: "bg-gray-100" },
};

const HEALTH_STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string }> = {
  NORMAL: { label: "Normal", color: "text-green-700", bg: "bg-green-100" },
  BROKEN: { label: "Rusak", color: "text-red-700", bg: "bg-red-100" },
  MAINTENANCE: { label: "Maintenance", color: "text-yellow-700", bg: "bg-yellow-100" },
  NEEDS_CHECK: { label: "Perlu Cek", color: "text-orange-700", bg: "bg-orange-100" },
};

const PC_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AVAILABLE: { label: "Tersedia", color: "text-green-700", bg: "bg-green-100" },
  IN_USE: { label: "Digunakan", color: "text-blue-700", bg: "bg-blue-100" },
  BROKEN: { label: "Rusak", color: "text-red-700", bg: "bg-red-100" },
  MAINTENANCE: { label: "Maintenance", color: "text-yellow-700", bg: "bg-yellow-100" },
  INACTIVE: { label: "Nonaktif", color: "text-gray-700", bg: "bg-gray-100" },
};

const COMMAND_OPTIONS = [
  { value: "SHUTDOWN", label: "Shutdown", icon: TbPower, color: "text-red-600" },
  { value: "RESTART", label: "Restart", icon: TbRefresh, color: "text-orange-600" },
  { value: "WAKE_ON_LAN", label: "Wake on LAN", icon: TbPlayerPlay, color: "text-green-600" },
  { value: "SLEEP", label: "Sleep", icon: TbPower, color: "text-purple-600" },
  { value: "LOCK", label: "Lock", icon: TbLock, color: "text-blue-600" },
  { value: "MESSAGE", label: "Kirim Pesan", icon: TbMessage, color: "text-teal-600" },
];

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Tidak pernah";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

function UsageBar({ value, label }: { value: number | null | undefined; label: string }) {
  const pct = value ?? 0;
  const barColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#5a5a5a] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function MiniBar({ value }: { value: number | null | undefined }) {
  const pct = value ?? 0;
  if (pct === 0 && value == null) return <span className="text-xs text-[#5a5a5a]">-</span>;
  const barColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-[#1a1a1a]">{pct.toFixed(0)}%</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-[#5a5a5a]">{label}</span>
      <p className="text-sm font-medium text-[#1a1a1a] truncate">{value}</p>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, iconBg }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string; iconBg: string }) {
  return (
    <div className="neo-card-hover p-4 flex items-center gap-3 cursor-default">
      <div className={`w-10 h-10 rounded-full ${iconBg} neo-border-sm flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="font-heading text-2xl font-bold text-[#1a1a1a] leading-none">{value}</p>
        <p className="text-xs font-bold text-[#5a5a5a] mt-0.5 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

export default function PCMonitoringPage() {
  const [pcs, setPCs] = useState<PC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAgentStatus, setFilterAgentStatus] = useState<string>("");
  const [filterHealthStatus, setFilterHealthStatus] = useState<string>("");
  const [filterLab, setFilterLab] = useState<string>("");
  const [selectedPCs, setSelectedPCs] = useState<string[]>([]);
  const [detailPC, setDetailPC] = useState<PCDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [commandTarget, setCommandTarget] = useState<string>("");
  const [commandType, setCommandType] = useState("");
  const [commandPayload, setCommandPayload] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [analytics, setAnalytics] = useState<PCAnalytics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(30);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPCs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterAgentStatus) params.set("agentStatus", filterAgentStatus);
      if (filterHealthStatus) params.set("healthStatus", filterHealthStatus);
      if (filterLab) params.set("labId", filterLab);
      if (search) params.set("search", search);
      const res = await api.get<{ data: PC[] }>(`/pcs?${params.toString()}`);
      setPCs(res.data || []);
    } catch {
      setPCs([]);
    } finally {
      setLoading(false);
    }
  }, [filterAgentStatus, filterHealthStatus, filterLab, search]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get<{ data: PCAnalytics }>(`/pcs/analytics${filterLab ? `?labId=${filterLab}` : ""}`);
      setAnalytics(res.data);
    } catch {}
  }, [filterLab]);

  useEffect(() => {
    fetchPCs();
    fetchAnalytics();
  }, [fetchPCs, fetchAnalytics]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchPCs();
      fetchAnalytics();
      setAutoRefreshCountdown(30);
    }, 30000);

    countdownRef.current = setInterval(() => {
      setAutoRefreshCountdown((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchPCs, fetchAnalytics]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPCs();
    await fetchAnalytics();
    setAutoRefreshCountdown(30);
    setRefreshing(false);
  }

  async function openDetail(pcId: string) {
    try {
      const res = await api.get<{ data: PCDetail }>(`/pcs/${pcId}`);
      setDetailPC(res.data);
      setShowDetail(true);
      setGeneratedToken(null);
    } catch {

    }
  }

  function openCommandModal(pcId: string) {
    setCommandTarget(pcId);
    setCommandType("");
    setCommandPayload("");
    setShowCommandModal(true);
  }

  async function confirmCommand() {
    if (!commandTarget || !commandType) return;
    try {
      const payload = commandPayload ? { message: commandPayload } : undefined;
      await api.post(`/pcs/${commandTarget}/command`, { command: commandType, payload });
      setShowCommandModal(false);
      if (detailPC && detailPC.id === commandTarget) {
        openDetail(commandTarget);
      }
    } catch {

    }
  }

  async function generateToken(pcId: string) {
    try {
      setGeneratingToken(true);
      const res = await api.post<{ data: { token: string; pcCode: string } }>(`/pcs/${pcId}/generate-token`, {});
      setGeneratedToken(res.data.token);
    } catch {

    } finally {
      setGeneratingToken(false);
    }
  }

  async function copyToken() {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function bulkAction(action: string) {
    if (selectedPCs.length === 0) return;
    if (action === "status") {
      setShowBulkModal(true);
    } else {
      await api.post("/pcs/bulk-command", { pcIds: selectedPCs, command: action });
      setSelectedPCs([]);
      fetchPCs();
    }
  }

  async function bulkStatusUpdate(status: string, reason: string) {
    await api.post("/pcs/bulk-status", { pcIds: selectedPCs, status, reason });
    setSelectedPCs([]);
    setShowBulkModal(false);
    fetchPCs();
    fetchAnalytics();
  }

  function toggleSelect(pcId: string) {
    setSelectedPCs((prev) =>
      prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId]
    );
  }

  function selectAll() {
    if (selectedPCs.length === pcs.length) {
      setSelectedPCs([]);
    } else {
      setSelectedPCs(pcs.map((pc) => pc.id));
    }
  }

  const labs = [...new Set(pcs.map((pc) => JSON.stringify(pc.lab)))].map((l) => JSON.parse(l));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#1a1a1a] tracking-tight">
            PC Monitoring
          </h1>
          <p className="text-[#5a5a5a] mt-1 font-medium">
            Monitor dan kontrol semua PC lab secara real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#5a5a5a] font-medium">
            Auto-refresh: {autoRefreshCountdown}s
          </span>
          <button
            onClick={handleRefresh}
            className="neo-btn px-5 py-2.5 bg-white text-[#1a1a1a] flex items-center gap-2 font-bold hover:bg-[#f5ede6]"
            disabled={refreshing}
          >
            {refreshing ? <TbLoader2 className="w-4 h-4 animate-spin" /> : <TbRefresh className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <StatCard icon={TbDeviceDesktop} value={analytics.totalPCs} label="Total PC" iconBg="bg-[#4b607f]" />
          <StatCard icon={TbWifi} value={analytics.onlineCount} label="Online" iconBg="bg-green-500" />
          <StatCard icon={TbWifiOff} value={analytics.offlineCount} label="Offline" iconBg="bg-red-500" />
          <StatCard icon={TbQuestionMark} value={analytics.unknownCount} label="Unknown" iconBg="bg-gray-500" />
          <StatCard icon={TbAlertTriangle} value={analytics.statusCounts?.find((s) => s.status === "BROKEN")?.count || 0} label="Rusak" iconBg="bg-red-600" />
          <StatCard icon={TbCpu} value={analytics.statusCounts?.find((s) => s.status === "MAINTENANCE")?.count || 0} label="Maintenance" iconBg="bg-yellow-500" />
          <StatCard icon={TbDeviceDesktopAnalytics} value={analytics.needsCheckCount} label="Perlu Cek" iconBg="bg-orange-500" />
          <StatCard icon={TbActivity} value={analytics.warningCount} label="Warnings" iconBg="bg-[#f3701e]" />
        </div>
      )}

      <div className="neo-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <TbSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a5a]" />
            <input
              type="text"
              placeholder="Cari PC code, nama, hostname, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPCs()}
              className="neo-input w-full pl-9"
            />
          </div>
          <select
            value={filterAgentStatus}
            onChange={(e) => setFilterAgentStatus(e.target.value)}
            className="neo-input w-full md:w-40"
          >
            <option value="">Agent Status</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <select
            value={filterHealthStatus}
            onChange={(e) => setFilterHealthStatus(e.target.value)}
            className="neo-input w-full md:w-40"
          >
            <option value="">Health Status</option>
            <option value="NORMAL">Normal</option>
            <option value="BROKEN">Rusak</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="NEEDS_CHECK">Perlu Cek</option>
          </select>
          <select
            value={filterLab}
            onChange={(e) => setFilterLab(e.target.value)}
            className="neo-input w-full md:w-40"
          >
            <option value="">Semua Lab</option>
            {labs.map((lab: { id: string; name: string }) => (
              <option key={lab.id} value={lab.id}>{lab.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedPCs.length > 0 && (
        <div className="neo-card p-3 bg-[#f5ede6] flex items-center gap-3 flex-wrap">
          <span className="text-sm font-bold text-[#1a1a1a]">{selectedPCs.length} PC dipilih</span>
          <button onClick={() => bulkAction("SHUTDOWN")} className="neo-btn px-3 py-1.5 text-xs bg-red-100 text-red-700">Shutdown</button>
          <button onClick={() => bulkAction("RESTART")} className="neo-btn px-3 py-1.5 text-xs bg-orange-100 text-orange-700">Restart</button>
          <button onClick={() => bulkAction("LOCK")} className="neo-btn px-3 py-1.5 text-xs bg-blue-100 text-blue-700">Lock</button>
          <button onClick={() => bulkAction("status")} className="neo-btn px-3 py-1.5 text-xs bg-[#4b607f] text-white">Ubah Status</button>
          <button onClick={() => setSelectedPCs([])} className="neo-btn px-3 py-1.5 text-xs">Batal</button>
        </div>
      )}

      <div className="neo-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#1a1a1a] bg-[#f5ede6]">
                <th className="p-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedPCs.length === pcs.length && pcs.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">PC Code</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Nama</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Lab</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Agent</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Health</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">CPU</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">RAM</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Storage</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">IP</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Last Seen</th>
                <th className="p-3 text-left font-bold text-[#1a1a1a]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center">
                    <TbLoader2 className="w-6 h-6 animate-spin mx-auto text-[#4b607f]" />
                  </td>
                </tr>
              ) : pcs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-[#5a5a5a]">
                    Tidak ada PC ditemukan
                  </td>
                </tr>
              ) : (
                pcs.map((pc) => (
                  <tr key={pc.id} className="border-b border-gray-200 hover:bg-[#f5ede6]/50 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedPCs.includes(pc.id)}
                        onChange={() => toggleSelect(pc.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-[#1a1a1a]">{pc.pcCode}</td>
                    <td className="p-3 text-[#1a1a1a]">{pc.name}</td>
                    <td className="p-3 text-[#5a5a5a]">{pc.lab?.name || "-"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${AGENT_STATUS_CONFIG[pc.agentStatus]?.bg} ${AGENT_STATUS_CONFIG[pc.agentStatus]?.color}`}>
                        {AGENT_STATUS_CONFIG[pc.agentStatus]?.label || pc.agentStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${HEALTH_STATUS_CONFIG[pc.healthStatus]?.bg} ${HEALTH_STATUS_CONFIG[pc.healthStatus]?.color}`}>
                        {HEALTH_STATUS_CONFIG[pc.healthStatus]?.label || pc.healthStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      <MiniBar value={pc.cpuUsage} />
                    </td>
                    <td className="p-3">
                      <MiniBar value={pc.ramUsage} />
                    </td>
                    <td className="p-3">
                      <MiniBar value={pc.storageUsage} />
                    </td>
                    <td className="p-3 font-mono text-xs text-[#5a5a5a]">{pc.ipAddress || "-"}</td>
                    <td className="p-3 text-xs text-[#5a5a5a]">{formatRelativeTime(pc.lastSeen)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetail(pc.id)}
                          className="neo-btn px-2 py-1 text-xs"
                          title="Detail"
                        >
                          <TbChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openCommandModal(pc.id)}
                          className="neo-btn px-2 py-1 text-xs bg-[#4b607f] text-white"
                          title="Command"
                        >
                          <TbPower className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetail && detailPC && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowDetail(false)} />
          <div className="w-full max-w-lg bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.1)] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-[#1a1a1a] p-4 flex items-center justify-between z-10">
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">
                {detailPC.pcCode} — {detailPC.name}
              </h2>
              <button onClick={() => setShowDetail(false)} className="neo-btn p-2">
                <TbX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <section>
                <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Info Dasar</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoRow label="Lab" value={detailPC.lab?.name || "-"} />
                  <InfoRow label="Status" value={PC_STATUS_CONFIG[detailPC.status]?.label || detailPC.status} />
                  <InfoRow label="Agent Status" value={AGENT_STATUS_CONFIG[detailPC.agentStatus]?.label || detailPC.agentStatus} />
                  <InfoRow label="Health" value={HEALTH_STATUS_CONFIG[detailPC.healthStatus]?.label || detailPC.healthStatus} />
                  <InfoRow label="IP Address" value={detailPC.ipAddress || "-"} />
                  <InfoRow label="MAC" value={detailPC.macAddress || "-"} />
                  <InfoRow label="Last Seen" value={formatRelativeTime(detailPC.lastSeen)} />
                  <InfoRow label="Agent Installed" value={detailPC.isAgentInstalled ? "Ya" : "Tidak"} />
                </div>
              </section>

              <section>
                <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Hardware</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoRow label="Hostname" value={detailPC.hostname || "-"} />
                  <InfoRow label="OS" value={detailPC.os || "-"} />
                  <InfoRow label="Arch" value={detailPC.architecture || "-"} />
                  <InfoRow label="CPU" value={detailPC.cpuModel || "-"} />
                  <InfoRow label="RAM Total" value={detailPC.ramTotalGb ? `${detailPC.ramTotalGb} GB` : "-"} />
                  <InfoRow label="Storage Total" value={detailPC.storageTotalGb ? `${detailPC.storageTotalGb} GB` : "-"} />
                  <InfoRow label="Agent Version" value={detailPC.agentVersion || "-"} />
                  <InfoRow label="Power" value={detailPC.powerWatt ? `${detailPC.powerWatt}W` : "-"} />
                </div>
              </section>

              <section>
                <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Resource Usage</h3>
                <div className="space-y-2">
                  <UsageBar value={detailPC.cpuUsage} label="CPU" />
                  <UsageBar value={detailPC.ramUsage} label="RAM" />
                  <UsageBar value={detailPC.storageUsage} label="Storage" />
                </div>
              </section>

              <section>
                <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Agent Token</h3>
                {generatedToken ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="neo-input flex-1 font-mono text-xs"
                    />
                    <button onClick={copyToken} className="neo-btn px-3 py-2">
                      {copied ? <TbCheck className="w-4 h-4 text-green-600" /> : <TbCopy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => generateToken(detailPC.id)}
                    disabled={generatingToken}
                    className="neo-btn px-4 py-2 bg-[#4b607f] text-white flex items-center gap-2 text-sm"
                  >
                    {generatingToken ? <TbLoader2 className="w-4 h-4 animate-spin" /> : <TbKey className="w-4 h-4" />}
                    Generate Token Baru
                  </button>
                )}
                <p className="text-xs text-[#5a5a5a] mt-1">Token hanya ditampilkan sekali. Simpan sebelum menutup.</p>
              </section>

              {detailPC.warnings && detailPC.warnings.length > 0 && (
                <section>
                  <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Warnings</h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {detailPC.warnings.map((w: PcWarning) => (
                      <div key={w.id} className="flex items-center gap-2 text-xs p-2 bg-orange-50 rounded border border-orange-200">
                        <TbAlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        <span className="font-medium">{w.warningType}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          w.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
                          w.severity === "HIGH" ? "bg-orange-100 text-orange-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>{w.severity}</span>
                        {w.isResolved && <span className="text-green-600 ml-auto">Resolved</span>}
                        {!w.isResolved && <span className="text-[#5a5a5a] ml-auto">{formatRelativeTime(w.createdAt)}</span>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailPC.commands && detailPC.commands.length > 0 && (
                <section>
                  <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Command Terakhir</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {detailPC.commands.slice(0, 5).map((cmd: { id: string; command: string; status: string; createdAt: string }) => (
                      <div key={cmd.id} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                        <span className="font-medium">{COMMAND_OPTIONS.find((c) => c.value === cmd.command)?.label || cmd.command}</span>
                        <span className={`px-1.5 py-0.5 rounded ${
                          cmd.status === "EXECUTED" ? "bg-green-100 text-green-700" :
                          cmd.status === "FAILED" ? "bg-red-100 text-red-700" :
                          cmd.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>{cmd.status}</span>
                        <span className="text-[#5a5a5a] ml-auto">{formatRelativeTime(cmd.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailPC.agentLogs && detailPC.agentLogs.length > 0 && (
                <section>
                  <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Agent Logs</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {detailPC.agentLogs.slice(0, 10).map((log: PcAgentLog) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          log.level === "ERROR" ? "bg-red-500" :
                          log.level === "WARNING" ? "bg-yellow-500" :
                          "bg-green-500"
                        }`} />
                        <span className="font-medium">{log.eventType}</span>
                        {log.message && <span className="text-[#5a5a5a] truncate flex-1">{log.message}</span>}
                        <span className="text-[#5a5a5a] ml-auto shrink-0">{formatRelativeTime(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailPC.statusLogs && detailPC.statusLogs.length > 0 && (
                <section>
                  <h3 className="font-bold text-sm text-[#1a1a1a] mb-2 uppercase tracking-wider">Status Logs</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {detailPC.statusLogs.slice(0, 5).map((log: { id: string; fromStatus: string; toStatus: string; reason?: string; createdAt: string }) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                        <span className={`px-1.5 py-0.5 rounded ${PC_STATUS_CONFIG[log.fromStatus]?.bg || "bg-gray-100"}`}>
                          {PC_STATUS_CONFIG[log.fromStatus]?.label || log.fromStatus}
                        </span>
                        <span>→</span>
                        <span className={`px-1.5 py-0.5 rounded ${PC_STATUS_CONFIG[log.toStatus]?.bg || "bg-gray-100"}`}>
                          {PC_STATUS_CONFIG[log.toStatus]?.label || log.toStatus}
                        </span>
                        <span className="text-[#5a5a5a] ml-auto">{formatRelativeTime(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <button
                  onClick={() => openCommandModal(detailPC.id)}
                  className="neo-btn w-full py-3 bg-[#4b607f] text-white font-bold flex items-center justify-center gap-2"
                >
                  <TbPower className="w-5 h-5" /> Kirim Command
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {showCommandModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCommandModal(false)}>
          <div className="bg-white neo-card shadow-[6px_6px_0px_#1a1a1a] rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-heading font-bold mb-4">Kirim Command</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#1a1a1a]">Pilih Command</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {COMMAND_OPTIONS.map((cmd) => (
                    <button
                      key={cmd.value}
                      onClick={() => setCommandType(cmd.value)}
                      className={`neo-btn px-3 py-2 text-xs flex items-center gap-2 ${
                        commandType === cmd.value ? "bg-[#4b607f] text-white" : ""
                      }`}
                    >
                      <cmd.icon className={`w-4 h-4 ${commandType === cmd.value ? "text-white" : cmd.color}`} />
                      {cmd.label}
                    </button>
                  ))}
                </div>
              </div>
              {commandType === "MESSAGE" && (
                <div>
                  <label className="text-sm font-medium text-[#1a1a1a]">Pesan</label>
                  <input
                    type="text"
                    value={commandPayload}
                    onChange={(e) => setCommandPayload(e.target.value)}
                    placeholder="Tulis pesan untuk PC..."
                    className="neo-input w-full mt-1"
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowCommandModal(false)} className="neo-btn px-4 py-2">Batal</button>
                <button
                  onClick={confirmCommand}
                  disabled={!commandType}
                  className="neo-btn px-4 py-2 bg-[#f3701e] text-white font-bold disabled:opacity-50"
                >
                  <TbCheck className="w-4 h-4 inline mr-1" /> Konfirmasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white neo-card shadow-[6px_6px_0px_#1a1a1a] rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-heading font-bold mb-4">Ubah Status {selectedPCs.length} PC</h3>
            <BulkStatusForm onSubmit={bulkStatusUpdate} onCancel={() => setShowBulkModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function BulkStatusForm({ onSubmit, onCancel }: { onSubmit: (status: string, reason: string) => void; onCancel: () => void }) {
  const [status, setStatus] = useState("AVAILABLE");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Status Baru</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="neo-input w-full mt-1">
          {Object.entries(PC_STATUS_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Alasan</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan perubahan status..."
          className="neo-input w-full mt-1"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="neo-btn">Batal</button>
        <button onClick={() => onSubmit(status, reason)} className="neo-btn bg-[#4b607f] text-white">
          <TbCheck className="w-4 h-4 inline mr-1" /> Terapkan
        </button>
      </div>
    </div>
  );
}
