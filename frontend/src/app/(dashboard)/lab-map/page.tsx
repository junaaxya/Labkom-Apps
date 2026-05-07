"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TbDeviceDesktop, TbTicket, TbRefresh, TbLoader2 } from "react-icons/tb";
import api from "@/services/api";

type PCStatus = "AVAILABLE" | "IN_USE" | "BROKEN" | "MAINTENANCE" | "INACTIVE";

type AgentStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

interface Lab {
  id: string;
  name: string;
  capacity?: number;
  _count?: { pcs: number };
}

interface PCNode {
  id: string;
  pcCode: string;
  name: string;
  status: PCStatus;
  agentStatus?: AgentStatus;
  row: number;
  col: number;
  user?: string;
  lastIssue?: string;
}

const statusConfig: Record<PCStatus, { label: string; color: string; bg: string }> = {
  AVAILABLE: { label: "Tersedia", color: "#22c55e", bg: "bg-green-500" },
  IN_USE: { label: "Digunakan", color: "#4b607f", bg: "bg-[#4b607f]" },
  BROKEN: { label: "Rusak", color: "#ef4444", bg: "bg-red-500" },
  MAINTENANCE: { label: "Maintenance", color: "#eab308", bg: "bg-yellow-500" },
  INACTIVE: { label: "Nonaktif", color: "#9ca3af", bg: "bg-gray-400" },
};

const agentColorMap: Record<AgentStatus, string> = {
  ONLINE: "#3b82f6",
  OFFLINE: "#6b7280",
  UNKNOWN: "#9ca3af",
};

function getNodeColor(pc: PCNode): string {
  if (pc.agentStatus && pc.agentStatus !== "UNKNOWN") {
    if (pc.status === "BROKEN") return "#ef4444";
    if (pc.status === "MAINTENANCE") return "#eab308";
    return agentColorMap[pc.agentStatus];
  }
  return statusConfig[pc.status].color;
}

