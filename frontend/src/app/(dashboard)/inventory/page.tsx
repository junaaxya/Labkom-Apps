"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  TbArchive,
  TbBox,
  TbDeviceDesktop,
  TbEdit,
  TbLink,
  TbLoader2,
  TbPlus,
  TbRefresh,
  TbSearch,
  TbTool,
  TbTrash,
  TbX,
} from "react-icons/tb";
import { MobileCard } from "@/components/ui/mobile-card";
import api from "@/services/api";
import type { User } from "@/types";

type AssetCategory = "PC" | "MONITOR" | "KEYBOARD" | "MOUSE" | "PROJECTOR" | "NETWORKING" | "FURNITURE" | "AC" | "ELECTRICAL" | "TOOL" | "CONSUMABLE" | "OTHER";
type AssetCondition = "GOOD" | "NEEDS_REPAIR" | "BROKEN" | "LOST" | "RETIRED";
type AssetStatus = "ACTIVE" | "IN_MAINTENANCE" | "BORROWED" | "STORED" | "DISPOSED";

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: AssetCategory;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  location?: string | null;
  labId?: string | null;
  lab?: { id: string; name: string; location?: string | null } | null;
  pcId?: string | null;
  pc?: { id: string; pcCode: string; name: string; agentStatus?: string; healthStatus?: string; qrCode?: string | null } | null;
  acquisitionDate?: string | null;
  warrantyUntil?: string | null;
  purchaseSource?: string | null;
  purchasePrice?: number | string | null;
  fundingSource?: string | null;
  notes?: string | null;
}

interface AssetSummary {
  total: number;
  byCategory: Record<string, number>;
  byCondition: Record<string, number>;
  byStatus: Record<string, number>;
  warrantyExpiringSoon: number;
  pcLinked: number;
}

type AssetForm = {
  id?: string;
  assetCode: string;
  name: string;
  category: AssetCategory;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  condition: AssetCondition;
  status: AssetStatus;
  location: string;
  notes: string;
  acquisitionDate: string;
  warrantyUntil: string;
  purchaseSource: string;
  purchasePrice: string;
  fundingSource: string;
};

const categories: AssetCategory[] = ["PC", "MONITOR", "KEYBOARD", "MOUSE", "PROJECTOR", "NETWORKING", "FURNITURE", "AC", "ELECTRICAL", "TOOL", "CONSUMABLE", "OTHER"];
const conditions: AssetCondition[] = ["GOOD", "NEEDS_REPAIR", "BROKEN", "LOST", "RETIRED"];
const statuses: AssetStatus[] = ["ACTIVE", "IN_MAINTENANCE", "BORROWED", "STORED", "DISPOSED"];

