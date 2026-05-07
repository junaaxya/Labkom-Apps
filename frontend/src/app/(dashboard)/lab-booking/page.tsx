"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  TbCalendarClock,
  TbChecklist,
  TbClipboardList,
  TbClockHour4,
  TbFileDescription,
  TbMapPin,
  TbSend,
  TbUser,
  TbUsers,
  TbX,
} from "react-icons/tb";
import api from "@/services/api";
import type { BookingStatus, Lab, LabBooking, Role, User } from "@/types";
import { useToast } from "@/providers/toast-provider";

type BookingPurpose = "UKM" | "Lomba" | "Kerja Kelompok" | "Riset" | "Pelatihan" | "Lainnya";
type TabKey = "request" | "history" | "approval";

const PURPOSE_OPTIONS: BookingPurpose[] = ["UKM", "Lomba", "Kerja Kelompok", "Riset", "Pelatihan", "Lainnya"];

const STATUS_CONFIG: Record<BookingStatus, { label: string; classes: string }> = {
  PENDING: { label: "Menunggu", classes: "bg-yellow-400 text-[#1a1a1a]" },
  APPROVED: { label: "Disetujui", classes: "bg-green-500 text-white" },
  REJECTED: { label: "Ditolak", classes: "bg-red-500 text-white" },
  CANCELLED: { label: "Dibatalkan", classes: "bg-gray-400 text-white" },
};

interface ListBookingResponse {
  items: LabBooking[];
}

function isApprovalRole(role?: Role): boolean {
  return role === "KOORDINATOR_LAB" || role === "ASISTEN_LAB";
}

