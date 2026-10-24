"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { TbArrowsExchange, TbBook2, TbLockOpen, TbRefresh, TbSend, TbSchool } from "react-icons/tb";
import api from "@/services/api";
import { useCurrentRole } from "@/providers/current-user-context";

type ReportStatus = "TATAP_MUKA" | "ONLINE" | "TIDAK_MASUK" | "PINDAH_JADWAL" | "BELUM_PASTI";
type AcademicOffering = {
  id: string;
  term?: { code?: string; name?: string };
  course?: { code?: string; name?: string };
  academicClass?: { code?: string; name?: string };
  dosen?: { name?: string };
};
type AcademicReport = {
  id: string;
  offeringId?: string;
  status: ReportStatus;
  revision: number;
  notes?: string | null;
  reportDate?: string;
  updatedAt?: string;
  updatedBy?: { name?: string };
  offering?: AcademicOffering;
};
type ApiList<T> = { data?: T[] };
type OccurrenceRelease = { id: string; reportId: string; status: "RELEASED" | "ALLOCATED" | "REVOKED"; occurrenceDate?: string; startTime?: string; endTime?: string; offering?: AcademicOffering };
type SlotRequest = { id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; releaseId: string; targetOffering?: AcademicOffering };
type OccurrenceSwap = { id: string; status: "PENDING_CONFIRMATION" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "CANCELLED"; occurrenceDate: string; sourceOffering?: AcademicOffering; targetOffering?: AcademicOffering };
type ActualSchedule = { offeringId: string; occurrenceDate: string; startTime: string; endTime: string; swapId?: string | null; course?: { code?: string; name?: string }; academicClass?: { code?: string; name?: string } };

const STATUS_LABEL: Record<ReportStatus, string> = {
  TATAP_MUKA: "Tatap muka",
  ONLINE: "Online",
  TIDAK_MASUK: "Tidak masuk",
  PINDAH_JADWAL: "Pindah jadwal",
  BELUM_PASTI: "Belum pasti",
};

function formatDate(value?: string): string {
  if (!value) return "Belum ada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function offeringLabel(offering?: AcademicOffering): string {
  if (!offering) return "Penawaran tidak diketahui";
  return [offering.course?.code, offering.course?.name].filter(Boolean).join(" - ") || offering.id;
}