const emptyForm: AssetForm = {
  assetCode: "",
  name: "",
  category: "OTHER",
  type: "",
  brand: "",
  model: "",
  serialNumber: "",
  condition: "GOOD",
  status: "ACTIVE",
  location: "",
  notes: "",
  acquisitionDate: "",
  warrantyUntil: "",
  purchaseSource: "",
  purchasePrice: "",
  fundingSource: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toForm(asset: Asset): AssetForm {
  return {
    id: asset.id,
    assetCode: asset.assetCode,
    name: asset.name,
    category: asset.category,
    type: asset.type || "",
    brand: asset.brand || "",
    model: asset.model || "",
    serialNumber: asset.serialNumber || "",
    condition: asset.condition,
    status: asset.status,
    location: asset.location || "",
    notes: asset.notes || "",
    acquisitionDate: toDateInput(asset.acquisitionDate),
    warrantyUntil: toDateInput(asset.warrantyUntil),
    purchaseSource: asset.purchaseSource || "",
    purchasePrice: asset.purchasePrice === null || asset.purchasePrice === undefined ? "" : String(asset.purchasePrice),
    fundingSource: asset.fundingSource || "",
  };
}

function toPayload(form: AssetForm, canManageProcurement: boolean) {
  const payload: Record<string, unknown> = {
    assetCode: form.assetCode,
    name: form.name,
    category: form.category,
    type: form.type || null,
    brand: form.brand || null,
    model: form.model || null,
    serialNumber: form.serialNumber || null,
    condition: form.condition,
    status: form.status,
    location: form.location || null,
    notes: form.notes || null,
  };
  if (canManageProcurement) {
    payload.acquisitionDate = form.acquisitionDate ? new Date(form.acquisitionDate).toISOString() : null;
    payload.warrantyUntil = form.warrantyUntil ? new Date(form.warrantyUntil).toISOString() : null;
    payload.purchaseSource = form.purchaseSource || null;
    payload.purchasePrice = form.purchasePrice ? Number(form.purchasePrice) : null;
    payload.fundingSource = form.fundingSource || null;
  }
  return payload;
}

export default function InventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [user] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("user");
    return storedUser ? (JSON.parse(storedUser) as User) : null;
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | AssetCategory>("ALL");
  const [conditionFilter, setConditionFilter] = useState<"ALL" | AssetCondition>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AssetStatus>("ALL");
  const [form, setForm] = useState<AssetForm | null>(null);
  const [maintenanceAsset, setMaintenanceAsset] = useState<Asset | null>(null);
  const [maintenanceTitle, setMaintenanceTitle] = useState("");

  const canManageAssets = user?.role === "KOORDINATOR_LAB" || user?.role === "ASISTEN_LAB";
  const canManageProcurement = user?.role === "KOORDINATOR_LAB";

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const [assetRes, summaryRes] = await Promise.all([
        api.get<{ data: { assets: Asset[] } }>("/assets?limit=100"),
        api.get<{ data: AssetSummary }>("/assets/summary"),
      ]);
      setAssets(assetRes.data.assets || []);
      setSummary(summaryRes.data);
    } catch (err) {
      setError(getErrorMessage(err, "Gagal memuat data aset"));
    } finally {
      setLoading(false);
    }
  }

  const filteredAssets = useMemo(() => {
    const query = search.toLowerCase();
    return assets.filter((asset) => {
      const searchable = [asset.assetCode, asset.name, asset.serialNumber, asset.brand, asset.model, asset.type, asset.lab?.name, asset.pc?.pcCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        searchable.includes(query) &&
        (categoryFilter === "ALL" || asset.category === categoryFilter) &&
        (conditionFilter === "ALL" || asset.condition === conditionFilter) &&
        (statusFilter === "ALL" || asset.status === statusFilter)
      );
    });
  }, [assets, categoryFilter, conditionFilter, search, statusFilter]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      setSubmitting(true);
      setError(null);
      const payload = toPayload(form, canManageProcurement);
      if (form.id) await api.patch(`/assets/${form.id}`, payload);
      else await api.post("/assets", payload);
      setForm(null);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menyimpan aset"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Arsipkan aset ini? Data PC terkait tidak akan dihapus.")) return;
    try {
      setSubmitting(true);
      setError(null);
      await api.delete(`/assets/${id}`);
      setForm(null);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal mengarsipkan aset"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMaintenance(event: FormEvent) {
    event.preventDefault();
    if (!maintenanceAsset) return;
    try {
      setSubmitting(true);
      setError(null);
      await api.post(`/assets/${maintenanceAsset.id}/maintenance`, {
        title: maintenanceTitle,
        status: "IN_MAINTENANCE",
      });
      setMaintenanceAsset(null);
      setMaintenanceTitle("");
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Gagal menambah catatan maintenance"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && assets.length === 0) {
    return <div className="flex justify-center py-20"><TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" /></div>;
  }

  if (user && !canManageAssets) {
    return <div className="neo-card p-6 bg-white text-[#1a1a1a] font-bold">Inventory aset hanya untuk Koordinator Lab dan Asisten Lab.</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Inventory Aset Lab</h1>
          <p className="text-[#5a5a5a] mt-1 font-medium">Data aset profesional terpisah dari PC Monitoring dan QR PC.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManageProcurement && <button onClick={() => setForm(emptyForm)} className="neo-btn px-5 py-3 bg-[#f3701e] text-white flex items-center justify-center gap-2 font-bold"><TbPlus className="w-5 h-5" />Tambah Aset</button>}
          <button onClick={fetchData} className="neo-btn w-12 h-12 bg-white text-[#1a1a1a] flex items-center justify-center font-bold" aria-label="Refresh"><TbRefresh className="w-5 h-5" /></button>
        </div>
      </div>

      {error && <div className="neo-card p-4 bg-red-50 text-red-700 font-bold border-red-500">{error}</div>}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={<TbBox className="w-5 h-5 text-white" />} label="Total Aset" value={summary.total} tone="bg-[#4b607f]" />
          <SummaryCard icon={<TbTool className="w-5 h-5 text-white" />} label="Perlu Perbaikan" value={(summary.byCondition.NEEDS_REPAIR || 0) + (summary.byCondition.BROKEN || 0)} tone="bg-[#f3701e]" />
          <SummaryCard icon={<TbDeviceDesktop className="w-5 h-5 text-white" />} label="Terhubung PC" value={summary.pcLinked} tone="bg-[#1a1a1a]" />
          <SummaryCard icon={<TbArchive className="w-5 h-5 text-white" />} label="Garansi < 30 Hari" value={summary.warrantyExpiringSoon} tone="bg-[#5a5a5a]" />
        </div>
      )}

      <div className="neo-card p-4 bg-white grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-1">
          <TbSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] w-5 h-5" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="neo-input w-full pl-10 py-3 text-sm" placeholder="Cari kode, nama, serial, lab..." />
        </div>
        <SelectFilter value={categoryFilter} onChange={(value) => setCategoryFilter(value as "ALL" | AssetCategory)} options={categories} label="Semua Kategori" />
        <SelectFilter value={conditionFilter} onChange={(value) => setConditionFilter(value as "ALL" | AssetCondition)} options={conditions} label="Semua Kondisi" />
        <SelectFilter value={statusFilter} onChange={(value) => setStatusFilter(value as "ALL" | AssetStatus)} options={statuses} label="Semua Status" />
      </div>

      <div className="md:hidden space-y-4">
        {filteredAssets.map((asset) => <AssetCard key={asset.id} asset={asset} onEdit={() => setForm(toForm(asset))} onMaintenance={() => { setMaintenanceAsset(asset); setMaintenanceTitle(`Maintenance ${asset.assetCode}`); }} />)}
        {filteredAssets.length === 0 && <EmptyState />}
      </div>

      <div className="hidden md:block neo-card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f5ede6] border-b-[3px] border-[#e8d8c9] text-[#1a1a1a]">
              <tr>
                <th className="p-4 font-bold">Kode</th>
                <th className="p-4 font-bold">Aset</th>
                <th className="p-4 font-bold">Lab/Lokasi</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Kondisi</th>
                <th className="p-4 font-bold">PC</th>
                <th className="p-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#e8d8c9]">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-[#f5ede6]/40">
                  <td className="p-4 font-mono font-bold text-[#1a1a1a]">{asset.assetCode}</td>
                  <td className="p-4"><div className="font-bold text-[#1a1a1a]">{asset.name}</div><div className="text-xs text-[#5a5a5a]">{asset.category} {asset.brand || asset.model ? `- ${[asset.brand, asset.model].filter(Boolean).join(" ")}` : ""}</div></td>
                  <td className="p-4 text-[#1a1a1a]">{asset.lab?.name || asset.location || "-"}</td>
                  <td className="p-4"><Badge value={asset.status} /></td>
                  <td className="p-4"><Badge value={asset.condition} /></td>
                  <td className="p-4">{asset.pcId ? <Link href={`/pc-monitoring?search=${asset.pc?.pcCode || ""}`} className="inline-flex items-center gap-1 font-bold text-[#4b607f] underline"><TbLink />{asset.pc?.pcCode || "PC"}</Link> : "-"}</td>
                  <td className="p-4"><div className="flex items-center justify-center gap-2"><IconButton label="Edit" onClick={() => setForm(toForm(asset))} icon={<TbEdit />} /><IconButton label="Maintenance" onClick={() => { setMaintenanceAsset(asset); setMaintenanceTitle(`Maintenance ${asset.assetCode}`); }} icon={<TbTool />} /></div></td>
                </tr>
              ))}
              {filteredAssets.length === 0 && <tr><td colSpan={7}><EmptyState /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && <AssetModal form={form} setForm={setForm} onSubmit={handleSave} onClose={() => setForm(null)} onDelete={handleDelete} submitting={submitting} canManageProcurement={canManageProcurement} />}
      {maintenanceAsset && <MaintenanceModal asset={maintenanceAsset} title={maintenanceTitle} setTitle={setMaintenanceTitle} onSubmit={handleMaintenance} onClose={() => setMaintenanceAsset(null)} submitting={submitting} />}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="neo-card p-5 bg-white"><div className="flex items-center gap-3 mb-2"><div className={`w-9 h-9 rounded-full ${tone} flex items-center justify-center neo-border-sm`}>{icon}</div><h3 className="font-heading font-bold text-[#1a1a1a]">{label}</h3></div><p className="text-3xl font-bold text-[#1a1a1a]">{value}</p></div>;
}