export default function LabBookingPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("request");
  const [labs, setLabs] = useState<Lab[]>([]);
  const [myBookings, setMyBookings] = useState<LabBooking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<LabBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<LabBooking | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingBookingId, setActingBookingId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [form, setForm] = useState({
    labId: "",
    title: "",
    description: "",
    purpose: "UKM" as BookingPurpose,
    date: "",
    startTime: "",
    endTime: "",
    participants: "1",
  });

  const canApprove = isApprovalRole(user?.role);
  const canRequest = user?.role === "MAHASISWA";

  const fetchLabs = async () => {
    const res = await api.get<{ data: Lab[] }>("/labs");
    setLabs(res.data ?? []);
  };

  const fetchMyBookings = async () => {
    const res = await api.get<{ data: LabBooking[] }>("/bookings/my");
    setMyBookings(res.data ?? []);
  };

  const fetchPendingBookings = async () => {
    if (!canApprove) {
      setPendingBookings([]);
      return;
    }

    const res = await api.get<{ data: ListBookingResponse }>("/bookings?status=PENDING&limit=100");
    setPendingBookings(res.data?.items ?? []);
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchLabs(), fetchMyBookings(), fetchPendingBookings()]);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat data peminjaman lab.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        setUser(parsed);
        if (isApprovalRole(parsed.role)) {
          setActiveTab("approval");
        }
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshData();
  }, [user]);

  const stats = useMemo(() => {
    return {
      total: myBookings.length,
      pending: myBookings.filter((b) => b.status === "PENDING").length,
      approved: myBookings.filter((b) => b.status === "APPROVED").length,
      rejected: myBookings.filter((b) => b.status === "REJECTED").length,
    };
  }, [myBookings]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post<{ message: string }>("/bookings", {
        labId: form.labId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        purpose: form.purpose,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        participants: Number(form.participants),
      });

      toast.success("Pengajuan peminjaman berhasil dikirim.");
      setForm({
        labId: "",
        title: "",
        description: "",
        purpose: "UKM",
        date: "",
        startTime: "",
        endTime: "",
        participants: "1",
      });
      setActiveTab("history");
      await refreshData();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengajukan peminjaman lab.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    setActingBookingId(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/cancel`, {});
      toast.success("Pengajuan berhasil dibatalkan.");
      await refreshData();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal membatalkan pengajuan.");
    } finally {
      setActingBookingId(null);
    }
  };

  const handleApprove = async (bookingId: string) => {
    setActingBookingId(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/approve`, {});
      toast.success("Pengajuan berhasil disetujui dan jadwal peminjaman dibuat.");
      setSelectedBooking(null);
      await refreshData();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal menyetujui pengajuan.");
    } finally {
      setActingBookingId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }

    setActingBookingId(bookingId);
    try {
      await api.patch(`/bookings/${bookingId}/reject`, { reason: rejectReason.trim() });
      toast.success("Pengajuan berhasil ditolak.");
      setRejectReason("");
      setSelectedBooking(null);
      await refreshData();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal menolak pengajuan.");
    } finally {
      setActingBookingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="neo-card p-6 md:p-8 bg-white neo-card-hover transition-all duration-200">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#e8d8c9] text-[#1a1a1a] neo-border flex items-center justify-center shrink-0 shadow-[4px_4px_0px_#1a1a1a]">
            <TbCalendarClock size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-[#1a1a1a] mb-2">Peminjaman Lab Mandiri</h1>
            <p className="text-base font-medium text-[#5a5a5a] max-w-2xl">
              Ajukan peminjaman laboratorium, pantau status persetujuan, dan lihat riwayat peminjaman Anda dalam satu tempat terpusat.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="neo-card p-5 text-center bg-white neo-card-hover transition-all duration-200">
          <p className="text-4xl font-heading font-bold text-[#4b607f]">{stats.total}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Total Pengajuan</p>
        </div>
        <div className="neo-card p-5 text-center bg-white neo-card-hover transition-all duration-200">
          <p className="text-4xl font-heading font-bold text-yellow-500">{stats.pending}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Menunggu</p>
        </div>
        <div className="neo-card p-5 text-center bg-white neo-card-hover transition-all duration-200">
          <p className="text-4xl font-heading font-bold text-green-500">{stats.approved}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Disetujui</p>
        </div>
        <div className="neo-card p-5 text-center bg-white neo-card-hover transition-all duration-200">
          <p className="text-4xl font-heading font-bold text-red-500">{stats.rejected}</p>
          <p className="text-sm font-bold text-[#5a5a5a] mt-2">Ditolak</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-1.5 bg-[#f5ede6] neo-border rounded-2xl w-fit">
        {canRequest && (
          <button
            onClick={() => setActiveTab("request")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === "request" 
                ? "bg-[#1a1a1a] text-white neo-border shadow-[2px_2px_0px_#f3701e] translate-x-[-2px] translate-y-[-2px]" 
                : "bg-transparent text-[#5a5a5a] hover:text-[#1a1a1a]"
            }`}
          >
            Ajukan Peminjaman
          </button>
        )}
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === "history" 
              ? "bg-[#1a1a1a] text-white neo-border shadow-[2px_2px_0px_#f3701e] translate-x-[-2px] translate-y-[-2px]" 
              : "bg-transparent text-[#5a5a5a] hover:text-[#1a1a1a]"
          }`}
        >
          {canApprove ? "Semua Peminjaman" : "Riwayat Peminjaman"}
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab("approval")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
              activeTab === "approval" 
                ? "bg-[#1a1a1a] text-white neo-border shadow-[2px_2px_0px_#f3701e] translate-x-[-2px] translate-y-[-2px]" 
                : "bg-transparent text-[#5a5a5a] hover:text-[#1a1a1a]"
            }`}
          >
            Persetujuan 
            <span className={`px-2 py-0.5 rounded-md text-xs ${activeTab === "approval" ? "bg-[#f3701e] text-white" : "bg-red-100 text-red-600"}`}>
              {pendingBookings.length}
            </span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="neo-card p-8 bg-white text-center text-[#5a5a5a]">Memuat data peminjaman...</div>
      ) : (
        <>
          {activeTab === "request" && canRequest && (
            <form onSubmit={handleSubmit} className="neo-card p-6 md:p-8 bg-white space-y-6">
              <h2 className="font-heading font-bold text-xl text-[#1a1a1a] mb-4 pb-4 border-b-2 border-dashed border-gray-200 flex items-center gap-2">
                <TbClipboardList className="text-[#f3701e]" size={24} strokeWidth={2.2} /> Form Pengajuan
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Pilih Laboratorium *</label>
                  <select
                    required
                    value={form.labId}
                    onChange={(e) => setForm((prev) => ({ ...prev, labId: e.target.value }))}
                    className="w-full px-4 py-3.5 neo-input bg-white text-base focus:shadow-[4px_4px_0px_#4b607f] transition-all cursor-pointer"
                  >
                    <option value="">— Pilih Lab —</option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name} - {lab.location}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Nama Kegiatan *</label>
                  <input
                    required
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Contoh: Persiapan Lomba UI/UX"
                    className="w-full px-4 py-3.5 neo-input bg-white text-base focus:shadow-[4px_4px_0px_#4b607f] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Deskripsi Kegiatan</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Jelaskan secara singkat rencana kegiatan yang akan dilakukan di laboratorium..."
                  className="w-full px-4 py-3.5 neo-input bg-white text-base focus:shadow-[4px_4px_0px_#4b607f] transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#f8f9fa] p-5 rounded-xl neo-border">
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Tujuan *</label>
                  <select
                    value={form.purpose}
                    onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value as BookingPurpose }))}
                    className="w-full px-4 py-3 neo-input bg-white text-base cursor-pointer"
                  >
                    {PURPOSE_OPTIONS.map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purpose}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Tanggal *</label>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 neo-input bg-white text-base cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Jam Mulai *</label>
                  <input
                    required
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-3 neo-input bg-white text-base cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Jam Selesai *</label>
                  <input
                    required
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-3 neo-input bg-white text-base cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
                <div className="w-full md:w-1/3">
                  <label className="text-sm font-bold text-[#1a1a1a] mb-2 block">Jumlah Peserta *</label>
                  <div className="relative">
                    <input
                      required
                      min={1}
                      type="number"
                      value={form.participants}
                      onChange={(e) => setForm((prev) => ({ ...prev, participants: e.target.value }))}
                      className="w-full px-4 py-3.5 pl-12 neo-input bg-white text-base focus:shadow-[4px_4px_0px_#4b607f] transition-all"
                    />
                    <TbUsers className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" size={20} />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="neo-btn w-full md:w-auto px-8 py-3.5 bg-[#f3701e] text-white text-base font-bold inline-flex justify-center items-center gap-2 disabled:opacity-60 hover:bg-[#e05b0c] transition-colors"
                >
                  <TbSend size={20} strokeWidth={2.5} />
                  {submitting ? "Mengirim Pengajuan..." : "Kirim Pengajuan"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              {myBookings.length === 0 ? (
                <div className="neo-card p-12 bg-white/50 text-center border-dashed">
                  <TbCalendarClock className="w-16 h-16 text-[#4b607f]/40 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-xl font-bold font-heading text-[#1a1a1a] mb-2">Belum ada riwayat peminjaman</p>
                  <p className="text-[#5a5a5a] text-sm">Ajukan peminjaman lab untuk memulai kegiatanmu!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myBookings.map((booking) => (
                    <div key={booking.id} className="neo-card p-5 bg-white neo-card-hover transition-all duration-200">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1">
                          <h3 className="font-heading font-bold text-xl text-[#1a1a1a] leading-tight mb-2 line-clamp-1">{booking.title}</h3>
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold neo-border ${STATUS_CONFIG[booking.status].classes}`}>
                            {STATUS_CONFIG[booking.status].label}
                          </span>
                        </div>
                      </div>
                      
                      <div className="bg-[#f8f9fa] rounded-xl p-4 neo-border mb-4 grid grid-cols-2 gap-y-3 gap-x-2">
                        <div className="flex items-center gap-2 text-sm text-[#1a1a1a] font-medium">
                          <div className="w-6 h-6 rounded bg-[#e8d8c9] neo-border flex items-center justify-center shrink-0">
                            <TbMapPin size={14} />
                          </div>
                          <span className="truncate">{booking.lab?.name ?? "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#1a1a1a] font-medium">
                          <div className="w-6 h-6 rounded bg-[#e8d8c9] neo-border flex items-center justify-center shrink-0">
                            <TbCalendarClock size={14} />
                          </div>
                          <span className="truncate">{new Date(booking.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#1a1a1a] font-medium">
                          <div className="w-6 h-6 rounded bg-[#e8d8c9] neo-border flex items-center justify-center shrink-0">
                            <TbClockHour4 size={14} />
                          </div>
                          <span className="truncate">{booking.startTime} - {booking.endTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#1a1a1a] font-medium">
                          <div className="w-6 h-6 rounded bg-[#e8d8c9] neo-border flex items-center justify-center shrink-0">
                            <TbUsers size={14} />
                          </div>
                          <span className="truncate">{booking.participants} orang</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-[#1a1a1a]">
                        <p className="flex gap-2">
                          <span className="font-bold shrink-0 w-20">Tujuan:</span> 
                          <span className="text-[#5a5a5a]">{booking.purpose}</span>
                        </p>
                        {booking.description && (
                          <p className="flex gap-2">
                            <span className="font-bold shrink-0 w-20">Deskripsi:</span> 
                            <span className="text-[#5a5a5a] line-clamp-2">{booking.description}</span>
                          </p>
                        )}
                        {booking.rejectionReason && (
                          <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg neo-border border-red-200 text-xs">
                            <span className="font-bold block mb-1">Alasan Ditolak:</span>
                            {booking.rejectionReason}
                          </div>
                        )}
                      </div>

                      {booking.status === "PENDING" && (
                        <div className="mt-5 pt-4 border-t-2 border-dashed border-gray-200 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleCancel(booking.id)}
                            disabled={actingBookingId === booking.id}
                            className="px-5 py-2.5 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 hover:border-red-500 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
                          >
                            {actingBookingId === booking.id ? "Membatalkan..." : "Batalkan Pengajuan"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "approval" && canApprove && (
            <div className="space-y-4">
              {pendingBookings.length === 0 ? (
                <div className="neo-card p-12 bg-white/50 text-center border-dashed">
                  <TbChecklist className="w-16 h-16 text-[#4b607f]/40 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-xl font-bold font-heading text-[#1a1a1a] mb-2">Semua bersih!</p>
                  <p className="text-[#5a5a5a] text-sm">Tidak ada pengajuan peminjaman yang menunggu persetujuan saat ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {pendingBookings.map((booking) => (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setRejectReason("");
                      }}
                      className="w-full neo-card p-5 bg-white text-left neo-card-hover transition-all duration-200 group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-yellow-100 neo-border flex items-center justify-center text-yellow-600 shrink-0 group-hover:scale-110 transition-transform duration-200">
                            <TbClipboardList size={24} strokeWidth={2} />
                          </div>
                          <div>
                            <h3 className="font-heading font-bold text-lg text-[#1a1a1a] line-clamp-1">{booking.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm font-medium text-[#5a5a5a]">
                              <span className="flex items-center gap-1.5 text-[#4b607f]">
                                <TbUser size={16} /> <span className="font-bold">{booking.requester?.name ?? "-"}</span>
                              </span>
                              <span className="hidden sm:inline text-gray-300">•</span>
                              <span className="flex items-center gap-1.5">
                                <TbMapPin size={16} /> {booking.lab?.name ?? "-"}
                              </span>
                              <span className="hidden sm:inline text-gray-300">•</span>
                              <span className="flex items-center gap-1.5">
                                <TbCalendarClock size={16} /> {new Date(booking.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto border-t-2 border-dashed border-gray-200 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold neo-border bg-yellow-400 text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                            Menunggu Review
                          </span>
                          <span className="w-8 h-8 rounded-lg bg-[#f5ede6] neo-border flex items-center justify-center group-hover:bg-[#1a1a1a] group-hover:text-white transition-colors">
                            <span className="text-lg leading-none">→</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-[#e8d8c9] neo-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_#1a1a1a]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white neo-border flex items-center justify-center shadow-[2px_2px_0px_#1a1a1a]">
                    <TbClipboardList size={24} className="text-[#f3701e]" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-2xl text-[#1a1a1a]">Detail Pengajuan</h2>
                    <p className="text-sm font-bold text-[#5a5a5a] mt-1 uppercase tracking-wider">ID: {selectedBooking.id.substring(0, 8)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="w-10 h-10 rounded-xl neo-border flex items-center justify-center bg-white hover:bg-[#1a1a1a] hover:text-white transition-colors"
                >
                  <TbX size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white neo-border rounded-xl p-4">
                  <p className="text-xs font-bold text-[#5a5a5a] mb-2 uppercase tracking-wider flex items-center gap-1.5"><TbClipboardList size={16} className="text-[#f3701e]" /> Kegiatan</p>
                  <p className="font-heading font-bold text-lg text-[#1a1a1a] leading-tight mb-1">{selectedBooking.title}</p>
                  <span className="inline-block bg-[#f8f9fa] px-2 py-1 rounded-md text-xs font-bold neo-border">{selectedBooking.purpose}</span>
                </div>
                <div className="bg-white neo-border rounded-xl p-4">
                  <p className="text-xs font-bold text-[#5a5a5a] mb-2 uppercase tracking-wider flex items-center gap-1.5"><TbChecklist size={16} className="text-green-600" /> Jadwal</p>
                  <p className="font-bold text-base text-[#1a1a1a] mb-1">{new Date(selectedBooking.date).toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <span className="inline-block bg-green-50 px-2 py-1 rounded-md text-xs font-bold text-green-700 neo-border border-green-200">{selectedBooking.startTime} - {selectedBooking.endTime}</span>
                </div>
                <div className="bg-white neo-border rounded-xl p-4">
                  <p className="text-xs font-bold text-[#5a5a5a] mb-2 uppercase tracking-wider flex items-center gap-1.5"><TbMapPin size={16} className="text-blue-600" /> Laboratorium</p>
                  <p className="font-bold text-base text-[#1a1a1a]">{selectedBooking.lab?.name ?? "-"}</p>
                </div>
                <div className="bg-white neo-border rounded-xl p-4">
                  <p className="text-xs font-bold text-[#5a5a5a] mb-2 uppercase tracking-wider flex items-center gap-1.5"><TbUsers size={16} className="text-[#4b607f]" /> Peserta</p>
                  <p className="font-bold text-base text-[#1a1a1a]">{selectedBooking.participants} orang</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-bold text-[#5a5a5a] mb-2 uppercase tracking-wider flex items-center gap-1.5"><TbFileDescription size={16} /> Deskripsi Kegiatan</p>
                <div className="bg-white neo-border rounded-xl p-4 text-sm text-[#1a1a1a] leading-relaxed">
                  {selectedBooking.description || <span className="italic text-[#5a5a5a]">Tidak ada deskripsi tambahan.</span>}
                </div>
              </div>

              <div className="mb-8">
                <label className="text-sm font-bold text-[#1a1a1a] mb-2 flex items-center gap-2">Alasan Penolakan <span className="text-xs text-[#5a5a5a] font-normal">(wajib jika ditolak)</span></label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Tuliskan alasan penolakan secara jelas..."
                  className="w-full px-4 py-3 neo-input bg-white text-base focus:shadow-[4px_4px_0px_#ef4444] transition-all resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t-2 border-dashed border-[#1a1a1a]/20">
                <button
                  type="button"
                  onClick={() => handleReject(selectedBooking.id)}
                  disabled={actingBookingId === selectedBooking.id}
                  className="flex-1 neo-btn py-3.5 bg-red-500 text-white text-base font-bold hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  {actingBookingId === selectedBooking.id ? "Memproses..." : "Tolak Pengajuan"}
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(selectedBooking.id)}
                  disabled={actingBookingId === selectedBooking.id}
                  className="flex-1 neo-btn py-3.5 bg-green-500 text-white text-base font-bold hover:bg-green-600 transition-colors disabled:opacity-60"
                >
                  {actingBookingId === selectedBooking.id ? "Memproses..." : "Setujui Pengajuan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
