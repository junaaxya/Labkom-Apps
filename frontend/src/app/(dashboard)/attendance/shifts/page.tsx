"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TbBuildingWarehouse,
  TbCalendarEvent,
  TbChevronLeft,
  TbChevronRight,
  TbClock,
  TbLoader2,
  TbNotes,
  TbRefresh,
  TbTrash,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import type { AsLabPicketDestination, AttendanceSettings, Lab, RecurringShiftPattern, RecurringShiftPatternState, Role, Shift, ShiftSchedule, User } from "@/types";

type ApiMaybeWrapped<T> = T | { data?: T; items?: T } | Record<string, unknown>;
type WeeklyRoom = { labId: string; count: number };
type WeeklyGroup = WeeklyRoom & { userIds: string[] };
type WeeklyAssignment = { date: string; groups: WeeklyGroup[] };
type WeeklyApiAssignment = { date: string; labId: string; requiredAssistantCount: number; userIds: string[] };
type WeeklyPreviewPayload = { weekStart: string; shiftId: string; rooms: Array<{ labId: string; requiredAssistantCount: number }> };
type RecurringPlanPayload = { effectiveFrom: string; shiftId: string; notes?: string; assignments: WeeklyApiAssignment[] };

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DEFAULT_ACTIVE_PICKET_WEEKDAYS = [1, 2, 3, 4, 5];
const PICKET_WEEKDAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const legacyDestinationLabels: Record<AsLabPicketDestination, string> = {
  RUANGAN_ASLAB: "Ruangan Aslab",
  LAB_MULTIMEDIA: "Lab Multimedia",
  LAB_DASAR: "Lab Dasar",
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeArray<T>(value: unknown, keyCandidates: string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isObjectRecord(value)) return [];
  for (const key of keyCandidates) if (Array.isArray(value[key])) return value[key] as T[];
  if (Array.isArray(value.data)) return value.data as T[];
  if (isObjectRecord(value.data)) for (const key of keyCandidates) if (Array.isArray(value.data[key])) return value.data[key] as T[];
  return Array.isArray(value.items) ? value.items as T[] : [];
}

function currentRole(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) as unknown : null;
    return isObjectRecord(parsed) && typeof parsed.role === "string" ? parsed.role as Role : null;
  } catch { return null; }
}

function monthNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return year && monthNumber ? new Date(year, monthNumber - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : month;
}

function formatDate(dateString?: string): string {
  const date = dateString ? new Date(dateString) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("id-ID", { dateStyle: "full" }) : "-";
}

function formatWeekday(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

function normalizePicketWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_ACTIVE_PICKET_WEEKDAYS;
  const weekdays = value.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 6);
  return weekdays.length === value.length && weekdays.length > 0 && new Set(weekdays).size === weekdays.length
    ? [...weekdays].sort((left, right) => left - right)
    : DEFAULT_ACTIVE_PICKET_WEEKDAYS;
}

