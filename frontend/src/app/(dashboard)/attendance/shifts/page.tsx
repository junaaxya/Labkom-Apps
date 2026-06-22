"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TbBuildingWarehouse,
  TbCalendarEvent,
  TbClock,
  TbClockCog,
  TbLoader2,
  TbNotes,
  TbPlus,
  TbRefresh,
  TbTrash,
  TbUsers,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import type { AsLabPicketDestination, Role, Shift, ShiftSchedule, User } from "@/types";

type ApiMaybeWrapped<T> = T | { data?: T; items?: T } | Record<string, unknown>;

type ShiftCreatePayload = {
  userId: string;
  destination: AsLabPicketDestination;
  shiftId: string;
  scheduleDate: string;
  notes?: string;
};

type ShiftCreateBulkPayload = {
  userId: string;
  destination: AsLabPicketDestination;
  shiftId: string;
  dates: string[];
  notes?: string;
};

type ShiftFormState = {
  userId: string;
  destination: "" | AsLabPicketDestination;
  shiftId: string;
  scheduleDate: string;
  bulkDatesText: string;
  notes: string;
};

const PICKET_DESTINATIONS: Array<{ value: AsLabPicketDestination; label: string }> = [
  { value: "RUANGAN_ASLAB", label: "Ruangan Aslab" },
  { value: "LAB_MULTIMEDIA", label: "Lab Multimedia" },
  { value: "LAB_DASAR", label: "Lab Dasar" },
];

function destinationLabel(destination?: AsLabPicketDestination): string {
  return PICKET_DESTINATIONS.find((item) => item.value === destination)?.label ?? "-";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeArray<T>(value: unknown, keyCandidates: string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isObjectRecord(value)) return [];

  for (const key of keyCandidates) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate as T[];
  }

  if (Array.isArray(value.data)) return value.data as T[];
  if (Array.isArray(value.items)) return value.items as T[];
  return [];
}

function currentRole(): Role | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsed) || typeof parsed.role !== "string") return null;
    return parsed.role as Role;
  } catch {
    return null;
  }
}

function monthNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { dateStyle: "full" });
}

