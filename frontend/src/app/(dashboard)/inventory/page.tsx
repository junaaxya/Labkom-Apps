"use client";

import { useState, useEffect } from "react";
import {
  TbCpu,
  TbDeviceDesktop,
  TbEdit,
  TbLoader2,
  TbQrcode,
  TbRefresh,
  TbSearch,
  TbServer,
  TbX,
  TbCheck,
  TbDownload,
  TbWifi,
  TbWifiOff,
} from "react-icons/tb";
import api from "@/services/api";
import { MobileCard } from "@/components/ui/mobile-card";

interface InventoryPC {
  id: string;
  pcCode: string;
  name: string;
  specs: string | null;
  status: string;
  labId: string;
  parsedSpecs: {
    cpu?: string;
    ram?: string;
    storage?: string;
    os?: string;
    gpu?: string;
    monitor?: string;
    peripherals?: string[];
  };
  agentStatus?: "ONLINE" | "OFFLINE" | "UNKNOWN";
  isAgentInstalled?: boolean;
  cpuUsage?: number | null;
  ramUsage?: number | null;
  ramTotalGb?: number | null;
  storageUsage?: number | null;
  storageTotalGb?: number | null;
  hostname?: string | null;
  os?: string | null;
  lastSeen?: string | null;
}

interface InventoryData {
  totalPCs: number;
  inventory: InventoryPC[];
  aggregation: {
    ramCounts: Record<string, number>;
    cpuCounts: Record<string, number>;
    osCounts: Record<string, number>;
  };
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingPC, setEditingPC] = useState<InventoryPC | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    try {
      setLoading(true);
      const [inventoryRes, pcsRes] = await Promise.all([
        api.get<{ data: InventoryData }>("/pcs/inventory"),
        api.get<{ data: InventoryPC[] }>("/pcs").catch(() => ({ data: [] })),
      ]);

      const agentMap = new Map<string, InventoryPC>();
      const pcsData = Array.isArray(pcsRes.data) ? pcsRes.data : [];
      for (const pc of pcsData) {
        agentMap.set(pc.id, pc);
      }

      if (inventoryRes.data) {
        const merged: InventoryData = {
          ...inventoryRes.data,
          inventory: inventoryRes.data.inventory.map((pc) => {
            const live = agentMap.get(pc.id);
            if (!live) return pc;
            return {
              ...pc,
              agentStatus: live.agentStatus,
              isAgentInstalled: live.isAgentInstalled,
              cpuUsage: live.cpuUsage,
              ramUsage: live.ramUsage,
              ramTotalGb: live.ramTotalGb,
              storageUsage: live.storageUsage,
              storageTotalGb: live.storageTotalGb,
              hostname: live.hostname,
              os: live.os,
              lastSeen: live.lastSeen,
            };
          }),
        };
        setData(merged);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveSpecs(pcId: string, specs: any) {
    try {
      await api.post(`/pcs/${pcId}/specs`, { specs });
      setShowEditModal(false);
      fetchInventory();
    } catch {}
  }

  async function generateAllQR() {
    if (!data) return;
    setGeneratingQR(true);
    try {
      const labIds = [...new Set(data.inventory.map((pc) => pc.labId))];
      for (const labId of labIds) {
        await api.post("/pcs/bulk-qr", { labId });
      }
      fetchInventory();
    } catch {} finally {
      setGeneratingQR(false);
    }
  }

  const filtered = data?.inventory.filter((pc) =>
    pc.pcCode.toLowerCase().includes(search.toLowerCase()) ||
    pc.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">
            Hardware Inventory
          </h1>
          <p className="text-[#5a5a5a] mt-1 font-medium">Kelola spesifikasi dan QR code semua PC lab</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generateAllQR}
            disabled={generatingQR}
            className="neo-btn px-5 py-3 bg-white text-[#1a1a1a] flex items-center justify-center gap-2 font-bold"
          >
            {generatingQR ? <TbLoader2 className="w-5 h-5 animate-spin" /> : <TbQrcode className="w-5 h-5 text-[#4b607f]" />}
            Generate Semua QR
          </button>
          <button onClick={fetchInventory} className="neo-btn w-12 h-12 bg-white text-[#1a1a1a] flex items-center justify-center font-bold">
            <TbRefresh className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Aggregation Summary */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="neo-card p-5 bg-[#f5ede6]">
            <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2 text-[#1a1a1a]">
              <div className="w-8 h-8 rounded-full bg-[#4b607f] flex items-center justify-center neo-border-sm">
                <TbCpu className="w-5 h-5 text-white" />
              </div>
              Distribusi RAM
            </h3>
            <div className="space-y-3">
              {Object.entries(data.aggregation.ramCounts).length > 0 ? (
                Object.entries(data.aggregation.ramCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([ram, count]) => (
                    <div key={ram} className="flex justify-between items-center bg-white p-2 rounded neo-border-sm">
                      <span className="font-medium text-sm text-[#1a1a1a]">{ram}</span>
                      <span className="font-bold text-sm bg-[#e8d8c9] px-2 py-0.5 rounded text-[#1a1a1a]">{count} PC</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm font-medium text-[#5a5a5a] text-center py-4">Belum ada data RAM</p>
              )}
            </div>
          </div>
          <div className="neo-card p-5 bg-[#f5ede6]">
            <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2 text-[#1a1a1a]">
              <div className="w-8 h-8 rounded-full bg-[#f3701e] flex items-center justify-center neo-border-sm">
                <TbServer className="w-5 h-5 text-white" />
              </div>
              Distribusi Processor
            </h3>
            <div className="space-y-3">
              {Object.entries(data.aggregation.cpuCounts).length > 0 ? (
                Object.entries(data.aggregation.cpuCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cpu, count]) => (
                    <div key={cpu} className="flex justify-between items-center bg-white p-2 rounded neo-border-sm">
                      <span className="font-medium text-sm text-[#1a1a1a] truncate mr-2">{cpu}</span>
                      <span className="font-bold text-sm bg-[#e8d8c9] px-2 py-0.5 rounded text-[#1a1a1a] flex-shrink-0">{count} PC</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm font-medium text-[#5a5a5a] text-center py-4">Belum ada data CPU</p>
              )}
            </div>
          </div>
          <div className="neo-card p-5 bg-[#f5ede6]">
            <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2 text-[#1a1a1a]">
              <div className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center neo-border-sm">
                <TbDeviceDesktop className="w-5 h-5 text-white" />
              </div>
              Distribusi OS
            </h3>
            <div className="space-y-3">
              {Object.entries(data.aggregation.osCounts).length > 0 ? (
                Object.entries(data.aggregation.osCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([os, count]) => (
                    <div key={os} className="flex justify-between items-center bg-white p-2 rounded neo-border-sm">
                      <span className="font-medium text-sm text-[#1a1a1a]">{os}</span>
                      <span className="font-bold text-sm bg-[#e8d8c9] px-2 py-0.5 rounded text-[#1a1a1a]">{count} PC</span>
                    </div>
                  ))
              ) : (
                <p className="text-sm font-medium text-[#5a5a5a] text-center py-4">Belum ada data OS</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <TbSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a] w-5 h-5" />
        <input
          type="text"
          placeholder="Cari hardware PC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="neo-input pl-11 py-4 w-full text-sm font-medium focus:outline-none"
        />
      </div>

      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="neo-card p-10 text-center bg-white">
            <TbDeviceDesktop className="w-10 h-10 text-[#4b607f] mx-auto mb-3 opacity-50" />
            <p className="font-heading font-bold text-lg text-[#1a1a1a]">Tidak ada hardware PC</p>
            <p className="text-[#5a5a5a] text-sm mt-1">Coba sesuaikan kata kunci pencarian Anda.</p>
          </div>
        ) : (
          filtered.map((pc) => (
            <MobileCard
              key={pc.id}
              title={<span className="font-mono">{pc.pcCode}</span>}
              subtitle={pc.name}
              badge={
                pc.isAgentInstalled ? (
                  <span className={`inline-flex items-center gap-1.5 neo-badge px-2.5 py-1 text-[10px] font-bold ${
                    pc.agentStatus === "ONLINE" ? "bg-emerald-100 text-emerald-700" :
                    pc.agentStatus === "OFFLINE" ? "bg-gray-100 text-gray-600" :
                    "bg-gray-50 text-gray-400"
                  }`}>
                    {pc.agentStatus === "ONLINE" ? <TbWifi className="w-3 h-3" /> : <TbWifiOff className="w-3 h-3" />}
                    {pc.agentStatus || "UNKNOWN"}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#5a5a5a] italic">No Agent</span>
                )
              }
              fields={[
                {
                  label: "CPU",
                  value: (
                    <div>
                      <div className="text-xs">{pc.parsedSpecs?.cpu || pc.hostname || <span className="italic text-[#5a5a5a]">Belum diisi</span>}</div>
                      {pc.cpuUsage != null && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pc.cpuUsage > 80 ? "bg-red-500" : pc.cpuUsage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pc.cpuUsage, 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[#5a5a5a]">{pc.cpuUsage.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  label: "RAM",
                  value: (
                    <div>
                      <div className="text-xs">{pc.parsedSpecs?.ram || (pc.ramTotalGb ? `${pc.ramTotalGb} GB` : <span className="italic text-[#5a5a5a]">Belum diisi</span>)}</div>
                      {pc.ramUsage != null && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pc.ramUsage > 80 ? "bg-red-500" : pc.ramUsage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pc.ramUsage, 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[#5a5a5a]">{pc.ramUsage.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  label: "Storage",
                  value: (
                    <div>
                      <div className="text-xs">{pc.parsedSpecs?.storage || (pc.storageTotalGb ? `${pc.storageTotalGb} GB` : <span className="italic text-[#5a5a5a]">Belum diisi</span>)}</div>
                      {pc.storageUsage != null && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pc.storageUsage > 80 ? "bg-red-500" : pc.storageUsage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pc.storageUsage, 100)}%` }} />
                          </div>
                          <span className="text-[10px] font-bold text-[#5a5a5a]">{pc.storageUsage.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  label: "OS",
                  value: <span className="text-xs">{pc.parsedSpecs?.os || pc.os || <span className="italic text-[#5a5a5a]">Belum diisi</span>}</span>,
                },
                {
                  label: "Status",
                  value: (
                    <span className={`neo-badge px-2.5 py-1 ${
                      pc.status === "AVAILABLE" ? "status-available" :
                      pc.status === "BROKEN" ? "status-broken" :
                      pc.status === "MAINTENANCE" ? "status-maintenance" :
                      "status-inactive"
                    }`}>
                      {pc.status === "AVAILABLE" ? "Tersedia" : pc.status === "BROKEN" ? "Rusak" : pc.status === "MAINTENANCE" ? "Maint" : "Inactive"}
                    </span>
                  ),
                },
              ]}
              actions={[
                {
                  label: "Edit Spesifikasi",
                  icon: <TbEdit className="w-4 h-4" />,
                  onClick: () => { setEditingPC(pc); setShowEditModal(true); },
                  variant: "secondary",
                },
              ]}
            />
          ))
        )}
      </div>

      <div className="hidden lg:block neo-card overflow-hidden bg-white neo-border-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#e8d8c9] border-b-[3px] border-[#1a1a1a]">
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">Kode PC</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">Nama</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">Agent</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">CPU</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">RAM</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">Storage</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">OS</th>
                <th className="text-left p-4 font-heading font-bold text-[#1a1a1a]">Status</th>
                <th className="text-center p-4 font-heading font-bold text-[#1a1a1a]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pc) => (
                <tr key={pc.id} className="border-b-[2px] border-[#e8d8c9] hover:bg-[#f5ede6] transition-colors">
                  <td className="p-4 font-mono font-bold text-[#4b607f]">{pc.pcCode}</td>
                  <td className="p-4 font-medium text-[#1a1a1a]">{pc.name}</td>
                  <td className="p-4">
                    {pc.isAgentInstalled ? (
                      <span className={`inline-flex items-center gap-1.5 neo-badge px-2.5 py-1 text-[10px] font-bold ${
                        pc.agentStatus === "ONLINE" ? "bg-emerald-100 text-emerald-700" :
                        pc.agentStatus === "OFFLINE" ? "bg-gray-100 text-gray-600" :
                        "bg-gray-50 text-gray-400"
                      }`}>
                        {pc.agentStatus === "ONLINE" ? <TbWifi className="w-3 h-3" /> : <TbWifiOff className="w-3 h-3" />}
                        {pc.agentStatus || "UNKNOWN"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#5a5a5a] italic">No Agent</span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-medium">
                    <div>{pc.parsedSpecs?.cpu || pc.hostname || <span className="text-[#5a5a5a] italic">Belum diisi</span>}</div>
                    {(pc.cpuUsage !== null && pc.cpuUsage !== undefined) && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pc.cpuUsage > 80 ? "bg-red-500" : pc.cpuUsage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pc.cpuUsage, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[#5a5a5a]">{pc.cpuUsage.toFixed(0)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-xs font-medium">
                    <div>{pc.parsedSpecs?.ram || (pc.ramTotalGb ? `${pc.ramTotalGb} GB` : <span className="text-[#5a5a5a] italic">Belum diisi</span>)}</div>
                    {(pc.ramUsage !== null && pc.ramUsage !== undefined) && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pc.ramUsage > 80 ? "bg-red-500" : pc.ramUsage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pc.ramUsage, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[#5a5a5a]">{pc.ramUsage.toFixed(0)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-xs font-medium">
                    <div>{pc.parsedSpecs?.storage || (pc.storageTotalGb ? `${pc.storageTotalGb} GB` : <span className="text-[#5a5a5a] italic">Belum diisi</span>)}</div>
                    {(pc.storageUsage !== null && pc.storageUsage !== undefined) && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pc.storageUsage > 80 ? "bg-red-500" : pc.storageUsage > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pc.storageUsage, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[#5a5a5a]">{pc.storageUsage.toFixed(0)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-xs font-medium">{pc.parsedSpecs?.os || pc.os || <span className="text-[#5a5a5a] italic">Belum diisi</span>}</td>
                  <td className="p-4">
                    <span className={`neo-badge px-2.5 py-1 ${
                      pc.status === "AVAILABLE" ? "status-available" :
                      pc.status === "BROKEN" ? "status-broken" :
                      pc.status === "MAINTENANCE" ? "status-maintenance" :
                      "status-inactive"
                    }`}>
                      {pc.status === "AVAILABLE" ? "Tersedia" : pc.status === "BROKEN" ? "Rusak" : pc.status === "MAINTENANCE" ? "Maint" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => { setEditingPC(pc); setShowEditModal(true); }}
                      className="w-8 h-8 mx-auto bg-white neo-btn flex items-center justify-center hover:bg-[#f3701e] hover:text-white transition-colors"
                      title="Edit Spesifikasi"
                    >
                      <TbEdit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <TbDeviceDesktop className="w-12 h-12 text-[#4b607f] mx-auto mb-3 opacity-50" />
                    <p className="font-heading font-bold text-lg text-[#1a1a1a]">Tidak ada hardware PC</p>
                    <p className="text-[#5a5a5a] text-sm mt-1">Coba sesuaikan kata kunci pencarian Anda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Specs Modal */}
      {showEditModal && editingPC && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white neo-card shadow-[6px_6px_0px_#1a1a1a] rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 pb-4 border-b-[3px] border-[#e8d8c9]">
              <div>
                <h3 className="text-xl font-heading font-bold text-[#1a1a1a]">Edit Spesifikasi</h3>
                <p className="text-sm font-medium text-[#4b607f] mt-1">{editingPC.pcCode} - {editingPC.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white neo-btn hover:bg-[#ef4444] hover:text-white transition-colors flex-shrink-0">
                <TbX className="w-5 h-5" />
              </button>
            </div>
            <SpecsForm
              initialSpecs={editingPC.parsedSpecs}
              onSave={(specs) => saveSpecs(editingPC.id, specs)}
              onCancel={() => setShowEditModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SpecsForm({
  initialSpecs,
  onSave,
  onCancel,
}: {
  initialSpecs: any;
  onSave: (specs: any) => void;
  onCancel: () => void;
}) {
  const [cpu, setCpu] = useState(initialSpecs?.cpu || "");
  const [ram, setRam] = useState(initialSpecs?.ram || "");
  const [storage, setStorage] = useState(initialSpecs?.storage || "");
  const [os, setOs] = useState(initialSpecs?.os || "");
  const [gpu, setGpu] = useState(initialSpecs?.gpu || "");
  const [monitor, setMonitor] = useState(initialSpecs?.monitor || "");

  function handleSave() {
    const specs: any = {};
    if (cpu) specs.cpu = cpu;
    if (ram) specs.ram = ram;
    if (storage) specs.storage = storage;
    if (os) specs.os = os;
    if (gpu) specs.gpu = gpu;
    if (monitor) specs.monitor = monitor;
    onSave(specs);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-bold text-[#1a1a1a] mb-1.5 block">Processor (CPU)</label>
        <input value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="e.g. Intel Core i5-10400" className="neo-input w-full py-3 px-4 text-sm" />
      </div>
      <div>
        <label className="text-sm font-bold text-[#1a1a1a] mb-1.5 block">RAM</label>
        <input value={ram} onChange={(e) => setRam(e.target.value)} placeholder="e.g. 8GB DDR4" className="neo-input w-full py-3 px-4 text-sm" />
      </div>
      <div>
        <label className="text-sm font-bold text-[#1a1a1a] mb-1.5 block">Storage</label>
        <input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="e.g. 256GB NVMe SSD" className="neo-input w-full py-3 px-4 text-sm" />
      </div>
      <div>
        <label className="text-sm font-bold text-[#1a1a1a] mb-1.5 block">Sistem Operasi</label>
        <input value={os} onChange={(e) => setOs(e.target.value)} placeholder="e.g. Windows 11 Pro 64-bit" className="neo-input w-full py-3 px-4 text-sm" />
      </div>
      <div>
        <label className="text-sm font-bold text-[#1a1a1a] mb-1.5 block">GPU <span className="text-[#5a5a5a] font-normal">(opsional)</span></label>
        <input value={gpu} onChange={(e) => setGpu(e.target.value)} placeholder="e.g. NVIDIA GTX 1650 4GB" className="neo-input w-full py-3 px-4 text-sm" />
      </div>
      <div>
        <label className="text-sm font-bold text-[#1a1a1a] mb-1.5 block">Monitor <span className="text-[#5a5a5a] font-normal">(opsional)</span></label>
        <input value={monitor} onChange={(e) => setMonitor(e.target.value)} placeholder="e.g. LG 24inch FHD 75Hz" className="neo-input w-full py-3 px-4 text-sm" />
      </div>
      <div className="flex gap-3 pt-4 border-t-[3px] border-[#e8d8c9] mt-2">
        <button onClick={handleSave} className="flex-1 py-3 bg-[#4b607f] text-white neo-btn flex items-center justify-center font-bold">
          <TbCheck className="w-5 h-5 mr-2" /> Simpan
        </button>
        <button onClick={onCancel} className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn font-bold">
          Batal
        </button>
      </div>
    </div>
  );
}
