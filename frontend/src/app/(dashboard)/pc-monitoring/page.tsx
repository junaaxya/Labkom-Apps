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
  TbFilter,
} from "react-icons/tb";
import api from "@/services/api";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { MobileCard } from "@/components/ui/mobile-card";
import type {
  PC,
  PCDetail,
  PCAnalytics,
  AgentStatus,
  HealthStatus,
  PcWarning,
  PcAgentLog,
} from "@/types/index";

type CommandLite = { id: string; command: string; status: string; createdAt: string };

type StatusLogLite = {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  createdAt: string;
};

function isCommandLite(value: unknown): value is CommandLite {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.command === "string" &&
    typeof v.status === "string" &&
    typeof v.createdAt === "string"
  );
}

function isStatusLogLite(value: unknown): value is StatusLogLite {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.fromStatus === "string" &&
    typeof v.toStatus === "string" &&
    typeof v.createdAt === "string"
  );
}

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
    <div className="rounded-2xl border border-[#1a1a1a]/10 bg-[#f5ede6] px-3 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">{label}</span>
      <p className="mt-0.5 truncate text-sm font-bold text-[#1a1a1a]">{value}</p>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, iconBg }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string; iconBg: string }) {
  return (
    <div className="neo-card-hover p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 cursor-default min-h-[84px]">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl ${iconBg} neo-border-sm flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-none">{value}</p>
        <p className="text-[10px] sm:text-xs font-bold text-[#5a5a5a] mt-0.5 uppercase tracking-wide line-clamp-1">{label}</p>
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
    queueMicrotask(() => {
      void fetchPCs();
      void fetchAnalytics();
    });
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
  const activeFilterCount = [filterAgentStatus, filterHealthStatus, filterLab].filter(Boolean).length + (search ? 1 : 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="neo-card overflow-hidden bg-[#f5ede6] text-[#1a1a1a] shadow-[5px_5px_0px_#1a1a1a]">
        <div className="relative p-4 sm:p-6 lg:p-7">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#f3701e]/20 blur-sm" />
          <div className="absolute right-10 bottom-4 h-12 w-12 rotate-12 rounded-2xl border-2 border-[#4b607f]/30" />
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#4b607f] shadow-[2px_2px_0px_rgba(26,26,26,0.18)]">
                  <TbDeviceDesktopAnalytics className="h-4 w-4" />
                  Live Lab Agent
                </div>
                <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  PC Monitoring
                </h1>
                <p className="mt-1 max-w-xl text-xs sm:text-sm font-semibold text-[#5a5a5a]">
                  Pantau status agent, kesehatan perangkat, resource, dan command PC lab secara real-time.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="neo-btn min-h-[48px] w-full sm:w-auto px-5 py-3 bg-white text-[#1a1a1a] flex items-center justify-center gap-2 font-black active:scale-[0.98]"
                disabled={refreshing}
              >
                {refreshing ? <TbLoader2 className="w-5 h-5 animate-spin" /> : <TbRefresh className="w-5 h-5" />}
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Auto-refresh</p>
                <p className="mt-1 font-heading text-2xl font-bold leading-none">{autoRefreshCountdown}s</p>
              </div>
              <div className="rounded-2xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Filter Aktif</p>
                <p className="mt-1 font-heading text-2xl font-bold leading-none">{activeFilterCount}</p>
              </div>
              <div className="rounded-2xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Dipilih</p>
                <p className="mt-1 font-heading text-2xl font-bold leading-none">{selectedPCs.length}</p>
              </div>
              <div className="rounded-2xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">List</p>
                <p className="mt-1 font-heading text-2xl font-bold leading-none">{pcs.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 sm:gap-4">
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

      <div className="neo-card p-2.5 sm:p-4 sticky top-[64px] z-20 bg-[#f5ede6]/95 backdrop-blur-md md:static md:bg-white md:backdrop-blur-none">
        <div className="mb-2 flex items-center justify-between md:hidden">
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1a1a1a]">
            <TbFilter className="h-4 w-4" /> Filter Monitor
          </span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#f3701e] px-2 py-1 text-[10px] font-black text-white">{activeFilterCount} aktif</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_160px_160px_160px] md:gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <TbSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a5a]" />
            <input
              type="text"
              placeholder="Cari PC code, nama, hostname, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPCs()}
              className="neo-input w-full pl-9 min-h-[44px] text-sm bg-white"
            />
          </div>
          <select
            value={filterAgentStatus}
            onChange={(e) => setFilterAgentStatus(e.target.value)}
            className="neo-input w-full min-h-[44px] text-xs sm:text-sm bg-white px-2 sm:px-3"
          >
            <option value="">Agent Status</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <select
            value={filterHealthStatus}
            onChange={(e) => setFilterHealthStatus(e.target.value)}
            className="neo-input w-full min-h-[44px] text-xs sm:text-sm bg-white px-2 sm:px-3"
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
            className="neo-input col-span-2 w-full min-h-[44px] text-xs sm:text-sm bg-white px-2 sm:px-3 md:col-span-1"
          >
            <option value="">Semua Lab</option>
            {labs.map((lab: { id: string; name: string }) => (
              <option key={lab.id} value={lab.id}>{lab.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedPCs.length > 0 && (
        <div className="neo-card p-3 sm:p-4 bg-[#f5ede6] flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <span className="text-sm font-black text-[#1a1a1a]">{selectedPCs.length} PC dipilih</span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button onClick={() => bulkAction("SHUTDOWN")} className="neo-btn min-h-[44px] px-3 py-2 text-xs bg-red-100 text-red-700">Shutdown</button>
            <button onClick={() => bulkAction("RESTART")} className="neo-btn min-h-[44px] px-3 py-2 text-xs bg-orange-100 text-orange-700">Restart</button>
            <button onClick={() => bulkAction("LOCK")} className="neo-btn min-h-[44px] px-3 py-2 text-xs bg-blue-100 text-blue-700">Lock</button>
            <button onClick={() => bulkAction("status")} className="neo-btn min-h-[44px] px-3 py-2 text-xs bg-[#4b607f] text-white">Ubah Status</button>
            <button onClick={() => setSelectedPCs([])} className="neo-btn min-h-[44px] px-3 py-2 text-xs col-span-2 sm:col-span-1">Batal</button>
          </div>
        </div>
      )}

      <ResponsiveList
        mobileCard={
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="neo-card p-4 animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-[#e8d8c9]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-[#e8d8c9]" />
                        <div className="h-3 w-36 rounded bg-[#e8d8c9]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-14 rounded-xl bg-[#e8d8c9]" />
                      <div className="h-14 rounded-xl bg-[#e8d8c9]" />
                      <div className="h-14 rounded-xl bg-[#e8d8c9]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pcs.length === 0 ? (
              <div className="neo-card p-6 text-center text-[#5a5a5a] min-h-[220px] flex flex-col items-center justify-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#1a1a1a] bg-[#f5ede6]">
                  <TbDeviceDesktop className="h-7 w-7 text-[#4b607f]" />
                </div>
                <p className="font-heading text-xl font-bold text-[#1a1a1a]">Tidak ada PC ditemukan</p>
                <p className="mt-1 text-sm">Coba ubah kata kunci, status agent, health, atau filter lab.</p>
              </div>
            ) : (
              pcs.map((pc) => (
                <MobileCard
                  key={pc.id}
                  title={
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedPCs.includes(pc.id)}
                        onChange={() => toggleSelect(pc.id)}
                        className="h-5 w-5 rounded shrink-0 accent-[#4b607f]"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#1a1a1a] bg-[#f5ede6] text-[#4b607f] shadow-[2px_2px_0px_rgba(26,26,26,0.18)]">
                        <TbDeviceDesktop className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-base font-black leading-tight">{pc.pcCode}</span>
                        <span className="block truncate text-xs font-medium text-[#5a5a5a]">{pc.name}</span>
                      </span>
                    </span>
                  }
                  subtitle={pc.lab?.name || "Belum ada lab"}
                  badge={
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${AGENT_STATUS_CONFIG[pc.agentStatus]?.bg} ${AGENT_STATUS_CONFIG[pc.agentStatus]?.color}`}>
                      {AGENT_STATUS_CONFIG[pc.agentStatus]?.label || pc.agentStatus}
                    </span>
                  }
                  fields={[
                    {
                      label: "Health",
                      value: (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${HEALTH_STATUS_CONFIG[pc.healthStatus]?.bg} ${HEALTH_STATUS_CONFIG[pc.healthStatus]?.color}`}>
                          {HEALTH_STATUS_CONFIG[pc.healthStatus]?.label || pc.healthStatus}
                        </span>
                      ),
                    },
                    {
                      label: "CPU",
                      value: <MiniBar value={pc.cpuUsage} />,
                    },
                    {
                      label: "RAM",
                      value: <MiniBar value={pc.ramUsage} />,
                    },
                    {
                      label: "Storage",
                      value: <MiniBar value={pc.storageUsage} />,
                    },
                    {
                      label: "IP Address",
                      value: <span className="font-mono text-xs">{pc.ipAddress || "-"}</span>,
                    },
                    {
                      label: "Last Seen",
                      value: formatRelativeTime(pc.lastSeen),
                    },
                  ]}
                  actions={[
                    {
                      label: "Detail",
                      icon: <TbChevronRight className="w-4 h-4" />,
                      onClick: () => openDetail(pc.id),
                      variant: "secondary",
                    },
                    {
                      label: "Command",
                      icon: <TbPower className="w-4 h-4" />,
                      onClick: () => openCommandModal(pc.id),
                      variant: "primary",
                    },
                  ]}
                  className="p-4 shadow-[3px_3px_0px_rgba(26,26,26,0.18)] active:scale-[0.99]"
                />
              ))
            )}
          </div>
        }
        desktopTable={
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
        }
      />

      {showDetail && detailPC && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row sm:justify-start">
          <div className="hidden sm:block flex-1 bg-black/40" onClick={() => setShowDetail(false)} />
          <div className="mx-2 w-[calc(100%-1rem)] sm:mx-0 sm:w-full sm:max-w-lg bg-[#f5ede6] shadow-[0px_-6px_20px_rgba(0,0,0,0.16)] sm:shadow-[-4px_0_20px_rgba(0,0,0,0.1)] overflow-y-auto max-h-[calc(100dvh-5.5rem)] sm:max-h-none rounded-t-3xl sm:rounded-none neo-border border-b-0 sm:border-b-2 pb-[calc(104px+env(safe-area-inset-bottom))] sm:pb-safe-bottom">
            <div className="sticky top-0 z-10 border-b-2 border-[#1a1a1a] bg-[#f5ede6]/95 px-4 pb-3 pt-2 backdrop-blur-md">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#1a1a1a]/30 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#1a1a1a] bg-white shadow-[2px_2px_0px_#1a1a1a]">
                    <TbDeviceDesktop className="h-6 w-6 text-[#4b607f]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#4b607f]">Detail PC</p>
                    <h2 className="font-heading text-lg sm:text-xl font-bold text-[#1a1a1a] leading-tight truncate max-w-[220px] sm:max-w-full">
                      {detailPC.pcCode}
                    </h2>
                    <p className="mt-0.5 truncate text-xs font-bold text-[#5a5a5a]">{detailPC.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${AGENT_STATUS_CONFIG[detailPC.agentStatus]?.bg} ${AGENT_STATUS_CONFIG[detailPC.agentStatus]?.color}`}>
                        {AGENT_STATUS_CONFIG[detailPC.agentStatus]?.label || detailPC.agentStatus}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${HEALTH_STATUS_CONFIG[detailPC.healthStatus]?.bg} ${HEALTH_STATUS_CONFIG[detailPC.healthStatus]?.color}`}>
                        {HEALTH_STATUS_CONFIG[detailPC.healthStatus]?.label || detailPC.healthStatus}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(false)} className="neo-btn p-2 min-w-[44px] min-h-[44px] flex shrink-0 items-center justify-center bg-white">
                  <TbX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Info Dasar</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
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

              <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Hardware</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
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

              <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <h3 className="font-bold text-xs text-[#1a1a1a] mb-3 uppercase tracking-wider">Resource Usage</h3>
                <div className="space-y-3">
                  <UsageBar value={detailPC.cpuUsage} label="CPU" />
                  <UsageBar value={detailPC.ramUsage} label="RAM" />
                  <UsageBar value={detailPC.storageUsage} label="Storage" />
                </div>
              </section>

              <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Agent Token</h3>
                {generatedToken ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="neo-input flex-1 font-mono text-xs min-h-[44px]"
                    />
                    <button onClick={copyToken} className="neo-btn min-h-[44px] px-3 py-2">
                      {copied ? <TbCheck className="w-4 h-4 text-green-600" /> : <TbCopy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => generateToken(detailPC.id)}
                    disabled={generatingToken}
                    className="neo-btn min-h-[48px] w-full px-4 py-3 bg-[#4b607f] text-white flex items-center justify-center gap-2 text-sm font-bold sm:w-auto"
                  >
                    {generatingToken ? <TbLoader2 className="w-4 h-4 animate-spin" /> : <TbKey className="w-4 h-4" />}
                    Generate Token Baru
                  </button>
                )}
                <p className="text-xs text-[#5a5a5a] mt-2 leading-relaxed">Token hanya ditampilkan sekali. Simpan sebelum menutup.</p>
              </section>

              {detailPC.warnings && detailPC.warnings.length > 0 && (
                <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                  <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Warnings</h3>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {detailPC.warnings.map((w: PcWarning) => (
                      <div key={w.id} className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                          <TbAlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-[#1a1a1a]">{w.warningType}</p>
                          <p className="mt-0.5 text-[11px] text-[#5a5a5a]">{w.isResolved ? "Resolved" : formatRelativeTime(w.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                          w.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
                          w.severity === "HIGH" ? "bg-orange-100 text-orange-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>{w.severity}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailPC.commands && detailPC.commands.length > 0 && (
                <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                  <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Command Terakhir</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {(detailPC.commands as unknown[]).filter(isCommandLite).slice(0, 5).map((cmd) => (
                      <div key={cmd.id} className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-[#f5ede6] px-3 py-2 text-xs">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white border border-[#1a1a1a]/10">
                          <TbPower className="h-4 w-4 text-[#4b607f]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-[#1a1a1a]">{COMMAND_OPTIONS.find((c) => c.value === cmd.command)?.label || cmd.command}</p>
                          <p className="mt-0.5 text-[11px] text-[#5a5a5a]">{formatRelativeTime(cmd.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                          cmd.status === "EXECUTED" ? "bg-green-100 text-green-700" :
                          cmd.status === "FAILED" ? "bg-red-100 text-red-700" :
                          cmd.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>{cmd.status}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailPC.agentLogs && detailPC.agentLogs.length > 0 && (
                <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                  <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Agent Logs</h3>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {detailPC.agentLogs.slice(0, 10).map((log: PcAgentLog) => (
                      <div key={log.id} className="flex min-h-[52px] items-center gap-3 rounded-2xl bg-[#f5ede6] px-3 py-2 text-xs">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          log.level === "ERROR" ? "bg-red-500" :
                          log.level === "WARNING" ? "bg-yellow-500" :
                          "bg-green-500"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black text-[#1a1a1a]">{log.eventType}</p>
                          {log.message && <p className="mt-0.5 truncate text-[11px] text-[#5a5a5a]">{log.message}</p>}
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-[#5a5a5a]">{formatRelativeTime(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailPC.statusLogs && detailPC.statusLogs.length > 0 && (
                <section className="rounded-3xl border-2 border-[#1a1a1a] bg-white p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.18)]">
                  <h3 className="font-bold text-xs text-[#1a1a1a] mb-2 uppercase tracking-wider">Status Logs</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {(detailPC.statusLogs as unknown[]).filter(isStatusLogLite).slice(0, 5).map((log) => (
                      <div key={log.id} className="flex min-h-[52px] items-center gap-2 rounded-2xl bg-[#f5ede6] px-3 py-2 text-xs">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${PC_STATUS_CONFIG[log.fromStatus]?.bg || "bg-gray-100"}`}>
                          {PC_STATUS_CONFIG[log.fromStatus]?.label || log.fromStatus}
                        </span>
                        <span className="font-black text-[#5a5a5a]">→</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${PC_STATUS_CONFIG[log.toStatus]?.bg || "bg-gray-100"}`}>
                          {PC_STATUS_CONFIG[log.toStatus]?.label || log.toStatus}
                        </span>
                        <span className="text-[#5a5a5a] ml-auto shrink-0 text-[11px] font-bold">{formatRelativeTime(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="sticky bottom-0 -mx-3 bg-[#f5ede6]/95 px-3 pb-4 pt-1 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <button
                  onClick={() => openCommandModal(detailPC.id)}
                  className="neo-btn w-full min-h-[48px] py-3 bg-[#4b607f] text-white font-bold flex items-center justify-center gap-2"
                >
                  <TbPower className="w-5 h-5" /> Kirim Command
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

      {showCommandModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setShowCommandModal(false)}>
          <div className="mx-auto w-full max-w-[calc(100vw-1.5rem)] bg-white neo-card shadow-[0px_-6px_20px_rgba(0,0,0,0.16)] sm:shadow-[6px_6px_0px_#1a1a1a] rounded-3xl sm:rounded-xl p-4 sm:p-6 max-h-[calc(100dvh-6rem)] sm:max-h-[90vh] overflow-y-auto pb-[calc(96px+env(safe-area-inset-bottom))] sm:max-w-md sm:pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#1a1a1a]/25 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold">Kirim Command</h3>
              <button onClick={() => setShowCommandModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0">
                <TbX className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#1a1a1a]">Pilih Command</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                  {COMMAND_OPTIONS.map((cmd) => (
                    <button
                      key={cmd.value}
                      onClick={() => setCommandType(cmd.value)}
                      className={`neo-btn min-h-[48px] px-3 py-2 text-xs flex items-center justify-center gap-2 ${
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
              <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 justify-end bg-white/95 px-4 pb-4 pt-2 backdrop-blur-sm sm:static sm:mx-0 sm:flex-row sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <button onClick={() => setShowCommandModal(false)} className="neo-btn px-4 py-2 min-h-[48px]">Batal</button>
                <button
                  onClick={confirmCommand}
                  disabled={!commandType}
                  className="neo-btn px-4 py-2 min-h-[48px] bg-[#f3701e] text-white font-bold disabled:opacity-50"
                >
                  <TbCheck className="w-4 h-4 inline mr-1" /> Konfirmasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white neo-card shadow-[0px_-6px_20px_rgba(0,0,0,0.16)] sm:shadow-[6px_6px_0px_#1a1a1a] rounded-t-3xl sm:rounded-xl rounded-b-none sm:rounded-b-xl w-full max-w-md p-4 sm:p-6 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold">Ubah Status {selectedPCs.length} PC</h3>
              <button onClick={() => setShowBulkModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0">
                <TbX className="w-5 h-5" />
              </button>
            </div>
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
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="neo-input w-full mt-1 min-h-[48px]">
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
          className="neo-input w-full mt-1 min-h-[48px]"
        />
      </div>
      <div className="flex flex-col-reverse gap-2 justify-end sm:flex-row">
        <button onClick={onCancel} className="neo-btn min-h-[48px]">Batal</button>
        <button onClick={() => onSubmit(status, reason)} className="neo-btn min-h-[48px] bg-[#4b607f] text-white">
          <TbCheck className="w-4 h-4 inline mr-1" /> Terapkan
        </button>
      </div>
    </div>
  );
}