function getWeekDates(weekStart: string, activePicketWeekdays: number[]): string[] {
  const monday = weekStart ? new Date(`${weekStart}T00:00:00`) : null;
  if (!monday || Number.isNaN(monday.getTime())) return [];
  return activePicketWeekdays.map((weekday) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + weekday - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
}

function getMondayOfWeek(dateString: string): string {
  const selectedDate = dateString ? new Date(`${dateString}T00:00:00`) : null;
  if (!selectedDate || Number.isNaN(selectedDate.getTime())) return "";
  const dayOffset = selectedDate.getDay() === 0 ? -6 : 1 - selectedDate.getDay();
  selectedDate.setDate(selectedDate.getDate() + dayOffset);
  return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
}

function todayWeekStart(): string {
  const today = new Date();
  return getMondayOfWeek(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function parseRecurringPatternState(value: unknown): RecurringShiftPatternState {
  const data = isObjectRecord(value) && isObjectRecord(value.data) ? value.data : value;
  if (!isObjectRecord(data)) return { patterns: [] };
  const horizon = isObjectRecord(data.horizon) ? data.horizon : undefined;
  const pattern = isObjectRecord(data.pattern) ? data.pattern as RecurringShiftPattern : undefined;
  return {
    horizonStart: stringValue(data.horizonStart) ?? stringValue(horizon?.start),
    horizonEnd: stringValue(data.horizonEnd) ?? stringValue(horizon?.end),
    materializedWeeks: typeof data.materializedWeeks === "number"
      ? data.materializedWeeks
      : typeof horizon?.weeks === "number" ? horizon.weeks : undefined,
    patterns: safeArray<RecurringShiftPattern>(data, ["patterns"]).length > 0
      ? safeArray<RecurringShiftPattern>(data, ["patterns"])
      : pattern ? [pattern] : [],
  };
}

function effectivePatternWeek(pattern: RecurringShiftPattern): string | undefined {
  return stringValue(pattern.effectiveFrom) ?? stringValue(pattern.weekStart);
}

function groupWeeklyAssignments(assignments: WeeklyApiAssignment[]): WeeklyAssignment[] {
  const grouped = new Map<string, WeeklyGroup[]>();
  for (const assignment of assignments) {
    const groups = grouped.get(assignment.date) ?? [];
    groups.push({
      labId: assignment.labId,
      count: assignment.requiredAssistantCount,
      userIds: assignment.userIds,
    });
    grouped.set(assignment.date, groups);
  }
  return [...grouped.entries()]
    .map(([date, groups]) => ({ date, groups }))
    .sort((left, right) => left.date.localeCompare(right.date));
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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => Number(monthNow().slice(0, 4)));
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [aslabUsers, setAslabUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [activePicketWeekdays, setActivePicketWeekdays] = useState<number[]>(DEFAULT_ACTIVE_PICKET_WEEKDAYS);
  const [loading, setLoading] = useState(true);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<RecurringShiftPatternState>({ patterns: [] });
  const [submitting, setSubmitting] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [weeklyShiftId, setWeeklyShiftId] = useState("");
  const [weeklyNotes, setWeeklyNotes] = useState("");
  const [rooms, setRooms] = useState<WeeklyRoom[]>([]);
  const [weeklyAssignments, setWeeklyAssignments] = useState<WeeklyAssignment[]>([]);
  const isCoordinator = role === "KOORDINATOR_LAB";
  const picketLabs = useMemo(() => labs.filter((lab) => lab.status === "ACTIVE" && lab.isPicketEnabled), [labs]);
  const totalDailyStaff = rooms.reduce((total, room) => total + room.count, 0);
  const weekDates = (value: string) => getWeekDates(value, activePicketWeekdays);
  const currentWeekStart = todayWeekStart();
  const hasRecurringPattern = recurringPattern.patterns.length > 0;
  const selectedWeekIsCurrentOrFuture = Boolean(weekStart) && weekStart >= currentWeekStart;
  const canCreateDraft = Boolean(weekStart && weeklyShiftId && rooms.length > 0 && !submitting);
  const draftBlockReason = useMemo(() => {
    if (submitting) return "Sedang memproses...";
    if (!weekStart) return "Pilih minggu jadwal dulu.";
    if (!weeklyShiftId) return "Pilih shift dulu.";
    if (picketLabs.length === 0) return "Belum ada Lab aktif dengan Piket Aslab. Aktifkan di Manajemen Lab.";
    if (rooms.length === 0) return "Centang minimal satu Lab peserta piket.";
    return "";
  }, [picketLabs.length, rooms.length, submitting, weekStart, weeklyShiftId]);
  const effectivePatternStart = useMemo(() => recurringPattern.patterns.map(effectivePatternWeek).filter((week): week is string => Boolean(week)).sort().at(-1), [recurringPattern.patterns]);
  const summary = useMemo(() => ({
    scheduled: schedules.filter((schedule) => schedule.status === "SCHEDULED").length,
    completed: schedules.filter((schedule) => schedule.status === "COMPLETED").length,
    cancelled: schedules.filter((schedule) => schedule.status === "CANCELLED").length,
  }), [schedules]);

  const loadSchedules = useCallback(async (selectedMonth = month) => {
    if (!role) return;
    setLoading(true);
    try {
      const endpoint = isCoordinator ? `/attendance/shift-schedules?month=${selectedMonth}` : "/attendance/shift-schedules/me";
      setSchedules(safeArray<ShiftSchedule>(await api.get<ApiMaybeWrapped<ShiftSchedule[]>>(endpoint), ["schedules", "rows"]));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat jadwal piket.");
      setSchedules([]);
    } finally { setLoading(false); }
  }, [isCoordinator, month, role, toast]);

  const loadReferences = useCallback(async () => {
    if (!isCoordinator) return;
    setReferencesLoading(true);
    try {
      const [usersRes, shiftsRes, labsRes, settingsRes] = await Promise.all([
        api.get<ApiMaybeWrapped<User[]> | Record<string, unknown>>("/users?role=ASISTEN_LAB"),
        api.get<ApiMaybeWrapped<Shift[]> | Record<string, unknown>>("/shifts"),
        api.get<ApiMaybeWrapped<Lab[]> | Record<string, unknown>>("/labs"),
        api.get<AttendanceSettings | ApiMaybeWrapped<AttendanceSettings>>("/attendance/settings"),
      ]);
      setAslabUsers(safeArray<User>(usersRes, ["users", "rows"]));
      const nextShifts = safeArray<Shift>(shiftsRes, ["shifts", "rows"]);
      setShifts(nextShifts);
      setLabs(safeArray<Lab>(labsRes, ["labs", "rows"]));
      const settings: unknown = isObjectRecord(settingsRes) && isObjectRecord(settingsRes.data) ? settingsRes.data : settingsRes;
      setActivePicketWeekdays(normalizePicketWeekdays(isObjectRecord(settings) ? settings.activePicketWeekdays : undefined));
      if (nextShifts.length === 1) {
        setWeeklyShiftId((current) => current || nextShifts[0].id);
      }
    } catch {
      setAslabUsers([]); setShifts([]); setLabs([]); setActivePicketWeekdays(DEFAULT_ACTIVE_PICKET_WEEKDAYS);
      toast.error("Gagal memuat referensi jadwal piket.");
    } finally { setReferencesLoading(false); }
  }, [isCoordinator, toast]);

  const loadRecurringPattern = useCallback(async () => {
    if (!isCoordinator) return;
    setRecurringLoading(true);
    try {
      setRecurringPattern(parseRecurringPatternState(await api.get<unknown>("/attendance/shift-schedules/recurring-pattern")));
    } catch (error) {
      setRecurringPattern({ patterns: [] });
      toast.error(error instanceof Error ? error.message : "Gagal memuat pola piket berulang.");
    } finally { setRecurringLoading(false); }
  }, [isCoordinator, toast]);

  useEffect(() => { queueMicrotask(() => void loadSchedules()); }, [loadSchedules]);
  useEffect(() => { queueMicrotask(() => void loadReferences()); }, [loadReferences]);
  useEffect(() => { queueMicrotask(() => void loadRecurringPattern()); }, [loadRecurringPattern]);

  const clearDraft = () => setWeeklyAssignments([]);
  const toggleRoom = (lab: Lab) => {
    setRooms((current) => current.some((room) => room.labId === lab.id)
      ? current.filter((room) => room.labId !== lab.id)
      : [...current, { labId: lab.id, count: Math.min(50, Math.max(1, lab.defaultPicketAssistantCount || 1)) }]);
    clearDraft();
  };
  const updateRoomCount = (labId: string, count: number) => {
    setRooms((current) => current.map((room) => room.labId === labId ? { ...room, count: Math.min(50, Math.max(1, count || 1)) } : room));
    clearDraft();
  };
  const updateAssignment = (date: string, labId: string, slotIndex: number, userId: string) => {
    setWeeklyAssignments((current) => current.map((assignment) => assignment.date !== date ? assignment : {
      ...assignment,
      groups: assignment.groups.map((group) => group.labId !== labId ? group : {
        ...group,
        userIds: group.userIds.map((assignedUserId, index) => index === slotIndex ? userId : assignedUserId),
      }),
    }));
  };
  const createWeeklyDraft = async () => {
    if (!canCreateDraft) {
      toast.error(draftBlockReason || "Pilih minggu jadwal, shift, dan minimal satu Lab piket.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: WeeklyPreviewPayload = {
        weekStart,
        shiftId: weeklyShiftId,
        rooms: rooms.map((room) => ({ labId: room.labId, requiredAssistantCount: room.count })),
      };
      const response = await api.post<ApiMaybeWrapped<WeeklyApiAssignment[]> | Record<string, unknown>>(
        "/attendance/shift-schedules/weekly-preview", payload,
      );
      const assignments = groupWeeklyAssignments(safeArray<WeeklyApiAssignment>(response, ["assignments", "rows"]));
      if (assignments.length !== weekDates(weekStart).length) throw new Error("Draft pembagian piket tidak tersedia.");
      setWeeklyAssignments(assignments);
      toast.success("Aslab sudah diacak otomatis. Boleh ubah lewat dropdown, lalu simpan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal membuat draft pembagian piket."); }
    finally { setSubmitting(false); }
  };

  const saveWeeklyPlan = async () => {
    const dates = weekDates(weekStart);
    if (!weekStart || !weeklyShiftId || rooms.length === 0 || dates.length === 0) {
      toast.error("Pilih minggu jadwal, shift, dan Lab piket yang valid terlebih dahulu."); return;
    }
    const isComplete = dates.every((date) => {
      const assignment = weeklyAssignments.find((item) => item.date === date);
      if (!assignment || assignment.groups.length !== rooms.length) return false;
      const userIds = assignment.groups.flatMap((group) => group.userIds);
      return rooms.every((room) => {
        const group = assignment.groups.find((item) => item.labId === room.labId);
        return group?.count === room.count && group.userIds.length === room.count && group.userIds.every(Boolean);
      }) && userIds.length === totalDailyStaff && new Set(userIds).size === userIds.length;
    });
    if (!isComplete) { toast.error("Setiap hari harus memiliki Aslab berbeda pada seluruh slot Lab yang dipilih."); return; }
    if (!selectedWeekIsCurrentOrFuture) {
      toast.error("Pilih minggu ini atau minggu mendatang. Minggu lalu tidak bisa diganti."); return;
    }
    setSubmitting(true);
    try {
      const payload: RecurringPlanPayload = {
        effectiveFrom: weekStart,
        shiftId: weeklyShiftId,
        ...(weeklyNotes.trim() ? { notes: weeklyNotes.trim() } : {}),
        assignments: weeklyAssignments.flatMap((assignment) => assignment.groups.map((group) => ({
          date: assignment.date,
          labId: group.labId,
          requiredAssistantCount: group.count,
          userIds: group.userIds,
        }))),
      };
      await api.post("/attendance/shift-schedules/recurring-plan", payload);
      toast.success("Pola piket 8 minggu berhasil disetujui.");
      const savedMonth = weekStart.slice(0, 7); setMonth(savedMonth); await loadSchedules(savedMonth);
      await loadRecurringPattern();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan jadwal piket mingguan."); }
    finally { setSubmitting(false); }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try { await api.delete(`/attendance/shift-schedules/${scheduleId}`); toast.success("Jadwal piket berhasil dihapus."); await loadSchedules(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus jadwal piket."); }
  };

  const deleteSelectedWeek = async () => {
    if (!weekStart) {
      toast.error("Pilih minggu jadwal dulu.");
      return;
    }
    if (!window.confirm(`Hapus semua jadwal piket SCHEDULED pada minggu ${formatDate(weekStart)}?`)) return;
    setSubmitting(true);
    try {
      const result = await api.delete<{ success: boolean; message?: string; data?: { deletedCount?: number } }>(
        `/attendance/shift-schedules/week?weekStart=${encodeURIComponent(weekStart)}`,
      );
      toast.success(result.message || `${result.data?.deletedCount ?? 0} jadwal minggu dihapus.`);
      clearDraft();
      await loadSchedules(weekStart.slice(0, 7));
      await loadRecurringPattern();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus jadwal minggu.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRecurringPattern = async () => {
    if (!hasRecurringPattern) {
      toast.error("Belum ada pola berulang aktif.");
      return;
    }
    if (!window.confirm("Hapus pola piket berulang? Jadwal mendatang dari pola ini akan dibersihkan. Riwayat lama tetap ada.")) return;
    setSubmitting(true);
    try {
      const result = await api.delete<{ success: boolean; message?: string }>(
        "/attendance/shift-schedules/recurring-pattern",
      );
      toast.success(result.message || "Pola piket berulang dihapus.");
      clearDraft();
      await loadRecurringPattern();
      await loadSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus pola berulang.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectMonth = (monthIndex: number) => { setMonth(`${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}`); setMonthPickerOpen(false); };

  return <div className="space-y-4 sm:space-y-6">
    <header className="neo-card p-4 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center bg-[#4b607f] text-white neo-border"><TbCalendarEvent className="h-7 w-7" /></div><div><h1 className="font-heading text-2xl font-black text-[#1a1a1a] sm:text-3xl">Jadwal Piket Aslab</h1><p className="mt-1 text-sm font-medium text-[#5a5a5a]">{isCoordinator ? "Kelola assignment piket asisten lab per tanggal, Lab, dan shift." : "Lihat jadwal piket pribadi yang ditugaskan koordinator."}</p></div></div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-stretch">
        {isCoordinator && <div className="neo-border relative flex flex-col gap-2 rounded-lg bg-white p-3 sm:min-w-[280px]"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#1a1a1a]"><TbCalendarEvent className="h-5 w-5 shrink-0 text-[#f3701e]" /> Filter kalender bulanan</span><button type="button" aria-label="Buka kalender bulan dan tahun" aria-expanded={monthPickerOpen} onClick={() => { setPickerYear(Number(month.slice(0, 4))); setMonthPickerOpen((open) => !open); }} className="neo-input flex min-h-[44px] w-full items-center justify-between rounded-md bg-[#f5ede6] px-3 text-left text-base font-black text-[#1a1a1a] outline-none focus-visible:ring-4 focus-visible:ring-[#f3701e]"><span>{formatMonth(month)}</span><TbCalendarEvent className="h-5 w-5 text-[#4b607f]" /></button><span className="text-xs font-bold text-[#5a5a5a]">Menampilkan jadwal {formatMonth(month)}</span>{monthPickerOpen && <div className="neo-card absolute left-0 right-0 top-[calc(100%+8px)] z-30 bg-[#f5ede6] p-3 sm:left-auto sm:min-w-[360px]"><div className="mb-3 flex items-center justify-between gap-2"><button type="button" aria-label="Tahun sebelumnya" onClick={() => setPickerYear((year) => year - 1)} className="neo-btn flex min-h-[44px] min-w-[44px] items-center justify-center bg-white"><TbChevronLeft className="h-5 w-5" /></button><p className="font-heading text-xl font-black text-[#1a1a1a]">{pickerYear}</p><button type="button" aria-label="Tahun berikutnya" onClick={() => setPickerYear((year) => year + 1)} className="neo-btn flex min-h-[44px] min-w-[44px] items-center justify-center bg-white"><TbChevronRight className="h-5 w-5" /></button></div><div className="grid grid-cols-3 gap-2">{MONTH_NAMES.map((monthName, monthIndex) => { const selected = `${pickerYear}-${String(monthIndex + 1).padStart(2, "0")}` === month; return <button key={monthName} type="button" aria-pressed={selected} onClick={() => selectMonth(monthIndex)} className={`min-h-[44px] rounded-md px-2 py-2 text-sm font-black neo-border-sm ${selected ? "bg-[#f3701e] text-white" : "bg-white text-[#1a1a1a] hover:bg-[#e8d8c9]"}`}>{monthName}</button>; })}</div><button type="button" onClick={() => setMonthPickerOpen(false)} className="mt-3 min-h-[44px] w-full rounded-md bg-white text-sm font-black text-[#1a1a1a] neo-border-sm">Tutup</button></div>}</div>}
        <button type="button" onClick={() => void loadSchedules()} disabled={loading} className="neo-btn min-h-[44px] bg-white px-4 py-2 text-sm font-bold text-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-60"><span className="flex items-center justify-center gap-2"><TbRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Memuat..." : "Muat ulang"}</span></button>
      </div>
    </div></header>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ label: "Terjadwal", value: summary.scheduled, tone: "text-[#4b607f]" }, { label: "Selesai", value: summary.completed, tone: "text-green-700" }, { label: "Dibatalkan", value: summary.cancelled, tone: "text-red-700" }].map((item) => <div key={item.label} className="neo-card p-4"><p className="text-xs font-black uppercase text-[#5a5a5a]">{item.label}</p><p className={`font-heading text-3xl font-black ${item.tone}`}>{item.value}</p></div>)}</section>
    {isCoordinator && <section className="neo-card p-4 sm:p-5" aria-live="polite"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-heading text-xl font-black text-[#1a1a1a]">Pola Piket Berulang</h2><p className="mt-1 text-sm font-medium text-[#5a5a5a]">Persetujuan rencana membuat atau melanjutkan pola yang dipakai otomatis selama 8 minggu.</p></div><div className="flex items-center gap-2">{recurringLoading && <TbLoader2 className="h-5 w-5 animate-spin text-[#4b607f]" aria-label="Memuat pola piket berulang" />}{hasRecurringPattern && <button type="button" onClick={() => void deleteRecurringPattern()} disabled={submitting} className="neo-btn min-h-[44px] bg-red-100 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-60"><span className="flex items-center gap-2"><TbTrash className="h-4 w-4" /> Hapus pola berulang</span></button>}</div></div>{hasRecurringPattern ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg bg-[#eef2f7] p-3 neo-border-sm"><p className="text-xs font-black uppercase text-[#5a5a5a]">Horizon aktif</p><p className="mt-1 text-sm font-black text-[#1a1a1a]">{formatDate(recurringPattern.horizonStart)} – {formatDate(recurringPattern.horizonEnd)}</p></div><div className="rounded-lg bg-white p-3 neo-border-sm"><p className="text-xs font-black uppercase text-[#5a5a5a]">Pola efektif</p><p className="mt-1 text-sm font-black text-[#1a1a1a]">Mulai {formatDate(effectivePatternStart)}</p></div><div className="rounded-lg bg-white p-3 neo-border-sm"><p className="text-xs font-black uppercase text-[#5a5a5a]">Minggu tersedia</p><p className="mt-1 text-sm font-black text-[#1a1a1a]">{recurringPattern.materializedWeeks ?? "-"} minggu</p></div><div className="rounded-lg bg-white p-3 neo-border-sm"><p className="text-xs font-black uppercase text-[#5a5a5a]">Versi pola</p><p className="mt-1 text-sm font-black text-[#1a1a1a]">{recurringPattern.patterns.length} versi</p></div></div> : !recurringLoading && <p className="mt-4 rounded-lg bg-[#f5ede6] p-3 text-sm font-bold text-[#5a5a5a] neo-border-sm">Belum ada pola aktif. Setujui draft pertama untuk membuat horizon 8 minggu.</p>}</section>}
    {isCoordinator && <section className="neo-card overflow-hidden p-0"><div className="border-b-[3px] border-[#1a1a1a] bg-[#f5ede6] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-xl font-black text-[#1a1a1a]">Rencana Piket Mingguan</h2><p className="text-sm font-medium text-[#5a5a5a]">Pilih lab + shift, klik Acak untuk isi Aslab otomatis, lalu ubah manual bila perlu sebelum simpan.</p></div>{referencesLoading && <TbLoader2 className="h-5 w-5 animate-spin text-[#4b607f]" />}</div></div>
      <div className="space-y-5 p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-2"><label><span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]"><TbCalendarEvent className="h-4 w-4" /> Pilih minggu jadwal</span><input type="date" value={weekStart} onChange={(event) => { setWeekStart(getMondayOfWeek(event.target.value)); clearDraft(); }} required className="neo-input neo-border mt-1 min-h-[44px] w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]" /><span className="mt-1 block text-xs font-medium text-[#5a5a5a]">Pilih tanggal apa pun. Sistem otomatis memakai hari Senin pada minggu tersebut.</span></label><label><span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]"><TbClock className="h-4 w-4" /> Shift</span><select value={weeklyShiftId} onChange={(event) => { setWeeklyShiftId(event.target.value); clearDraft(); }} className="neo-input neo-border mt-1 min-h-[44px] w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]"><option value="">Pilih Shift</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name || "Shift"} · {shift.startTime} - {shift.endTime}</option>)}</select></label></div>
        <div className="border-t-[3px] border-[#1a1a1a] pt-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-heading text-lg font-black text-[#1a1a1a]">Lab peserta piket</h3><p className="text-xs font-bold text-[#5a5a5a]">{totalDailyStaff} Aslab/hari · {totalDailyStaff * activePicketWeekdays.length} penugasan/minggu</p></div><p className="mt-1 text-xs font-bold text-[#5a5a5a]">Hari aktif: {activePicketWeekdays.map((day) => PICKET_WEEKDAY_LABELS[day - 1]).join(", ")}</p>{picketLabs.length === 0 ? <p className="mt-3 rounded-lg bg-[#f5ede6] p-3 text-sm font-bold text-[#5a5a5a] neo-border-sm">Belum ada Lab aktif dengan Piket Aslab. Atur melalui Manajemen Lab.</p> : <div className="mt-3 grid gap-3 md:grid-cols-2">{picketLabs.map((lab) => { const room = rooms.find((item) => item.labId === lab.id); return <div key={lab.id} className={`rounded-lg p-3 neo-border-sm ${room ? "bg-[#eef2f7]" : "bg-white"}`}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-black text-[#1a1a1a]"><input type="checkbox" checked={Boolean(room)} onChange={() => toggleRoom(lab)} className="h-5 w-5 accent-[#4b607f]" /><TbBuildingWarehouse className="h-5 w-5 text-[#f3701e]" />{lab.name}</label>{room && <label className="mt-3 block"><span className="text-xs font-bold uppercase text-[#5a5a5a]">Jumlah Aslab minggu ini</span><input type="number" min={1} max={50} value={room.count} onChange={(event) => updateRoomCount(lab.id, parseInt(event.target.value))} className="neo-input mt-1 min-h-[44px] w-full rounded-md bg-white px-3 text-sm font-bold text-[#1a1a1a]" /></label>}</div>; })}</div>}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><button type="button" onClick={() => void createWeeklyDraft()} disabled={!canCreateDraft} className="neo-btn min-h-[44px] bg-[#f3701e] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" title={draftBlockReason || "Acak Aslab otomatis"}><span className="flex items-center justify-center gap-2"><TbRefresh className="h-4 w-4" /> {hasRecurringPattern ? "Acak ulang otomatis" : "Acak Aslab otomatis"}</span></button><button type="button" onClick={() => void deleteSelectedWeek()} disabled={submitting || !weekStart} className="neo-btn min-h-[44px] bg-red-100 px-4 py-2 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"><span className="flex items-center justify-center gap-2"><TbTrash className="h-4 w-4" /> Hapus jadwal minggu ini</span></button></div>{draftBlockReason ? <p className="mt-2 rounded-lg bg-[#f5ede6] p-2 text-xs font-bold text-[#8a4b12] neo-border-sm">{draftBlockReason}</p> : <p className="mt-2 text-xs font-bold text-[#5a5a5a]">Acak mengisi Aslab otomatis. Dropdown tetap bisa diubah manual. Simpan boleh untuk minggu ini atau minggu mendatang.</p>}{weekStart && !selectedWeekIsCurrentOrFuture && <p className="mt-2 text-xs font-bold text-[#8a4b12]">Minggu lalu tidak bisa disimpan. Pilih minggu ini atau minggu depan.</p>}
        {weeklyAssignments.length > 0 && <p className="rounded-lg bg-[#f5ede6] p-3 text-sm font-bold text-[#1a1a1a] neo-border-sm">Aslab sudah terisi otomatis. Ubah lewat dropdown bila perlu, lalu simpan untuk 8 minggu ke depan.</p>}
        {weekDates(weekStart).length > 0 && weeklyAssignments.length > 0 && <div className="space-y-4 border-t-[3px] border-[#1a1a1a] pt-5">{weekDates(weekStart).map((date) => { const assignment = weeklyAssignments.find((item) => item.date === date); const usedUserIds = assignment?.groups.flatMap((group) => group.userIds) ?? []; return <article key={date} className="neo-border rounded-lg bg-[#eef2f7] p-3 sm:p-4"><h3 className="font-heading text-lg font-black capitalize text-[#1a1a1a]">{formatWeekday(date)}</h3><p className="mt-1 text-xs font-bold text-[#5a5a5a]">{totalDailyStaff} Aslab untuk hari ini</p><div className="mt-3 space-y-3">{rooms.map((room) => { const group = assignment?.groups.find((item) => item.labId === room.labId); const lab = picketLabs.find((item) => item.id === room.labId); return <div key={room.labId} className="rounded-lg bg-white p-3 neo-border-sm"><p className="flex items-center gap-2 text-sm font-black text-[#1a1a1a]"><TbBuildingWarehouse className="h-4 w-4 text-[#f3701e]" /> {lab?.name ?? "Lab"} · {room.count} Aslab</p><div className="mt-2 grid gap-2 md:grid-cols-2">{Array.from({ length: room.count }, (_, slotIndex) => { const selectedUserId = group?.userIds[slotIndex] ?? ""; return <select key={slotIndex} value={selectedUserId} onChange={(event) => updateAssignment(date, room.labId, slotIndex, event.target.value)} className="neo-input min-h-[44px] w-full rounded-md bg-[#f5ede6] px-3 text-sm font-bold text-[#1a1a1a]"><option value="">Pilih Aslab {slotIndex + 1}</option>{aslabUsers.map((user) => <option key={user.id} value={user.id} disabled={user.id !== selectedUserId && usedUserIds.includes(user.id)}>{user.name}</option>)}</select>; })}</div></div>; })}</div></article>; })}<label className="block"><span className="flex items-center gap-1 text-xs font-bold uppercase text-[#5a5a5a]"><TbNotes className="h-4 w-4" /> Catatan</span><textarea value={weeklyNotes} onChange={(event) => setWeeklyNotes(event.target.value)} rows={3} placeholder="Catatan jadwal piket minggu ini" className="neo-input neo-border mt-1 w-full rounded-lg bg-white px-3 py-2 text-[#1a1a1a]" /></label><div className="flex flex-col gap-3 border-t-[3px] border-[#1a1a1a] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-[#5a5a5a]">Setiap hari membutuhkan {totalDailyStaff} Aslab berbeda pada seluruh Lab yang dipilih.</p><button type="button" onClick={() => void saveWeeklyPlan()} disabled={submitting} className="neo-btn min-h-[44px] bg-[#4b607f] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{submitting ? <span className="flex items-center gap-2"><TbLoader2 className="h-4 w-4 animate-spin" /> Menyimpan...</span> : "Simpan jadwal minggu ini"}</button></div></div>}
      </div>
    </section>}
    <section className="neo-card p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-heading text-xl font-black text-[#1a1a1a]">Daftar Jadwal Piket</h2><p className="text-sm font-medium text-[#5a5a5a]">{isCoordinator ? `Jadwal untuk ${formatMonth(month)}` : "Jadwal yang aktif untuk akun Anda."}</p></div><span className="rounded-lg bg-[#f3701e] px-3 py-1 text-xs font-black text-white neo-border-sm">{schedules.length} jadwal</span></div>{loading ? <div className="flex flex-col items-center gap-2 py-10 text-center font-bold text-[#5a5a5a]"><TbLoader2 className="h-8 w-8 animate-spin text-[#4b607f]" /> Memuat jadwal...</div> : schedules.length === 0 ? <div className="rounded-xl border-[3px] border-dashed border-[#1a1a1a] bg-white p-8 text-center"><p className="font-heading text-xl font-black text-[#1a1a1a]">Belum ada jadwal piket.</p><p className="mt-1 text-sm font-medium text-[#5a5a5a]">{isCoordinator ? `Tidak ada jadwal pada ${formatMonth(month)}. Pilih bulan lain atau tambahkan jadwal baru.` : "Koordinator belum menugaskan jadwal bulan ini."}</p></div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{schedules.map((schedule) => <article key={schedule.id} className="neo-card flex flex-col gap-3 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-heading text-lg font-black text-[#1a1a1a]">{formatDate(schedule.scheduleDate)}</p>{isCoordinator && <p className="text-sm font-bold text-[#4b607f]">{schedule.user?.name ?? "Aslab"}</p>}</div><span className={`rounded-md px-2 py-1 text-[10px] font-black neo-border-sm ${statusClass(schedule.status)}`}>{schedule.status}</span></div><div className="space-y-2 text-sm font-bold text-[#1a1a1a]"><p className="flex items-center gap-2"><TbBuildingWarehouse className="h-4 w-4 text-[#f3701e]" /> {schedule.lab?.name ?? (schedule.destination ? legacyDestinationLabels[schedule.destination] : "-")}</p><p className="flex items-center gap-2"><TbClock className="h-4 w-4 text-[#f3701e]" /> {schedule.shift?.startTime ?? "-"} - {schedule.shift?.endTime ?? "-"}</p></div>{schedule.shift?.name && <span className="self-start bg-[#4b607f] px-2 py-1 text-xs font-black text-white neo-border-sm">{schedule.shift.name}</span>}{schedule.notes && <p className="rounded-lg bg-[#f5ede6] p-2 text-xs font-bold text-[#5a5a5a]">{schedule.notes}</p>}{isCoordinator && <button type="button" onClick={() => void deleteSchedule(schedule.id)} className="neo-btn mt-auto min-h-[44px] bg-red-100 px-3 py-2 text-sm font-bold text-red-700"><span className="flex items-center justify-center gap-2"><TbTrash className="h-4 w-4" /> Hapus</span></button>}</article>)}</div>}</section>
  </div>;
}