function SelectFilter({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="neo-input py-3 px-4 text-sm bg-white"><option value="ALL">{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function Badge({ value }: { value: string }) {
  const tone = value === "ACTIVE" || value === "GOOD" ? "bg-green-100 text-green-800" : value.includes("REPAIR") || value.includes("BROKEN") || value.includes("MAINTENANCE") ? "bg-orange-100 text-orange-800" : "bg-[#e8d8c9] text-[#1a1a1a]";
  return <span className={`inline-flex px-2.5 py-1 rounded neo-border-sm text-xs font-bold ${tone}`}>{value}</span>;
}

function IconButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return <button onClick={onClick} className="w-9 h-9 flex items-center justify-center bg-white neo-border-sm hover:bg-[#f5ede6] text-[#1a1a1a]" title={label} aria-label={label}>{icon}</button>;
}

function AssetCard({ asset, onEdit, onMaintenance }: { asset: Asset; onEdit: () => void; onMaintenance: () => void }) {
  return (
    <MobileCard
      title={asset.name}
      subtitle={asset.assetCode}
      badge={<Badge value={asset.status} />}
      fields={[
        { label: "Kategori", value: asset.category },
        { label: "Lab/Lokasi", value: asset.lab?.name || asset.location || "-" },
        { label: "Kondisi", value: asset.condition },
        {
          label: "PC Terhubung",
          value: asset.pcId ? (
            <Link href={`/pc-monitoring?search=${asset.pc?.pcCode || ""}`} className="inline-flex items-center gap-1 font-bold text-[#4b607f] underline">
              <TbLink />
              {asset.pc?.pcCode || "PC"}
            </Link>
          ) : "-",
        },
      ]}
      actions={[
        { label: "Edit", icon: <TbEdit />, onClick: onEdit, variant: "secondary" },
        { label: "Maintenance", icon: <TbTool />, onClick: onMaintenance, variant: "warning" },
      ]}
    />
  );
}

function EmptyState() {
  return <div className="text-center py-10 bg-white neo-card text-[#5a5a5a] font-bold">Tidak ada aset yang ditemukan</div>;
}

function AssetModal({ form, setForm, onSubmit, onClose, onDelete, submitting, canManageProcurement }: { form: AssetForm; setForm: (form: AssetForm) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; onDelete: (id: string) => void; submitting: boolean; canManageProcurement: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"><div className="neo-card w-full max-w-full sm:max-w-3xl bg-white max-h-[92vh] flex flex-col"><div className="flex justify-between items-center p-4 sm:p-5 border-b-[3px] border-[#1a1a1a]"><h2 className="font-heading text-xl font-bold text-[#1a1a1a]">{form.id ? "Edit Aset" : "Tambah Aset"}</h2><button onClick={onClose} className="w-10 h-10 flex items-center justify-center"><TbX className="w-6 h-6" /></button></div><form id="asset-form" onSubmit={onSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><TextInput label="Kode Aset" value={form.assetCode} onChange={(value) => setForm({ ...form, assetCode: value })} required /><TextInput label="Nama Aset" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><SelectInput label="Kategori" value={form.category} options={categories} onChange={(value) => setForm({ ...form, category: value as AssetCategory })} /><TextInput label="Tipe" value={form.type} onChange={(value) => setForm({ ...form, type: value })} /><TextInput label="Brand" value={form.brand} onChange={(value) => setForm({ ...form, brand: value })} /><TextInput label="Model" value={form.model} onChange={(value) => setForm({ ...form, model: value })} /><TextInput label="Serial Number" value={form.serialNumber} onChange={(value) => setForm({ ...form, serialNumber: value })} /><TextInput label="Lokasi Detail" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><SelectInput label="Status" value={form.status} options={statuses} onChange={(value) => setForm({ ...form, status: value as AssetStatus })} /><SelectInput label="Kondisi" value={form.condition} options={conditions} onChange={(value) => setForm({ ...form, condition: value as AssetCondition })} /></div><label className="block"><span className="text-sm font-bold text-[#1a1a1a] mb-1 block">Catatan</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="neo-input w-full p-3 text-sm min-h-24" /></label>{canManageProcurement && <div className="pt-4 border-t-[3px] border-[#e8d8c9]"><h3 className="font-heading font-bold text-lg mb-3 text-[#1a1a1a]">Informasi Pengadaan</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><TextInput type="date" label="Tanggal Pembelian" value={form.acquisitionDate} onChange={(value) => setForm({ ...form, acquisitionDate: value })} /><TextInput type="date" label="Garansi Sampai" value={form.warrantyUntil} onChange={(value) => setForm({ ...form, warrantyUntil: value })} /><TextInput label="Sumber Pembelian" value={form.purchaseSource} onChange={(value) => setForm({ ...form, purchaseSource: value })} /><TextInput label="Sumber Dana" value={form.fundingSource} onChange={(value) => setForm({ ...form, fundingSource: value })} /><TextInput type="number" label="Harga Pembelian" value={form.purchasePrice} onChange={(value) => setForm({ ...form, purchasePrice: value })} /></div></div>}</form><div className="p-4 sm:p-5 border-t-[3px] border-[#1a1a1a] grid grid-cols-2 sm:flex gap-2 bg-[#f5ede6] pb-[calc(1rem+env(safe-area-inset-bottom))]"><button type="button" onClick={onClose} className="neo-btn px-3 py-2.5 min-h-[44px] bg-white text-[#1a1a1a] text-sm font-bold">Batal</button>{canManageProcurement && form.id && <button type="button" onClick={() => onDelete(form.id!)} className="neo-btn px-3 py-2.5 min-h-[44px] bg-red-600 text-white text-sm font-bold"><TbTrash className="inline mr-1" />Arsip</button>}<button form="asset-form" type="submit" disabled={submitting} className="neo-btn px-3 py-2.5 min-h-[44px] bg-[#4b607f] text-white text-sm font-bold sm:ml-auto">{submitting ? "Menyimpan..." : "Simpan"}</button></div></div></div>;
}

function MaintenanceModal({ asset, title, setTitle, onSubmit, onClose, submitting }: { asset: Asset; title: string; setTitle: (title: string) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; submitting: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="neo-card w-full max-w-md bg-white"><div className="p-5 border-b-[3px] border-[#1a1a1a]"><h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Catatan Maintenance</h2><p className="text-sm font-medium text-[#5a5a5a]">{asset.assetCode} - {asset.name}</p></div><form onSubmit={onSubmit} className="p-5 space-y-4"><TextInput label="Judul" value={title} onChange={setTitle} required /><div className="flex gap-2"><button type="button" onClick={onClose} className="neo-btn flex-1 py-2.5 bg-white text-[#1a1a1a] font-bold">Batal</button><button disabled={submitting} className="neo-btn flex-1 py-2.5 bg-[#4b607f] text-white font-bold">Simpan</button></div></form></div></div>;
}

function TextInput({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="block"><span className="text-sm font-bold text-[#1a1a1a] mb-1 block">{label}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="neo-input w-full p-3 text-sm" /></label>;
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-sm font-bold text-[#1a1a1a] mb-1 block">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="neo-input w-full p-3 text-sm bg-white">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
