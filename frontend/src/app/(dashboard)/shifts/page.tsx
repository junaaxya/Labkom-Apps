"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TbClock,
  TbEdit,
  TbLoader2,
  TbPlus,
  TbSearch,
  TbTrash,
  TbX,
} from "react-icons/tb";
import type { Shift } from "@/types";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    for (const key of ["shifts", "rows", "items"]) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

type ShiftForm = {
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: string;
  checkoutGraceMinutes: string;
  isTaskRequired: boolean;
  notes: string;
};

const EMPTY_FORM: ShiftForm = {
  name: "",
  startTime: "08:00",
  endTime: "12:00",
  lateToleranceMinutes: "15",
  checkoutGraceMinutes: "30",
  isTaskRequired: true,
  notes: "",
};

export default function ShiftsPage() {
  const toast = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShiftForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const shiftsRes = await api.get<unknown>("/shifts");
      setShifts(unwrapList<Shift>(shiftsRes));
    } catch (err) {
      toast.error(errMsg(err, "Gagal memuat data shift"));
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const filteredShifts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return shifts;
    return shifts.filter((shift) => {
      const haystack = [shift.name, shift.startTime, shift.endTime, shift.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, shifts]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowCreateModal(true);
  };

  const openEdit = (shift: Shift) => {
    setEditingId(shift.id);
    setForm({
      name: shift.name ?? "",
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateToleranceMinutes: String(shift.lateToleranceMinutes ?? 15),
      checkoutGraceMinutes: String(shift.checkoutGraceMinutes ?? 30),
      isTaskRequired: shift.isTaskRequired ?? true,
      notes: shift.notes ?? "",
    });
    setShowEditModal(true);
  };

  const payloadFromForm = () => {
    if (!form.startTime || !form.endTime) {
      throw new Error("Jam mulai dan jam selesai wajib diisi");
    }
    if (form.endTime <= form.startTime) {
      throw new Error("Jam selesai harus lebih besar dari jam mulai");
    }
    return {
      name: form.name.trim() || undefined,
      aslebId: null,
      labId: null,
      day: null,
      startTime: form.startTime,
      endTime: form.endTime,
      lateToleranceMinutes: Math.max(0, Number(form.lateToleranceMinutes) || 15),
      checkoutGraceMinutes: Math.max(0, Number(form.checkoutGraceMinutes) || 30),
      isTaskRequired: form.isTaskRequired,
      notes: form.notes.trim() || undefined,
    };
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await api.post("/shifts", payloadFromForm());
      toast.success("Shift berhasil dibuat");
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal membuat shift"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setIsSaving(true);
    try {
      await api.put(`/shifts/${editingId}`, payloadFromForm());
      toast.success("Shift berhasil diupdate");
      setShowEditModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal mengupdate shift"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (shift: Shift) => {
    const label = shift.name || `${shift.startTime}-${shift.endTime}`;
    if (!window.confirm(`Nonaktifkan shift "${label}"?`)) return;
    setDeletingId(shift.id);
    try {
      await api.delete(`/shifts/${shift.id}`);
      toast.success("Shift dinonaktifkan");
      await loadData();
    } catch (err) {
      toast.error(errMsg(err, "Gagal menonaktifkan shift"));
    } finally {
      setDeletingId(null);
    }
  };

  const renderFormFields = () => (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
      <p className="rounded-lg border-2 border-[#1a1a1a] bg-white px-3 py-2 text-xs font-medium text-[#5a5a5a]">
        Shift = template jam kerja. Pilih aslab dan ruangan dilakukan di <strong>Jadwal Piket Aslab</strong>.
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase text-[#5a5a5a]">Nama Shift</span>
        <input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Contoh: Shift Pagi"
          className="neo-input neo-border min-h-[44px] w-full rounded-lg bg-white px-3 py-2"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-[#5a5a5a]">Jam Mulai</span>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
            required
            className="neo-input neo-border min-h-[44px] w-full rounded-lg bg-white px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-[#5a5a5a]">Jam Selesai</span>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
            required
            className="neo-input neo-border min-h-[44px] w-full rounded-lg bg-white px-3 py-2"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-[#5a5a5a]">Toleransi Terlambat (menit)</span>
          <input
            type="number"
            min={0}
            value={form.lateToleranceMinutes}
            onChange={(e) => setForm((prev) => ({ ...prev, lateToleranceMinutes: e.target.value }))}
            className="neo-input neo-border min-h-[44px] w-full rounded-lg bg-white px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-[#5a5a5a]">Grace Checkout (menit)</span>
          <input
            type="number"
            min={0}
            value={form.checkoutGraceMinutes}
            onChange={(e) => setForm((prev) => ({ ...prev, checkoutGraceMinutes: e.target.value }))}
            className="neo-input neo-border min-h-[44px] w-full rounded-lg bg-white px-3 py-2"
          />
        </label>
      </div>

      <label className="flex min-h-[44px] items-center gap-3 rounded-lg border-2 border-[#1a1a1a] bg-white px-3 py-2">
        <input
          type="checkbox"
          checked={form.isTaskRequired}
          onChange={(e) => setForm((prev) => ({ ...prev, isTaskRequired: e.target.checked }))}
          className="h-5 w-5 accent-[#f3701e]"
        />
        <span className="text-sm font-semibold text-[#1a1a1a]">Wajib isi daily task</span>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase text-[#5a5a5a]">Catatan</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="neo-input neo-border w-full rounded-lg bg-white px-3 py-2"
          placeholder="Opsional"
        />
      </label>
    </div>
  );

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a1a1a] sm:text-3xl">Manajemen Shift</h1>
          <p className="mt-1 text-sm text-[#5a5a5a]">
            Template jam piket (pagi/siang). Aslab dan ruangan diatur di Jadwal Piket Aslab.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="neo-btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#f3701e] px-4 py-2 text-sm font-bold text-white"
        >
          <TbPlus className="h-5 w-5" />
          Tambah Shift
        </button>
      </div>

      <div className="neo-card neo-border rounded-xl bg-white p-3">
        <label className="relative block">
          <TbSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a5a5a]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau jam shift..."
            className="neo-input neo-border min-h-[44px] w-full rounded-lg bg-white py-2 pl-10 pr-3"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <TbLoader2 className="h-8 w-8 animate-spin text-[#f3701e]" />
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className="neo-card neo-border rounded-xl bg-white p-6 text-center">
          <TbClock className="mx-auto h-10 w-10 text-[#5a5a5a]" />
          <p className="mt-3 font-semibold text-[#1a1a1a]">Belum ada shift aktif</p>
          <p className="mt-1 text-sm text-[#5a5a5a]">
            Buat template jam dulu agar dropdown di Jadwal Piket Aslab terisi.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredShifts.map((shift) => (
            <article key={shift.id} className="neo-card neo-border rounded-xl bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-bold text-[#1a1a1a]">
                    {shift.name || "Shift tanpa nama"}
                  </h2>
                  <p className="text-sm font-semibold text-[#4b607f]">
                    {shift.startTime} - {shift.endTime}
                  </p>
                </div>
                <span className="neo-badge rounded-full bg-[#e8f5e9] px-2 py-1 text-xs font-bold text-[#2e7d32]">
                  Template
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-[#5a5a5a]">
                <p>
                  <span className="font-semibold text-[#1a1a1a]">Toleransi:</span>{" "}
                  telat {shift.lateToleranceMinutes}m · checkout {shift.checkoutGraceMinutes}m
                </p>
                <p>
                  <span className="font-semibold text-[#1a1a1a]">Daily task:</span>{" "}
                  {shift.isTaskRequired ? "Wajib" : "Opsional"}
                </p>
                {shift.notes ? <p className="text-xs">{shift.notes}</p> : null}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(shift)}
                  className="neo-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[#1a1a1a] bg-white px-3 py-2 text-sm font-bold"
                >
                  <TbEdit className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(shift)}
                  disabled={deletingId === shift.id}
                  className="neo-btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[#1a1a1a] bg-[#ffebee] px-3 py-2 text-sm font-bold text-[#c62828] disabled:opacity-60"
                >
                  {deletingId === shift.id ? <TbLoader2 className="h-4 w-4 animate-spin" /> : <TbTrash className="h-4 w-4" />}
                  Nonaktifkan
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreateModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="neo-card flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-b-none border-2 border-[#1a1a1a] bg-[#f5ede6] p-0 sm:max-h-[86dvh] sm:rounded-xl"
              style={{ marginBottom: "calc(72px + env(safe-area-inset-bottom))" }}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b-2 border-[#1a1a1a] px-4 py-3 sm:px-6">
                <h2 className="font-heading text-lg font-bold">Tambah Shift</h2>
                <button type="button" aria-label="Tutup modal" onClick={() => setShowCreateModal(false)} className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-[#1a1a1a] bg-white">
                  <TbX className="mx-auto h-5 w-5" />
                </button>
              </div>
              <form onSubmit={(e) => void handleCreate(e)} className="flex min-h-0 flex-1 flex-col">
                {renderFormFields()}
                <div className="flex shrink-0 gap-2 border-t-2 border-[#1a1a1a] bg-[#f5ede6] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="neo-btn min-h-[44px] flex-1 rounded-lg border-2 border-[#1a1a1a] bg-white font-bold">Batal</button>
                  <button type="submit" disabled={isSaving} className="neo-btn min-h-[44px] flex-1 rounded-lg bg-[#f3701e] font-bold text-white disabled:opacity-60">
                    {isSaving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="neo-card flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-b-none border-2 border-[#1a1a1a] bg-[#f5ede6] p-0 sm:max-h-[86dvh] sm:rounded-xl"
              style={{ marginBottom: "calc(72px + env(safe-area-inset-bottom))" }}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b-2 border-[#1a1a1a] px-4 py-3 sm:px-6">
                <h2 className="font-heading text-lg font-bold">Edit Shift</h2>
                <button type="button" aria-label="Tutup modal" onClick={() => setShowEditModal(false)} className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-[#1a1a1a] bg-white">
                  <TbX className="mx-auto h-5 w-5" />
                </button>
              </div>
              <form onSubmit={(e) => void handleEdit(e)} className="flex min-h-0 flex-1 flex-col">
                {renderFormFields()}
                <div className="flex shrink-0 gap-2 border-t-2 border-[#1a1a1a] bg-[#f5ede6] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
                  <button type="button" onClick={() => setShowEditModal(false)} className="neo-btn min-h-[44px] flex-1 rounded-lg border-2 border-[#1a1a1a] bg-white font-bold">Batal</button>
                  <button type="submit" disabled={isSaving} className="neo-btn min-h-[44px] flex-1 rounded-lg bg-[#f3701e] font-bold text-white disabled:opacity-60">
                    {isSaving ? "Menyimpan..." : "Update"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
