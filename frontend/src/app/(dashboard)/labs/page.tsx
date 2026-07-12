"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  TbBuilding,
  TbCalendar,
  TbChevronRight,
  TbDeviceDesktop,
  TbEdit,
  TbFilter,
  TbLoader2,
  TbMapPin,
  TbPlus,
  TbSearch,
  TbTrash,
  TbUsers,
  TbX,
} from "react-icons/tb";
import type { Lab } from "@/types";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

type LabWithCount = Lab & { _count?: { pcs: number; schedules: number } };

type LabForm = {
  name: string;
  location: string;
  description: string;
  capacity: string;
  isPicketEnabled: boolean;
  defaultPicketAssistantCount: string;
};

type LabStatusFilter = "ALL" | Lab["status"];

export default function LabsPage() {
  const toast = useToast();
  const [labs, setLabs] = useState<LabWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingLabId, setDeletingLabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LabStatusFilter>("ALL");

  const [newLab, setNewLab] = useState<LabForm>({
    name: "",
    location: "",
    description: "",
    capacity: "",
    isPicketEnabled: false,
    defaultPicketAssistantCount: "1",
  });
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [editLab, setEditLab] = useState<LabForm & { status: Lab["status"] }>({
    name: "",
    location: "",
    description: "",
    capacity: "",
    status: "ACTIVE",
    isPicketEnabled: false,
    defaultPicketAssistantCount: "1",
  });

  const statusColor: Record<string, string> = {
    ACTIVE: "status-available",
    INACTIVE: "status-inactive",
    MAINTENANCE: "status-maintenance",
  };

  const statusLabel: Record<string, string> = {
    ACTIVE: "Aktif",
    INACTIVE: "Tidak Aktif",
    MAINTENANCE: "Maintenance",
  };

  const fetchLabs = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await api.get<{ success: boolean; data: LabWithCount[] }>("/labs");
      setLabs(response.data ?? []);
    } catch (err) {
      toast.error(errMsg(err, "Gagal memuat data lab"));
      setLabs([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchLabs();
    });
  }, [fetchLabs]);

  const resetCreateForm = () => {
    setNewLab({
      name: "",
      location: "",
      description: "",
      capacity: "",
      isPicketEnabled: false,
      defaultPicketAssistantCount: "1",
    });
  };

  const handleCreateLab = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const capacity = Number(newLab.capacity);
      if (newLab.capacity.trim() !== "" && (!Number.isFinite(capacity) || capacity < 0)) {
        toast.error("Kapasitas minimal 0");
        return;
      }

      await api.post<{ success: boolean; data: LabWithCount }>("/labs", {
        name: newLab.name.trim(),
        location: newLab.location.trim(),
        description: newLab.description.trim(),
        capacity: Number.isFinite(capacity) && capacity >= 0 ? Math.floor(capacity) : 0,
        isPicketEnabled: newLab.isPicketEnabled,
        defaultPicketAssistantCount: Math.min(50, Math.max(1, Number(newLab.defaultPicketAssistantCount) || 1)),
      });

      setShowCreateModal(false);
      resetCreateForm();
      await fetchLabs();
      toast.success("Lab berhasil dibuat.");
    } catch (err) {
      toast.error(errMsg(err, "Gagal membuat lab"));
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (lab: LabWithCount) => {
    setEditingLabId(lab.id);
    setEditLab({
      name: lab.name,
      location: lab.location,
      description: lab.description ?? "",
      capacity: String(lab.capacity),
      status: lab.status,
      isPicketEnabled: lab.isPicketEnabled,
      defaultPicketAssistantCount: String(lab.defaultPicketAssistantCount),
    });
    setShowEditModal(true);
  };

  const handleEditLab = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLabId) return;

    setIsEditing(true);

    try {
      const capacity = Number(editLab.capacity);
      if (editLab.capacity.trim() !== "" && (!Number.isFinite(capacity) || capacity < 0)) {
        toast.error("Kapasitas minimal 0");
        return;
      }

      await api.put<{ success: boolean; data: LabWithCount }>(`/labs/${editingLabId}`, {
        name: editLab.name.trim(),
        location: editLab.location.trim(),
        description: editLab.description.trim(),
        capacity: Number.isFinite(capacity) && capacity >= 0 ? Math.floor(capacity) : 0,
        status: editLab.status,
        isPicketEnabled: editLab.isPicketEnabled,
        defaultPicketAssistantCount: Math.min(50, Math.max(1, Number(editLab.defaultPicketAssistantCount) || 1)),
      });

      setShowEditModal(false);
      setEditingLabId(null);
      await fetchLabs();
      toast.success("Lab berhasil diperbarui.");
    } catch (err) {
      toast.error(errMsg(err, "Gagal memperbarui lab"));
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteLab = async (labId: string) => {
    const confirmed = confirm("Hapus lab ini?");
    if (!confirmed) return;

    setDeletingLabId(labId);

    try {
      await api.delete<{ success: boolean }>(`/labs/${labId}`);
      await fetchLabs();
      toast.success("Lab berhasil dihapus.");
    } catch (err) {
      toast.error(errMsg(err, "Gagal menghapus lab"));
    } finally {
      setDeletingLabId(null);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLabs = labs.filter((lab) => {
    const matchesStatus = statusFilter === "ALL" || lab.status === statusFilter;
    const searchable = `${lab.name} ${lab.location} ${lab.description ?? ""}`.toLowerCase();
    return matchesStatus && searchable.includes(normalizedSearch);
  });
  const totalPc = labs.reduce((sum, lab) => sum + (lab._count?.pcs ?? 0), 0);
  const activeLabs = labs.filter((lab) => lab.status === "ACTIVE").length;
  const maintenanceLabs = labs.filter((lab) => lab.status === "MAINTENANCE").length;
  const statusFilters: { value: LabStatusFilter; label: string }[] = [
    { value: "ALL", label: "Semua" },
    { value: "ACTIVE", label: "Aktif" },
    { value: "MAINTENANCE", label: "Maintenance" },
    { value: "INACTIVE", label: "Nonaktif" },
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      <section className="neo-card relative overflow-hidden bg-[#f5ede6] p-4 text-[#1a1a1a] sm:p-6 lg:p-7">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#f3701e]/25 blur-sm" />
        <div className="absolute bottom-4 right-6 hidden h-16 w-16 rotate-12 rounded-2xl border-2 border-[#4b607f]/35 sm:block" />
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-[#1a1a1a] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#4b607f] shadow-[2px_2px_0px_rgba(26,26,26,0.18)]">
                <TbBuilding className="h-4 w-4" /> LabKom
              </span>
              <div>
                <h1 className="font-heading text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                  Manajemen Lab
                </h1>
                <p className="mt-1 max-w-xl text-sm font-semibold leading-relaxed text-[#5a5a5a] sm:text-base">
                  Kelola ruang, kapasitas, PC, dan jadwal lab dengan tampilan mobile yang cepat dipindai.
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreateModal(true)}
              className="neo-btn flex min-h-[48px] w-full items-center justify-center gap-2 bg-[#f3701e] px-5 py-3 text-sm font-black text-white sm:w-auto"
            >
              <TbPlus className="h-5 w-5" /> Tambah Lab
            </motion.button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Total Lab", value: labs.length, tone: "bg-white text-[#1a1a1a]" },
              { label: "Aktif", value: activeLabs, tone: "bg-[#d1fae5] text-[#065f46]" },
              { label: "Maintenance", value: maintenanceLabs, tone: "bg-[#fef3c7] text-[#92400e]" },
              { label: "PC Terdaftar", value: totalPc, tone: "bg-[#dbeafe] text-[#1e3a8a]" },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.tone} rounded-xl border-2 border-[#1a1a1a] p-3 shadow-[3px_3px_0px_rgba(26,26,26,0.35)]`}>
                <p className="font-heading text-xl font-black leading-none sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide opacity-80 sm:text-xs">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sticky top-[64px] z-20 rounded-2xl border-2 border-[#1a1a1a] bg-[#e8d8c9]/95 p-3 shadow-[4px_4px_0px_rgba(26,26,26,0.12)] backdrop-blur-md sm:static sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <TbSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5a5a5a]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, lokasi, deskripsi..."
              className="neo-input min-h-[48px] w-full bg-white py-3 pl-11 pr-4 text-sm font-semibold outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="Filter status lab">
            {statusFilters.map((filter) => {
              const active = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border-2 border-[#1a1a1a] px-3 py-2 text-xs font-black transition-transform active:scale-95 ${
                    active ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a]"
                  }`}
                >
                  <TbFilter className="h-4 w-4" /> {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="neo-card p-4 sm:p-5">
              <div className="animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-xl bg-[#e8d8c9]" />
                  <div className="h-9 w-24 rounded-xl bg-[#e8d8c9]" />
                </div>
                <div className="space-y-2">
                  <div className="h-5 w-2/3 rounded bg-[#e8d8c9]" />
                  <div className="h-4 w-1/2 rounded bg-[#e8d8c9]" />
                  <div className="h-4 w-full rounded bg-[#e8d8c9]" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-14 rounded-xl bg-[#e8d8c9]" />
                  <div className="h-14 rounded-xl bg-[#e8d8c9]" />
                  <div className="h-14 rounded-xl bg-[#e8d8c9]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : labs.length === 0 ? (
        <div className="neo-card bg-[#f5ede6]/70 p-6 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white text-[#4b607f] neo-border shadow-[4px_4px_0px_#1a1a1a] sm:h-20 sm:w-20">
            <TbBuilding className="h-9 w-9 sm:h-11 sm:w-11" />
          </div>
          <h2 className="font-heading text-xl font-black text-[#1a1a1a] sm:text-2xl">Belum ada data lab</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-[#5a5a5a]">
            Mulai dengan menambahkan laboratorium baru untuk mengelola PC, jadwal, dan kapasitasnya.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="neo-btn mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 bg-[#f3701e] px-5 py-3 font-black text-white"
          >
            <TbPlus className="h-5 w-5" /> Tambah Lab Pertama
          </motion.button>
        </div>
      ) : filteredLabs.length === 0 ? (
        <div className="neo-card bg-white p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5ede6] text-[#4b607f] neo-border-sm">
            <TbSearch className="h-8 w-8" />
          </div>
          <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Lab tidak ditemukan</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium text-[#5a5a5a]">
            Coba ubah kata kunci atau filter status untuk melihat lab lain.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
            }}
            className="neo-btn mt-5 min-h-[44px] bg-white px-5 py-2 font-black text-[#1a1a1a]"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:gap-5">
          {filteredLabs.map((lab, i) => (
            <motion.div
              key={lab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="h-full"
            >
              <div className="neo-card-hover group relative flex h-full flex-col overflow-hidden bg-white p-4 sm:p-5">
                <div className="absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-[#f3701e]/10" />
                <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#4b607f] text-white neo-border-sm transition-transform group-hover:scale-105 sm:h-14 sm:w-14">
                    <TbBuilding className="h-7 w-7" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
                    <span className={`neo-badge max-w-full truncate px-2.5 py-1 text-[10px] sm:text-xs ${statusColor[lab.status]}`}>
                      {statusLabel[lab.status]}
                    </span>
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => openEditModal(lab)}
                        className="flex h-11 w-11 items-center justify-center bg-white text-[#1a1a1a] neo-btn"
                        aria-label={`Edit ${lab.name}`}
                      >
                        <TbEdit className="h-5 w-5" />
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDeleteLab(lab.id)}
                        disabled={deletingLabId === lab.id}
                        className="flex h-11 w-11 items-center justify-center bg-white text-[#ef4444] neo-btn disabled:opacity-60"
                        aria-label={`Hapus ${lab.name}`}
                      >
                        {deletingLabId === lab.id ? (
                          <TbLoader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <TbTrash className="h-5 w-5" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>

                <Link href={`/labs/${lab.id}`} className="relative z-10 -m-2 flex flex-1 flex-col rounded-xl p-2 active:bg-[#f5ede6]" prefetch={true}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-heading text-lg font-black leading-tight text-[#1a1a1a] transition-colors group-hover:text-[#f3701e] sm:text-xl">
                        {lab.name}
                      </h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#4b607f]">
                        <TbMapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{lab.location}</span>
                      </p>
                    </div>
                    <TbChevronRight className="mt-1 h-5 w-5 shrink-0 text-[#5a5a5a]" />
                  </div>
                   {lab.description && (
                     <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#5a5a5a]">{lab.description}</p>
                   )}
                   <p className={`mt-3 text-xs font-black ${lab.isPicketEnabled ? "text-[#4b607f]" : "text-[#5a5a5a]"}`}>
                     {lab.isPicketEnabled ? `Piket aktif · ${lab.defaultPicketAssistantCount} Aslab` : "Piket tidak aktif"}
                   </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-t-2 border-[#e8d8c9] pt-3">
                    <div className="rounded-xl bg-[#f5ede6] p-2 text-center neo-border-sm">
                      <div className="flex items-center justify-center gap-1 text-[#1a1a1a]">
                        <TbDeviceDesktop className="h-4 w-4 shrink-0 text-[#4b607f]" />
                        <span className="font-heading text-lg font-black">{lab._count?.pcs || 0}</span>
                      </div>
                      <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-[#5a5a5a]">PC</span>
                    </div>
                    <div className="rounded-xl bg-[#f5ede6] p-2 text-center neo-border-sm">
                      <div className="flex items-center justify-center gap-1 text-[#1a1a1a]">
                        <TbCalendar className="h-4 w-4 shrink-0 text-[#f3701e]" />
                        <span className="font-heading text-lg font-black">{lab._count?.schedules || 0}</span>
                      </div>
                      <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-[#5a5a5a]">Jadwal</span>
                    </div>
                    <div className="rounded-xl bg-[#f5ede6] p-2 text-center neo-border-sm">
                      <div className="flex items-center justify-center gap-1 text-[#1a1a1a]">
                        <TbUsers className="h-4 w-4 shrink-0 text-[#4b607f]" />
                        <span className="font-heading text-lg font-black">{lab.capacity}</span>
                      </div>
                      <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-[#5a5a5a]">Kapasitas</span>
                    </div>
                  </div>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 pb-[calc(72px+env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.98, y: 48 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 48 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card flex max-h-[min(78dvh,calc(100dvh-96px-env(safe-area-inset-bottom)))] w-full max-w-md flex-col overflow-hidden rounded-t-2xl rounded-b-none p-0 shadow-[6px_6px_0px_#1a1a1a] sm:max-h-[86dvh] sm:rounded-xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b-2 border-[#1a1a1a] px-4 py-3 sm:px-6 sm:py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f3701e]">Lab baru</p>
                  <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Tambah Lab Baru</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  aria-label="Tutup modal"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleCreateLab}>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                  <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama Lab</label>
                  <input
                    type="text"
                    value={newLab.name}
                    onChange={(e) => setNewLab({ ...newLab, name: e.target.value })}
                    placeholder="e.g. Lab Dasar"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                  </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lokasi</label>
                  <input
                    type="text"
                    value={newLab.location}
                    onChange={(e) => setNewLab({ ...newLab, location: e.target.value })}
                    placeholder="e.g. Gedung A, Lantai 2"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Deskripsi</label>
                  <input
                    type="text"
                    value={newLab.description}
                    onChange={(e) => setNewLab({ ...newLab, description: e.target.value })}
                    placeholder="Deskripsi singkat lab"
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kapasitas</label>
                  <input
                    type="number"
                    min={0}
                    value={newLab.capacity}
                    onChange={(e) => setNewLab({ ...newLab, capacity: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div className="rounded-xl border-2 border-[#1a1a1a] bg-[#f5ede6] p-3">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-black text-[#1a1a1a]">
                    <input
                      type="checkbox"
                      checked={newLab.isPicketEnabled}
                      onChange={(e) => setNewLab({ ...newLab, isPicketEnabled: e.target.checked })}
                      className="h-5 w-5 accent-[#4b607f]"
                    />
                    Aktifkan Piket Aslab
                  </label>
                  <div className={`mt-3 ${newLab.isPicketEnabled ? "" : "opacity-45"}`}>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jumlah Aslab Default</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={!newLab.isPicketEnabled}
                      value={newLab.defaultPicketAssistantCount}
                      onChange={(e) => setNewLab({ ...newLab, defaultPicketAssistantCount: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                </div>
                <div className="flex shrink-0 gap-2 border-t-2 border-[#1a1a1a] bg-[#f5ede6] px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isCreating}
                    className="min-h-[44px] flex-1 px-3 py-2 text-sm font-black bg-[#4b607f] text-white neo-btn"
                  >
                    {isCreating ? "Menyimpan..." : "Simpan"}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowCreateModal(false);
                      resetCreateForm();
                    }}
                    className="min-h-[44px] flex-1 px-3 py-2 text-sm font-black bg-white text-[#1a1a1a] neo-btn"
                  >
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 pb-[calc(72px+env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4"
            onClick={() => {
              setShowEditModal(false);
              setEditingLabId(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.98, y: 48 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 48 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card flex max-h-[min(78dvh,calc(100dvh-96px-env(safe-area-inset-bottom)))] w-full max-w-md flex-col overflow-hidden rounded-t-2xl rounded-b-none p-0 shadow-[6px_6px_0px_#1a1a1a] sm:max-h-[86dvh] sm:rounded-xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b-2 border-[#1a1a1a] px-4 py-3 sm:px-6 sm:py-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f3701e]">Perbarui</p>
                  <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Edit Lab</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingLabId(null);
                  }}
                  aria-label="Tutup modal"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0"
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>

              <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleEditLab}>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                  <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama Lab</label>
                  <input
                    type="text"
                    value={editLab.name}
                    onChange={(e) => setEditLab({ ...editLab, name: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                  </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lokasi</label>
                  <input
                    type="text"
                    value={editLab.location}
                    onChange={(e) => setEditLab({ ...editLab, location: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Deskripsi</label>
                  <input
                    type="text"
                    value={editLab.description}
                    onChange={(e) => setEditLab({ ...editLab, description: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kapasitas</label>
                  <input
                    type="number"
                    min={0}
                    value={editLab.capacity}
                    onChange={(e) => setEditLab({ ...editLab, capacity: e.target.value })}
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Status</label>
                  <select
                    value={editLab.status}
                    onChange={(e) =>
                      setEditLab({ ...editLab, status: e.target.value as Lab["status"] })
                    }
                    className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm bg-white"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Tidak Aktif</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
                <div className="rounded-xl border-2 border-[#1a1a1a] bg-[#f5ede6] p-3">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-black text-[#1a1a1a]">
                    <input
                      type="checkbox"
                      checked={editLab.isPicketEnabled}
                      onChange={(e) => setEditLab({ ...editLab, isPicketEnabled: e.target.checked })}
                      className="h-5 w-5 accent-[#4b607f]"
                    />
                    Aktifkan Piket Aslab
                  </label>
                  <div className={`mt-3 ${editLab.isPicketEnabled ? "" : "opacity-45"}`}>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Jumlah Aslab Default</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={!editLab.isPicketEnabled}
                      value={editLab.defaultPicketAssistantCount}
                      onChange={(e) => setEditLab({ ...editLab, defaultPicketAssistantCount: e.target.value })}
                      className="w-full px-4 py-3 min-h-[44px] neo-input focus:outline-none text-sm disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                </div>
                <div className="flex shrink-0 gap-2 border-t-2 border-[#1a1a1a] bg-[#f5ede6] px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isEditing}
                    className="min-h-[44px] flex-1 px-3 py-2 text-sm font-black bg-[#4b607f] text-white neo-btn"
                  >
                    {isEditing ? "Menyimpan..." : "Simpan Perubahan"}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingLabId(null);
                    }}
                    className="min-h-[44px] flex-1 px-3 py-2 text-sm font-black bg-white text-[#1a1a1a] neo-btn"
                  >
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