function statusClass(status: string): string {
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-800";
  if (status === "COMPLETED") return "bg-green-100 text-green-800";
  if (status === "CANCELLED") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

export default function AttendanceShiftsPage() {
  const toast = useToast();
  const [role] = useState<Role | null>(() => currentRole());
  const [month, setMonth] = useState(monthNow);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [aslabUsers, setAslabUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ShiftFormState>({
    userId: "",
    destination: "",
    shiftId: "",
    scheduleDate: "",
    bulkDatesText: "",
    notes: "",
  });

  const isCoordinator = role === "KOORDINATOR_LAB";
  const summary = useMemo(
    () => ({
      scheduled: schedules.filter((schedule) => schedule.status === "SCHEDULED").length,
      completed: schedules.filter((schedule) => schedule.status === "COMPLETED").length,
      cancelled: schedules.filter((schedule) => schedule.status === "CANCELLED").length,
    }),
    [schedules]
  );

  const loadSchedules = useCallback(async () => {
    if (!role) return;

    setLoading(true);
    try {
      const endpoint = isCoordinator
        ? `/attendance/shift-schedules?month=${month}`
        : "/attendance/shift-schedules/me";
      const response = await api.get<ApiMaybeWrapped<ShiftSchedule[]>>(endpoint);
      setSchedules(safeArray<ShiftSchedule>(response, ["schedules", "rows"]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat jadwal piket.");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [isCoordinator, month, role, toast]);

  const loadReferences = useCallback(async () => {
    if (!isCoordinator) return;

    setReferencesLoading(true);
    try {
      const [usersRes, shiftsRes] = await Promise.all([
        api.get<ApiMaybeWrapped<User[]> | Record<string, unknown>>("/users?role=ASISTEN_LAB"),
        api.get<ApiMaybeWrapped<Shift[]> | Record<string, unknown>>("/shifts"),
      ]);

      setAslabUsers(safeArray<User>(usersRes, ["users", "rows"]));
      setShifts(safeArray<Shift>(shiftsRes, ["shifts", "rows"]));
    } catch {
      setAslabUsers([]);
      setShifts([]);
      toast.error("Gagal memuat referensi jadwal piket.");
    } finally {
      setReferencesLoading(false);
    }
  }, [isCoordinator, toast]);

  useEffect(() => {
    queueMicrotask(() => void loadSchedules());
  }, [loadSchedules]);

  useEffect(() => {
    queueMicrotask(() => void loadReferences());
  }, [loadReferences]);

  const submitSchedule = async () => {
    const { userId, destination, shiftId, scheduleDate, bulkDatesText, notes } = form;
    if (!userId || !destination || !shiftId) {
      toast.error("Pilih Aslab, Tujuan Piket, dan Shift terlebih dahulu.");
      return;
    }

    const parsedBulkDates = bulkDatesText
      .split(/[,\n]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const uniqueDates = Array.from(new Set(scheduleDate ? [scheduleDate, ...parsedBulkDates] : parsedBulkDates));

    if (uniqueDates.length === 0) {
      toast.error("Isi minimal satu tanggal jadwal.");
      return;
    }

    const payloads: ShiftCreatePayload[] = uniqueDates.map((date) => ({
      userId,
      destination,
      shiftId,
      scheduleDate: date,
      notes: notes.trim() ? notes.trim() : undefined,
    }));

    setSubmitting(true);
    try {
      if (payloads.length === 1) {
        await api.post("/attendance/shift-schedules", payloads[0]);
      } else {
        const bulkBody: ShiftCreateBulkPayload = {
          userId,
          destination,
          shiftId,
          dates: uniqueDates,
          notes: notes.trim() ? notes.trim() : undefined,
        };
        await api.post("/attendance/shift-schedules", bulkBody);
      }
      toast.success("Jadwal piket berhasil ditambahkan. Notifikasi dikirim ke Aslab terkait.");
      setForm({ userId: "", destination: "", shiftId: "", scheduleDate: "", bulkDatesText: "", notes: "" });
      await loadSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambahkan jadwal piket.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      await api.delete(`/attendance/shift-schedules/${scheduleId}`);
      toast.success("Jadwal piket berhasil dihapus.");
      await loadSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus jadwal piket.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="neo-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center bg-[#4b607f] text-white neo-border">
              <TbCalendarEvent className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-black text-[#1a1a1a] sm:text-3xl">
                Jadwal Piket Aslab
              </h1>
              <p className="mt-1 text-sm font-medium text-[#5a5a5a]">
                {isCoordinator
                  ? "Kelola assignment piket asisten lab per tanggal, lab, dan shift."
                  : "Lihat jadwal piket pribadi yang ditugaskan koordinator."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isCoordinator && (
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="neo-input neo-border min-h-[44px] rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#1a1a1a]"
              />
            )}
            <button
              type="button"
              onClick={() => void loadSchedules()}
              className="neo-btn min-h-[44px] bg-white px-4 py-2 text-sm font-bold text-[#1a1a1a]"
            >
              <span className="flex items-center justify-center gap-2">
                <TbRefresh className="h-4 w-4" /> Refresh
              </span>
            </button>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="neo-card p-4">
          <p className="text-xs font-black uppercase text-[#5a5a5a]">Terjadwal</p>
          <p className="font-heading text-3xl font-black text-[#4b607f]">{summary.scheduled}</p>
        </div>
        <div className="neo-card p-4">
          <p className="text-xs font-black uppercase text-[#5a5a5a]">Selesai</p>
          <p className="font-heading text-3xl font-black text-green-700">{summary.completed}</p>
        </div>
        <div className="neo-card p-4">
          <p className="text-xs font-black uppercase text-[#5a5a5a]">Dibatalkan</p>
          <p className="font-heading text-3xl font-black text-red-700">{summary.cancelled}</p>
        </div>
      </section>

      {isCoordinator && (
        <section className="neo-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Tambah Jadwal Piket</h2>
              <p className="text-sm font-medium text-[#5a5a5a]">
                Pilih aslab, shift, dan tujuan piket: Ruangan Aslab, Lab Multimedia, atau Lab Dasar.
              </p>
              <p className="mt-1 text-xs font-bold text-[#f3701e]">
                Notifikasi masuk ke panel aplikasi dan WhatsApp jika aktif. Push bar HP native butuh fitur Web Push terpisah.
              </p>
            </div>
            {referencesLoading && <TbLoader2 className="h-5 w-5 animate-spin text-[#4b607f]" />}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]">
                <TbUsers className="h-4 w-4" /> Aslab
              </span>
              <select
                value={form.userId}
                onChange={(event) => setForm((prev) => ({ ...prev, userId: event.target.value }))}
                className="neo-input neo-border mt-1 min-h-[44px] w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"
              >
                <option value="">Pilih Aslab</option>
                {aslabUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]">
                <TbBuildingWarehouse className="h-4 w-4" /> Tujuan Piket
              </span>
              <select
                value={form.destination}
                onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value as ShiftFormState["destination"] }))}
                className="neo-input neo-border mt-1 min-h-[44px] w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"
              >
                <option value="">Pilih Tujuan</option>
                {PICKET_DESTINATIONS.map((destination) => (
                  <option key={destination.value} value={destination.value}>{destination.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]">
                <TbClockCog className="h-4 w-4" /> Shift
              </span>
              <select
                value={form.shiftId}
                onChange={(event) => setForm((prev) => ({ ...prev, shiftId: event.target.value }))}
                className="neo-input neo-border mt-1 min-h-[44px] w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"
              >
                <option value="">Pilih Shift</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name || "Shift"} · {shift.startTime} - {shift.endTime}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label>
              <span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]">
                <TbCalendarEvent className="h-4 w-4" /> Tanggal Utama
              </span>
              <input
                type="date"
                value={form.scheduleDate}
                onChange={(event) => setForm((prev) => ({ ...prev, scheduleDate: event.target.value }))}
                className="neo-input neo-border mt-1 min-h-[44px] w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"
              />
            </label>

            <label>
              <span className="text-xs font-bold uppercase text-[#5a5a5a]">
                Bulk Dates, pisahkan koma atau baris baru
              </span>
              <textarea
                value={form.bulkDatesText}
                onChange={(event) => setForm((prev) => ({ ...prev, bulkDatesText: event.target.value }))}
                rows={3}
                placeholder="2026-06-23, 2026-06-25"
                className="neo-input neo-border mt-1 w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]">
              <TbNotes className="h-4 w-4" /> Catatan
            </span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
              placeholder="Catatan jadwal piket"
              className="neo-input neo-border mt-1 w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"
            />
          </label>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void submitSchedule()}
              disabled={submitting}
              className="neo-btn min-h-[44px] bg-[#4b607f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2"><TbLoader2 className="h-4 w-4 animate-spin" /> Menyimpan...</span>
              ) : (
                <span className="flex items-center gap-2"><TbPlus className="h-4 w-4" /> Simpan Jadwal</span>
              )}
            </button>
          </div>
        </section>
      )}

      <section className="neo-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-black text-[#1a1a1a]">Daftar Jadwal Piket</h2>
            <p className="text-sm font-medium text-[#5a5a5a]">
              {isCoordinator ? `Periode ${month}` : "Jadwal yang aktif untuk akun Anda."}
            </p>
          </div>
          <span className="rounded-lg bg-[#f3701e] px-3 py-1 text-xs font-black text-white neo-border-sm">
            {schedules.length} jadwal
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center font-bold text-[#5a5a5a]">
            <TbLoader2 className="h-8 w-8 animate-spin text-[#4b607f]" /> Memuat jadwal...
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-xl border-[3px] border-dashed border-[#1a1a1a] bg-white p-8 text-center">
            <p className="font-heading text-xl font-black text-[#1a1a1a]">Belum ada jadwal piket.</p>
            <p className="mt-1 text-sm font-medium text-[#5a5a5a]">
              {isCoordinator ? "Tambahkan jadwal dari form di atas." : "Koordinator belum menugaskan jadwal bulan ini."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {schedules.map((schedule) => (
              <article key={schedule.id} className="neo-card flex flex-col gap-3 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-lg font-black text-[#1a1a1a]">{formatDate(schedule.scheduleDate)}</p>
                    {isCoordinator && <p className="text-sm font-bold text-[#4b607f]">{schedule.user?.name ?? "Aslab"}</p>}
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-black neo-border-sm ${statusClass(schedule.status)}`}>
                    {schedule.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm font-bold text-[#1a1a1a]">
                  <p className="flex items-center gap-2"><TbBuildingWarehouse className="h-4 w-4 text-[#f3701e]" /> {destinationLabel(schedule.destination)}</p>
                  <p className="flex items-center gap-2"><TbClock className="h-4 w-4 text-[#f3701e]" /> {schedule.shift?.startTime ?? "-"} - {schedule.shift?.endTime ?? "-"}</p>
                </div>

                {schedule.shift?.name && (
                  <span className="self-start bg-[#4b607f] px-2 py-1 text-xs font-black text-white neo-border-sm">
                    {schedule.shift.name}
                  </span>
                )}

                {schedule.notes && <p className="rounded-lg bg-[#f5ede6] p-2 text-xs font-bold text-[#5a5a5a]">{schedule.notes}</p>}

                {isCoordinator && (
                  <button
                    type="button"
                    onClick={() => void deleteSchedule(schedule.id)}
                    className="neo-btn mt-auto min-h-[44px] bg-red-100 px-3 py-2 text-sm font-bold text-red-700"
                  >
                    <span className="flex items-center justify-center gap-2"><TbTrash className="h-4 w-4" /> Hapus</span>
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