export default function LabMapPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [selectedPC, setSelectedPC] = useState<PCNode | null>(null);
  const [statusFilter, setStatusFilter] = useState<PCStatus | "ALL">("ALL");
  const [hoveredPC, setHoveredPC] = useState<PCNode | null>(null);
  const [pcs, setPcs] = useState<PCNode[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [pcTickets, setPcTickets] = useState<any[]>([]);

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    if (selectedLabId) fetchPCs();
  }, [selectedLabId]);

  const fetchLabs = async () => {
    setLoadingLabs(true);
    try {
      const res = await api.get<{ data: Lab[] }>("/labs");
      const labList = res.data || [];
      setLabs(labList);
      if (labList.length > 0 && !selectedLabId) {
        setSelectedLabId(labList[0].id);
      }
    } catch {
      setLabs([]);
    } finally {
      setLoadingLabs(false);
    }
  };

  const fetchPCs = async () => {
    if (!selectedLabId) return;
    setRefreshing(true);
    try {
      const labRes = await api.get<{ data: { pcs: any[] } }>(`/labs/${selectedLabId}`);
      const pcsData = labRes.data?.pcs || [];
      const cols = Math.min(Math.ceil(Math.sqrt(pcsData.length)), 6) || 4;
      const mapped: PCNode[] = pcsData.map((pc: any, idx: number) => ({
        id: pc.id,
        pcCode: pc.pcCode || `PC-${idx + 1}`,
        name: pc.name || `PC ${idx + 1}`,
        status: pc.status || "AVAILABLE",
        agentStatus: pc.agentStatus || undefined,
        row: Math.floor(idx / cols),
        col: idx % cols,
        user: pc.currentUser || undefined,
        lastIssue: pc.lastIssue || undefined,
      }));
      setPcs(mapped);
    } catch {
      setPcs([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePCClick = async (pc: PCNode) => {
    setSelectedPC(pc);
    try {
      const res = await api.get<{ data: any[] }>(`/tickets?pcId=${pc.id}&limit=5`);
      setPcTickets(res.data || []);
    } catch {
      setPcTickets([]);
    }
  };

  const filteredPCs = statusFilter === "ALL" ? pcs : pcs.filter((p) => p.status === statusFilter);
  const selectedLab = labs.find((l) => l.id === selectedLabId);
  const cols = Math.min(Math.ceil(Math.sqrt(pcs.length)), 6) || 4;

  const statusCounts = pcs.reduce(
    (acc, pc) => {
      acc[pc.status] = (acc[pc.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loadingLabs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <TbLoader2 className="animate-spin text-[#4b607f]" size={32} />
      </div>
    );
  }

  if (labs.length === 0) {
    return (
      <div className="p-6">
        <div className="neo-card p-12 text-center">
          <TbDeviceDesktop size={48} className="mx-auto text-[#5a5a5a] mb-4" />
          <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-2">Belum Ada Lab</h2>
          <p className="text-[#5a5a5a]">Tambahkan lab terlebih dahulu di halaman Manajemen Lab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-[#1a1a1a]">Denah Lab Interaktif</h1>
          <p className="text-sm text-[#5a5a5a] mt-1">Visualisasi posisi & status PC secara real-time</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchPCs}
          disabled={refreshing}
          className="neo-btn px-4 py-2.5 bg-[#4b607f] text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {refreshing ? <TbLoader2 className="animate-spin" size={18} /> : <TbRefresh size={18} strokeWidth={2.2} />}
          Refresh
        </motion.button>
      </div>

      <div className="flex flex-wrap gap-2">
        {labs.map((lab) => (
          <motion.button
            key={lab.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedLabId(lab.id)}
            className={`neo-btn px-5 py-2.5 font-bold text-sm transition-all duration-200 ${
              selectedLabId === lab.id
                ? "bg-[#4b607f] text-white shadow-[4px_4px_0px_#1a1a1a]"
                : "bg-white text-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] hover:shadow-[4px_4px_0px_#1a1a1a] hover:-translate-y-0.5"
            }`}
          >
            {lab.name} ({lab._count?.pcs ?? lab.capacity ?? 0} PC)
          </motion.button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-[#1a1a1a] transition-all ${
            statusFilter === "ALL" ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#f5ede6]"
          }`}
        >
          Semua ({pcs.length})
        </button>
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key as PCStatus)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-[#1a1a1a] transition-all ${
                statusFilter === key ? `${cfg.bg} text-white` : "bg-white text-[#1a1a1a] hover:bg-[#f5ede6]"
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="neo-card p-6 bg-white">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-lg font-bold text-[#1a1a1a]">
            Denah {selectedLab?.name || "Lab"}
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#3b82f6" }} /> Online</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#6b7280" }} /> Offline</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#eab308" }} /> Maintenance</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} /> Rusak</span>
          </div>
        </div>

        {pcs.length === 0 ? (
          <div className="text-center py-12">
            <TbDeviceDesktop size={40} className="mx-auto text-[#9ca3af] mb-3" />
            <p className="text-[#5a5a5a] font-medium">Belum ada PC di lab ini</p>
            <p className="text-xs text-[#9ca3af] mt-1">Tambahkan PC melalui halaman Manajemen Lab</p>
          </div>
        ) : (
          <div
            className="grid gap-3 mx-auto"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 120}px` }}
          >
            {filteredPCs.map((pc) => (
              <motion.div
                key={pc.id}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePCClick(pc)}
                onMouseEnter={() => setHoveredPC(pc)}
                onMouseLeave={() => setHoveredPC(null)}
                className="relative cursor-pointer"
              >
                <div
                  className="aspect-square rounded-xl border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:shadow-[4px_4px_0px_#1a1a1a]"
                  style={{ backgroundColor: getNodeColor(pc) }}
                >
                  <TbDeviceDesktop size={22} className="text-white" strokeWidth={2} />
                  <span className="text-[10px] font-bold text-white/90 leading-none">{pc.pcCode}</span>
                </div>
                {hoveredPC?.id === pc.id && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap z-50 shadow-lg">
                    {pc.name} • {statusConfig[pc.status].label}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPC && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPC(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card w-full max-w-md p-6 bg-white shadow-[6px_6px_0px_#1a1a1a]"
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-12 h-12 rounded-xl border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-center"
                  style={{ backgroundColor: getNodeColor(selectedPC) }}
                >
                  <TbDeviceDesktop size={24} className="text-white" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#1a1a1a]">{selectedPC.name}</h3>
                  <p className="text-xs text-[#5a5a5a] font-medium">{selectedPC.pcCode}</p>
                </div>
                <span
                  className="ml-auto px-3 py-1 rounded-lg text-xs font-bold text-white border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]"
                  style={{ backgroundColor: getNodeColor(selectedPC) }}
                >
                  {statusConfig[selectedPC.status].label}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-[#f5ede6] rounded-lg neo-border-sm">
                  <span className="text-xs font-bold text-[#5a5a5a] uppercase tracking-wider">Posisi</span>
                  <span className="text-sm font-bold text-[#1a1a1a]">Baris {selectedPC.row + 1}, Kolom {selectedPC.col + 1}</span>
                </div>
                {selectedPC.agentStatus && (
                  <div className="flex justify-between p-3 bg-[#f5ede6] rounded-lg neo-border-sm">
                    <span className="text-xs font-bold text-[#5a5a5a] uppercase tracking-wider">Agent</span>
                    <span className="text-sm font-bold text-[#4b607f]">{selectedPC.agentStatus}</span>
                  </div>
                )}
                {selectedPC.user && (
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg neo-border-sm border-blue-200">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Pengguna</span>
                    <span className="text-sm font-bold text-[#4b607f]">{selectedPC.user}</span>
                  </div>
                )}
                {selectedPC.lastIssue && (
                  <div className="flex justify-between p-3 bg-red-50 rounded-lg neo-border-sm border-red-200">
                    <span className="text-sm font-bold text-red-700 uppercase tracking-wider">Masalah</span>
                    <span className="text-sm font-bold text-red-600">{selectedPC.lastIssue}</span>
                  </div>
                )}
              </div>

              {pcTickets.length > 0 && (
                <div className="mt-6 pt-6 border-t-2 border-[#1a1a1a]">
                  <p className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TbTicket size={18} className="text-[#f3701e]" strokeWidth={2.2} /> Riwayat Tiket
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {pcTickets.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between text-sm p-3 bg-white neo-border-sm rounded-lg hover:bg-[#fcf8f4] transition-colors duration-200">
                        <span className="truncate flex-1 font-medium text-[#1a1a1a] pr-2">{t.title || t.description?.slice(0, 30)}</span>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold shadow-[1px_1px_0px_#1a1a1a] border-2 ${
                          t.status === "RESOLVED" ? "bg-green-100 text-green-700 border-green-700" :
                          t.status === "OPEN" ? "bg-red-100 text-red-700 border-red-700" : "bg-yellow-100 text-yellow-700 border-yellow-700"
                        }`}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-4 border-t-2 border-[#1a1a1a]">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPC(null)}
                  className="w-full sm:flex-1 py-3 bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] transition-colors duration-200 neo-btn font-bold text-sm"
                >
                  Tutup
                </motion.button>
                {selectedPC.status === "BROKEN" && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:flex-1 py-3 bg-[#f3701e] hover:bg-[#d95f10] transition-colors duration-200 text-white neo-btn font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <TbTicket size={18} strokeWidth={2.2} /> Buat Ticket
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
