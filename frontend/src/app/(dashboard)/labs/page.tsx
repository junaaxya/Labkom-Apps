"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { TbEdit, TbLoader2, TbTrash } from "react-icons/tb";
import type { Lab } from "@/types";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";

type LabWithCount = Lab & { _count?: { pcs: number; schedules: number } };

type LabForm = {
  name: string;
  location: string;
  description: string;
  capacity: number;
};

export default function LabsPage() {
  const toast = useToast();
  const [labs, setLabs] = useState<LabWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingLabId, setDeletingLabId] = useState<string | null>(null);

  const [newLab, setNewLab] = useState<LabForm>({
    name: "",
    location: "",
    description: "",
    capacity: 0,
  });
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [editLab, setEditLab] = useState<LabForm & { status: Lab["status"] }>({
    name: "",
    location: "",
    description: "",
    capacity: 0,
    status: "ACTIVE",
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

  const fetchLabs = async () => {
    setIsLoading(true);

    try {
      const response = await api.get<{ success: boolean; data: LabWithCount[] }>("/labs");
      setLabs(response.data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat data lab");
      setLabs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  const resetCreateForm = () => {
    setNewLab({
      name: "",
      location: "",
      description: "",
      capacity: 0,
    });
  };

  const handleCreateLab = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      await api.post<{ success: boolean; data: LabWithCount }>("/labs", {
        name: newLab.name.trim(),
        location: newLab.location.trim(),
        description: newLab.description.trim(),
        capacity: Number(newLab.capacity) || 0,
      });

      setShowCreateModal(false);
      resetCreateForm();
      await fetchLabs();
      toast.success("Lab berhasil dibuat.");
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membuat lab");
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
      capacity: lab.capacity,
      status: lab.status,
    });
    setShowEditModal(true);
  };

  const handleEditLab = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLabId) return;

    setIsEditing(true);

    try {
      await api.put<{ success: boolean; data: LabWithCount }>(`/labs/${editingLabId}`, {
        name: editLab.name.trim(),
        location: editLab.location.trim(),
        description: editLab.description.trim(),
        capacity: Number(editLab.capacity) || 0,
        status: editLab.status,
      });

      setShowEditModal(false);
      setEditingLabId(null);
      await fetchLabs();
      toast.success("Lab berhasil diperbarui.");
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memperbarui lab");
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
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal menghapus lab");
    } finally {
      setDeletingLabId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#1a1a1a] tracking-tight">Manajemen Lab</h1>
          <p className="text-[#5a5a5a] mt-1 font-medium">Kelola laboratorium dan PC di dalamnya</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-[#f3701e] text-white neo-btn flex items-center justify-center gap-2"
        >
          <span className="text-lg font-bold">+</span> Tambah Lab
        </motion.button>
      </div>

      {isLoading ? (
        <div className="neo-card p-8 flex items-center justify-center gap-2">
          <TbLoader2 className="w-5 h-5 animate-spin text-[#4b607f]" />
          <span className="text-[#5a5a5a] font-medium">Memuat data lab...</span>
        </div>
      ) : labs.length === 0 ? (
        <div className="neo-card p-12 text-center border-dashed bg-[#f5ede6]/50">
            <div className="w-24 h-24 mx-auto bg-white rounded-2xl neo-border flex items-center justify-center mb-6 transform -rotate-6 shadow-[4px_4px_0px_#1a1a1a]">
            <span className="text-5xl">🏢</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-[#1a1a1a] mb-2">Belum ada data lab</h2>
          <p className="text-[#5a5a5a] max-w-md mx-auto mb-6">Mulai dengan menambahkan laboratorium baru untuk mengelola PC, jadwal, dan kapasitasnya.</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-[#f3701e] text-white neo-btn inline-flex items-center gap-2"
          >
            + Tambah Lab Pertama
          </motion.button>
        </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab, i) => (
            <motion.div
              key={lab.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="h-full"
            >
              <div className="neo-card-hover p-6 h-full flex flex-col relative group bg-white">
                <div className="flex items-start justify-between mb-4 gap-3 relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-[#4b607f] neo-border-sm flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                    <span className="text-white text-2xl">🏢</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`neo-badge px-2.5 py-1 ${statusColor[lab.status]}`}>
                      {statusLabel[lab.status]}
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openEditModal(lab)}
                      className="w-10 h-10 bg-white text-[#1a1a1a] neo-btn flex items-center justify-center"
                      aria-label={`Edit ${lab.name}`}
                    >
                      <TbEdit className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeleteLab(lab.id)}
                      disabled={deletingLabId === lab.id}
                      className="w-10 h-10 bg-white text-[#ef4444] neo-btn flex items-center justify-center disabled:opacity-60"
                      aria-label={`Hapus ${lab.name}`}
                    >
                      {deletingLabId === lab.id ? (
                        <TbLoader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <TbTrash className="w-5 h-5" />
                      )}
                    </motion.button>
                  </div>
                </div>

                <Link href={`/labs/${lab.id}`} className="block rounded-xl -m-2 p-2 flex-1 relative z-10">
                  <h3 className="font-heading font-bold text-xl text-[#1a1a1a] group-hover:text-[#f3701e] transition-colors">{lab.name}</h3>
                  <p className="text-sm font-medium text-[#4b607f] mt-1">{lab.location}</p>
                  {lab.description && (
                    <p className="text-sm text-[#5a5a5a] mt-3 line-clamp-2 leading-relaxed">{lab.description}</p>
                  )}

                  <div className="flex items-center gap-5 mt-6 pt-4 border-t-[3px] border-[#e8d8c9]">
                    <div className="flex flex-col items-center flex-1 p-2 rounded-lg bg-[#f5ede6] neo-border-sm">
                      <div className="flex items-center gap-1.5 text-[#1a1a1a]">
                        <span className="text-xl">🖥️</span>
                        <span className="text-xl font-bold font-heading">{lab._count?.pcs || 0}</span>
                      </div>
                      <span className="text-xs font-bold text-[#5a5a5a] mt-1 uppercase tracking-wider">PC</span>
                    </div>
                    <div className="flex flex-col items-center flex-1 p-2 rounded-lg bg-[#f5ede6] neo-border-sm">
                      <div className="flex items-center gap-1.5 text-[#1a1a1a]">
                        <span className="text-xl">📅</span>
                        <span className="text-xl font-bold font-heading">{lab._count?.schedules || 0}</span>
                      </div>
                      <span className="text-xs font-bold text-[#5a5a5a] mt-1 uppercase tracking-wider">Jadwal</span>
                    </div>
                    <div className="flex flex-col items-center flex-1 p-2 rounded-lg bg-[#f5ede6] neo-border-sm">
                      <div className="flex items-center gap-1.5 text-[#1a1a1a]">
                        <span className="text-xl">👥</span>
                        <span className="text-xl font-bold font-heading">{lab.capacity}</span>
                      </div>
                      <span className="text-xs font-bold text-[#5a5a5a] mt-1 uppercase tracking-wider">Kapasitas</span>
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
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-6 w-full max-w-md shadow-[6px_6px_0px_#1a1a1a]"
            >
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-4">
                Tambah Lab Baru
              </h2>

              <form className="space-y-4" onSubmit={handleCreateLab}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama Lab</label>
                  <input
                    type="text"
                    value={newLab.name}
                    onChange={(e) => setNewLab({ ...newLab, name: e.target.value })}
                    placeholder="e.g. Lab Dasar"
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lokasi</label>
                  <input
                    type="text"
                    value={newLab.location}
                    onChange={(e) => setNewLab({ ...newLab, location: e.target.value })}
                    placeholder="e.g. Gedung A, Lantai 2"
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Deskripsi</label>
                  <input
                    type="text"
                    value={newLab.description}
                    onChange={(e) => setNewLab({ ...newLab, description: e.target.value })}
                    placeholder="Deskripsi singkat lab"
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kapasitas</label>
                  <input
                    type="number"
                    min={0}
                    value={newLab.capacity}
                    onChange={(e) => setNewLab({ ...newLab, capacity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isCreating}
                    className="flex-1 py-3 bg-[#4b607f] text-white neo-btn"
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
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn"
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
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowEditModal(false);
              setEditingLabId(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="neo-card p-6 w-full max-w-md shadow-[6px_6px_0px_#1a1a1a]"
            >
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-4">Edit Lab</h2>

              <form className="space-y-4" onSubmit={handleEditLab}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Nama Lab</label>
                  <input
                    type="text"
                    value={editLab.name}
                    onChange={(e) => setEditLab({ ...editLab, name: e.target.value })}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Lokasi</label>
                  <input
                    type="text"
                    value={editLab.location}
                    onChange={(e) => setEditLab({ ...editLab, location: e.target.value })}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Deskripsi</label>
                  <input
                    type="text"
                    value={editLab.description}
                    onChange={(e) => setEditLab({ ...editLab, description: e.target.value })}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Kapasitas</label>
                  <input
                    type="number"
                    min={0}
                    value={editLab.capacity}
                    onChange={(e) => setEditLab({ ...editLab, capacity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-1.5">Status</label>
                  <select
                    value={editLab.status}
                    onChange={(e) =>
                      setEditLab({ ...editLab, status: e.target.value as Lab["status"] })
                    }
                    className="w-full px-4 py-3 neo-input focus:outline-none text-sm bg-white"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Tidak Aktif</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isEditing}
                    className="flex-1 py-3 bg-[#4b607f] text-white neo-btn"
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
                    className="flex-1 py-3 bg-white text-[#1a1a1a] neo-btn"
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