export default function AcademicPage() {
  const role = useCurrentRole();
  const canWrite = role === "MAHASISWA" || role === "DOSEN";
  const [offerings, setOfferings] = useState<AcademicOffering[]>([]);
  const [reports, setReports] = useState<AcademicReport[]>([]);
  const [releases, setReleases] = useState<OccurrenceRelease[]>([]);
  const [slotRequests, setSlotRequests] = useState<SlotRequest[]>([]);
  const [swaps, setSwaps] = useState<OccurrenceSwap[]>([]);
  const [actualSchedules, setActualSchedules] = useState<ActualSchedule[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [targetOfferingId, setTargetOfferingId] = useState("");
  const [status, setStatus] = useState<ReportStatus>("TATAP_MUKA");
  const [notes, setNotes] = useState("");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualDate, setActualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [swapTargetOfferingId, setSwapTargetOfferingId] = useState("");
  const [editing, setEditing] = useState<AcademicReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [offeringResponse, reportResponse, releaseResponse, requestResponse, swapResponse, actualResponse] = await Promise.all([
      api.get<ApiList<AcademicOffering>>("/academic/offerings").catch(() => ({ data: [] })),
      api.get<ApiList<AcademicReport>>("/academic/reports").catch(() => ({ data: [] })),
      api.get<ApiList<OccurrenceRelease>>("/academic/occurrence-releases").catch(() => ({ data: [] })),
      api.get<ApiList<SlotRequest>>("/academic/slot-requests").catch(() => ({ data: [] })),
      api.get<ApiList<OccurrenceSwap>>("/academic/occurrence-swaps").catch(() => ({ data: [] })),
      api.get<ApiList<ActualSchedule>>(`/academic/actual-schedules?date=${actualDate}`).catch(() => ({ data: [] })),
    ]);
    setOfferings(Array.isArray(offeringResponse.data) ? offeringResponse.data : []);
    setReports(Array.isArray(reportResponse.data) ? reportResponse.data : []);
    setReleases(Array.isArray(releaseResponse.data) ? releaseResponse.data : []);
    setSlotRequests(Array.isArray(requestResponse.data) ? requestResponse.data : []);
    setSwaps(Array.isArray(swapResponse.data) ? swapResponse.data : []);
    setActualSchedules(Array.isArray(actualResponse.data) ? actualResponse.data : []);
    setLoading(false);
  }, [actualDate]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const reportsByOffering = useMemo(() => new Map(reports.map((report) => [report.offeringId || report.offering?.id, report])), [reports]);

  function startEdit(report: AcademicReport) {
    setEditing(report);
    setSelectedOfferingId(report.offeringId || report.offering?.id || "");
    setStatus(report.status);
    setNotes(report.notes || "");
    setReportDate(report.reportDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setMessage("");
  }

  async function releaseOccurrence(report: AcademicReport) {
    setSaving(true);
    setMessage("");
    try {
      await api.post("/academic/occurrence-releases", { reportId: report.id });
      setMessage("Slot pertemuan dilepas sesuai laporan.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Slot gagal dilepas.");
    } finally {
      setSaving(false);
    }
  }

  async function requestSlot(releaseId: string) {
    if (!targetOfferingId) return;
    setSaving(true);
    setMessage("");
    try {
      await api.post("/academic/slot-requests", { releaseId, targetOfferingId });
      setTargetOfferingId("");
      setMessage("Pengajuan slot dikirim ke koordinator.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pengajuan slot gagal dibuat.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewSlotRequest(requestId: string, approved: boolean) {
    setSaving(true);
    setMessage("");
    try {
      await api.patch(`/academic/slot-requests/${requestId}/review`, {
        approved,
        ...(approved ? {} : { rejectionReason: "Ditolak koordinator" }),
      });
      setMessage(approved ? "Pengajuan slot disetujui." : "Pengajuan slot ditolak.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pengajuan slot gagal ditinjau.");
    } finally {
      setSaving(false);
    }
  }

  async function requestSwap(sourceOfferingId: string) {
    if (!swapTargetOfferingId) return;
    setSaving(true);
    setMessage("");
    try {
      await api.post("/academic/occurrence-swaps", { sourceOfferingId, targetOfferingId: swapTargetOfferingId, occurrenceDate: actualDate });
      setMessage("Pertukaran menunggu konfirmasi kelas tujuan.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pertukaran gagal diajukan.");
    } finally { setSaving(false); }
  }

  async function confirmSwap(swapId: string) {
    setSaving(true);
    setMessage("");
    try {
      await api.post(`/academic/occurrence-swaps/${swapId}/confirm`, {});
      setMessage("Konfirmasi pertukaran tercatat.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Konfirmasi gagal."); } finally { setSaving(false); }
  }

  async function reviewSwap(swapId: string, approved: boolean) {
    setSaving(true);
    setMessage("");
    try {
      await api.patch(`/academic/occurrence-swaps/${swapId}/review`, approved ? { approved } : { approved, rejectionReason: "Ditolak koordinator" });
      setMessage(approved ? "Pertukaran disetujui." : "Pertukaran ditolak.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Peninjauan gagal."); } finally { setSaving(false); }
  }

  async function cancelSwap(swapId: string) {
    setSaving(true);
    setMessage("");
    try {
      await api.post(`/academic/occurrence-swaps/${swapId}/cancel`, {});
      setMessage("Pengajuan pertukaran dibatalkan.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pembatalan gagal."); } finally { setSaving(false); }
  }

  const releasesByReport = useMemo(() => new Map(releases.map((release) => [release.reportId, release])), [releases]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOfferingId) return;
    setSaving(true);
    setMessage("");
    try {
      if (editing) {
        await api.patch(`/academic/reports/${editing.id}`, { expectedRevision: editing.revision, status, notes });
      } else {
        await api.post("/academic/reports", { offeringId: selectedOfferingId, reportDate, status, notes });
      }
      setEditing(null);
      setNotes("");
      setMessage("Laporan tersimpan.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Laporan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f3701e]">Academic workspace</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-heading font-bold">Penawaran akademik</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5a5a5a]">Status laporan berasal dari data akademik terstruktur. Akses dan perubahan tetap diputuskan backend.</p>
        </div>
        <button type="button" onClick={() => void load()} className="neo-btn min-h-[44px] bg-white px-4 py-2 font-bold" disabled={loading}>
          <TbRefresh className={loading ? "animate-spin" : ""} /> Muat ulang
        </button>
      </header>

      {message && <div role="status" className="neo-card border-[#4b607f] bg-white p-3 text-sm font-bold">{message}</div>}

      {canWrite && (
        <form onSubmit={submit} className="neo-card bg-white p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2"><TbSend className="text-[#f3701e]" /><h2 className="font-heading text-xl font-bold">{editing ? "Revisi laporan" : "Kirim laporan"}</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Penawaran<select required value={selectedOfferingId} onChange={(event) => setSelectedOfferingId(event.target.value)} className="neo-input mt-1 min-h-[44px] w-full"><option value="">Pilih penawaran</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offeringLabel(offering)} - {offering.academicClass?.code || "Kelas"}</option>)}</select></label>
            <label className="text-sm font-bold">Tanggal<input required type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="neo-input mt-1 min-h-[44px] w-full" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Status<select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} className="neo-input mt-1 min-h-[44px] w-full">{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-bold">Catatan<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="neo-input mt-1 min-h-[44px] w-full" rows={2} /></label>
          </div>
          <button type="submit" disabled={saving || !selectedOfferingId} className="neo-btn min-h-[44px] bg-[#f3701e] px-5 py-2 font-bold text-white">{saving ? "Menyimpan..." : editing ? "Simpan revisi" : "Kirim laporan"}</button>
        </form>
      )}

       <section className="space-y-3">
        <div className="flex items-center gap-2"><TbSchool className="text-[#4b607f]" /><h2 className="font-heading text-2xl font-bold">Penawaran Anda</h2></div>
         {offerings.length === 0 ? <div className="neo-card bg-white p-6 text-sm text-[#5a5a5a]">Belum ada penawaran akademik yang dapat ditampilkan.</div> : <div className="grid gap-4 lg:grid-cols-2">{offerings.map((offering) => { const report = reportsByOffering.get(offering.id); const release = report ? releasesByReport.get(report.id) : undefined; return <article key={offering.id} className="neo-card bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">{offering.term?.code || offering.term?.name || "Term"}</p><h3 className="mt-1 font-heading text-xl font-bold">{offeringLabel(offering)}</h3><p className="mt-1 text-sm text-[#5a5a5a]">{offering.academicClass?.code || offering.academicClass?.name || "Kelas belum tersedia"}</p></div><span className="neo-badge shrink-0 bg-[#e8d8c9]">{report ? STATUS_LABEL[report.status] : "Belum ada laporan"}</span></div><dl className="mt-5 grid grid-cols-1 gap-3 border-t-2 border-[#1a1a1a]/10 pt-4 text-sm sm:grid-cols-3"><div><dt className="text-xs font-bold uppercase text-[#5a5a5a]">Laporan terakhir</dt><dd className="mt-1 font-medium">{formatDate(report?.updatedAt)}</dd></div><div><dt className="text-xs font-bold uppercase text-[#5a5a5a]">Diperbarui oleh</dt><dd className="mt-1 font-medium">{report?.updatedBy?.name || "Belum ada"}</dd></div><div><dt className="text-xs font-bold uppercase text-[#5a5a5a]">Revisi</dt><dd className="mt-1 font-medium">{report?.revision ?? "-"}</dd></div></dl>{release ? <p className="mt-4 text-sm font-bold text-[#4b607f]">Slot: {release.status}</p> : canWrite && report && (report.status === "ONLINE" || report.status === "TIDAK_MASUK") ? <button type="button" onClick={() => void releaseOccurrence(report)} disabled={saving} className="neo-btn mt-4 min-h-[44px] bg-[#f3701e] px-4 py-2 font-bold text-white"><TbLockOpen /> Lepaskan slot</button> : null}{canWrite && report && !release && <button type="button" onClick={() => startEdit(report)} className="neo-btn mt-4 min-h-[44px] bg-[#4b607f] px-4 py-2 font-bold text-white">Revisi laporan</button>}</article>; })}</div>}
       </section>

       <section className="neo-card bg-white p-4 sm:p-6 space-y-4">
         <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><TbArrowsExchange className="text-[#f3701e]" /><h2 className="font-heading text-xl font-bold">Jadwal aktual dan pertukaran</h2></div><label className="text-sm font-bold">Tanggal<input type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)} className="neo-input ml-2 min-h-[40px]" /></label></div>
         <p className="text-sm text-[#5a5a5a]">Pertukaran hanya berlaku pada tanggal ini. Jadwal praktikum resmi tidak diubah.</p>
         {actualSchedules.length === 0 ? <p className="text-sm text-[#5a5a5a]">Tidak ada jadwal akademik aktual pada tanggal ini.</p> : <div className="grid gap-3 md:grid-cols-2">{actualSchedules.map((item) => <article key={item.offeringId} className="border-2 border-[#1a1a1a] p-3 text-sm"><strong>{item.course?.code || "Mata kuliah"}</strong><p>{item.academicClass?.code || "Kelas"} · {item.startTime}–{item.endTime}</p><p className="font-bold text-[#4b607f]">{item.swapId ? "Slot hasil pertukaran" : "Slot resmi"}</p></article>)}</div>}
         {canWrite && <label className="block text-sm font-bold">Tukar dengan penawaran<select value={swapTargetOfferingId} onChange={(event) => setSwapTargetOfferingId(event.target.value)} className="neo-input mt-1 min-h-[44px] w-full"><option value="">Pilih penawaran tujuan</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offeringLabel(offering)} - {offering.academicClass?.code || "Kelas"}</option>)}</select></label>}
         {canWrite && actualSchedules.map((item) => <button key={`swap-${item.offeringId}`} type="button" disabled={saving || !swapTargetOfferingId || swapTargetOfferingId === item.offeringId} onClick={() => void requestSwap(item.offeringId)} className="neo-btn min-h-[44px] bg-[#4b607f] px-4 py-2 font-bold text-white">Ajukan tukar {item.course?.code || "slot"}</button>)}
          {swaps.length > 0 && <div className="space-y-2">{swaps.map((swap) => <div key={swap.id} className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-[#1a1a1a]/10 pt-2 text-sm"><p><strong>{offeringLabel(swap.sourceOffering)}</strong> ⇄ <strong>{offeringLabel(swap.targetOffering)}</strong> · {swap.status}</p>{canWrite && swap.status === "PENDING_CONFIRMATION" && <button type="button" onClick={() => void confirmSwap(swap.id)} disabled={saving} className="neo-btn min-h-[40px] bg-white px-3 py-1 font-bold">Konfirmasi kelas</button>}{canWrite && (swap.status === "PENDING_CONFIRMATION" || swap.status === "PENDING_APPROVAL") && <button type="button" onClick={() => void cancelSwap(swap.id)} disabled={saving} className="neo-btn min-h-[40px] bg-white px-3 py-1 font-bold">Batalkan</button>}{role === "KOORDINATOR_LAB" && swap.status === "PENDING_APPROVAL" && <div className="flex gap-2"><button type="button" onClick={() => void reviewSwap(swap.id, true)} disabled={saving} className="neo-btn min-h-[40px] bg-[#4b607f] px-3 py-1 font-bold text-white">Setujui</button><button type="button" onClick={() => void reviewSwap(swap.id, false)} disabled={saving} className="neo-btn min-h-[40px] bg-white px-3 py-1 font-bold">Tolak</button></div>}</div>)}</div>}
       </section>

       {slotRequests.length > 0 && <section className="neo-card bg-white p-4 sm:p-6"><h2 className="font-heading text-xl font-bold">Pengajuan slot</h2><div className="mt-3 space-y-2">{slotRequests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#1a1a1a]/10 pt-2 text-sm"><p><strong>{offeringLabel(request.targetOffering)}</strong>: {request.status}</p>{role === "KOORDINATOR_LAB" && request.status === "PENDING" && <div className="flex gap-2"><button type="button" onClick={() => void reviewSlotRequest(request.id, true)} disabled={saving} className="neo-btn min-h-[40px] bg-[#4b607f] px-3 py-1 font-bold text-white">Setujui</button><button type="button" onClick={() => void reviewSlotRequest(request.id, false)} disabled={saving} className="neo-btn min-h-[40px] bg-white px-3 py-1 font-bold">Tolak</button></div>}</div>)}</div></section>}

       {canWrite && releases.some((release) => release.status === "RELEASED") && <section className="neo-card bg-[#f5ede6] p-4 sm:p-6"><h2 className="font-heading text-xl font-bold">Ajukan penggunaan slot rilis</h2><p className="mt-2 text-sm text-[#5a5a5a]">Koordinator tetap memeriksa bentrok jadwal, booking, penggunaan lab, dan kunci sebelum menyetujui.</p><label className="mt-4 block text-sm font-bold">Penawaran target<select value={targetOfferingId} onChange={(event) => setTargetOfferingId(event.target.value)} className="neo-input mt-1 min-h-[44px] w-full"><option value="">Pilih penawaran</option>{offerings.map((offering) => <option key={offering.id} value={offering.id}>{offeringLabel(offering)} - {offering.academicClass?.code || "Kelas"}</option>)}</select></label><div className="mt-3 flex flex-wrap gap-2">{releases.filter((release) => release.status === "RELEASED").map((release) => <button key={release.id} type="button" disabled={saving || !targetOfferingId} onClick={() => void requestSlot(release.id)} className="neo-btn min-h-[44px] bg-[#4b607f] px-4 py-2 font-bold text-white">Ajukan {release.occurrenceDate?.slice(0, 10) || "slot"}</button>)}</div></section>}

      <section className="neo-card bg-[#f5ede6] p-4 text-sm"><div className="flex items-center gap-2 font-bold"><TbBook2 /> Catatan akses</div><p className="mt-2 text-[#5a5a5a]">{role === "DOSEN" ? "Laporan baru dan revisi hanya tersedia untuk penawaran dosen yang diizinkan backend." : role === "MAHASISWA" ? "Laporan baru dan revisi hanya tersedia untuk penawaran yang diizinkan backend." : "Mode baca koordinator. Master data akademik belum tersedia di halaman ini."}</p></section>
    </div>
  );
}
