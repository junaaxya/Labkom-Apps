"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TbAlertCircle, TbArrowRight, TbBook2, TbCalendar, TbCheck, TbClock, TbMapPin, TbRefresh, TbSchool, TbShieldCheck, TbUser, TbUserCheck, TbUsers, TbX } from "react-icons/tb";
import api, { ApiError } from "@/services/api";
import { useCurrentRole, useCurrentUser } from "@/providers/current-user-context";

type Person = { id: string; name: string; email?: string; nim?: string };
type Schedule = {
  id: string; title: string; className?: string | null; semester?: string | null; lecturerName?: string | null;
  day: string; specificDate?: string | null; startTime: string; endTime: string;
  lab: { id: string; name: string; capacity?: number }; smartAcademicPjs: { student: Person }[];
};
type Move = {
  id: string; status: "AUTO_APPROVED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
  riskLevel: "GREEN" | "YELLOW"; riskReasons: string[]; rejectionReason?: string | null;
  occurrenceDate: string; startTime: string; endTime: string;
  sourceReport: { schedule: Schedule }; targetSchedule: Schedule; lab?: { id: string; name: string };
  requestedBy?: Person; reviewedBy?: Person;
};
type Report = {
  id: string; status: "MASUK" | "KOSONG" | "ONLINE"; occurrenceDate: string; source: string; notes?: string | null;
  schedule: Schedule; reportedBy: Person; move?: Move | null;
};
type Tab = "jadwal" | "slot" | "pengajuan" | "riwayat";

const STATUS: Record<Move["status"], string> = {
  AUTO_APPROVED: "Disetujui otomatis", PENDING_REVIEW: "Perlu tinjauan", APPROVED: "Disetujui",
  REJECTED: "Ditolak", CANCELLED: "Dibatalkan",
};
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const array = <T,>(value: unknown): T[] => Array.isArray(value) ? value : (value as { data?: T[] })?.data || [];
const message = (error: unknown) => error instanceof ApiError ? error.message : "Jaringan bermasalah. Coba lagi.";

export default function AcademicPage() {
  const role = useCurrentRole();
  const user = useCurrentUser();
  const [tab, setTab] = useState<Tab>(role === "ASISTEN_LAB" ? "pengajuan" : "jadwal");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [reporting, setReporting] = useState<Schedule | null>(null);
  const [reportDate, setReportDate] = useState(today());
  const [reportStatus, setReportStatus] = useState<Report["status"]>("KOSONG");
  const [source, setSource] = useState("WhatsApp dosen");
  const [notes, setNotes] = useState("");
  const [moving, setMoving] = useState<Report | null>(null);
  const [targetScheduleId, setTargetScheduleId] = useState("");
  const [reason, setReason] = useState("");
  const [pjSchedule, setPjSchedule] = useState<Schedule | null>(null);
  const [classmates, setClassmates] = useState<Person[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [rejecting, setRejecting] = useState<Move | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    const results = await Promise.allSettled([
      api.get("/smart-academic/schedules"), api.get("/smart-academic/reports"), api.get("/smart-academic/moves"),
    ]);
    if (results[0].status === "fulfilled") setSchedules(array<Schedule>(results[0].value));
    if (results[1].status === "fulfilled") setReports(array<Report>(results[1].value));
    if (results[2].status === "fulfilled") setMoves(array<Move>(results[2].value));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") setNotice({ type: "error", text: message(failure.reason) });
    setLoading(false);
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const openSlots = useMemo(() => reports.filter((report) => ["KOSONG", "ONLINE"].includes(report.status) && !report.move), [reports]);
  const pending = useMemo(() => moves.filter((move) => move.status === "PENDING_REVIEW"), [moves]);
  const canManagePj = role === "KOORDINATOR_LAB" || (role === "MAHASISWA" && Boolean(user?.isKetuaKelas));
  const canReport = role === "MAHASISWA" || role === "KOORDINATOR_LAB";

  async function mutate(work: () => Promise<unknown>, success: string) {
    setSaving(true); setNotice(null);
    try { await work(); setNotice({ type: "ok", text: success }); await load(); return true; }
    catch (error) { setNotice({ type: "error", text: message(error) }); return false; }
    finally { setSaving(false); }
  }
  async function submitReport(event: React.FormEvent) {
    event.preventDefault(); if (!reporting) return;
    if (await mutate(() => api.post("/smart-academic/reports", { scheduleId: reporting.id, occurrenceDate: reportDate, status: reportStatus, source, notes: notes || null }), "Status pertemuan tersimpan.")) {
      setReporting(null); setNotes("");
    }
  }
  async function submitMove(event: React.FormEvent) {
    event.preventDefault(); if (!moving || !targetScheduleId) return;
    if (await mutate(() => api.post("/smart-academic/moves", { sourceReportId: moving.id, targetScheduleId, reason: reason || null }), "Pengajuan diperiksa dan disimpan.")) {
      setMoving(null); setTargetScheduleId(""); setReason(""); setTab("pengajuan");
    }
  }
  async function openPj(schedule: Schedule) {
    setPjSchedule(schedule); setSelectedStudentId(schedule.smartAcademicPjs[0]?.student.id || ""); setClassmates([]);
    try { setClassmates(array<Person>(await api.get(`/smart-academic/schedules/${schedule.id}/classmates`))); }
    catch (error) { setNotice({ type: "error", text: message(error) }); setPjSchedule(null); }
  }
  async function assignPj() {
    if (!pjSchedule || !selectedStudentId) return;
    if (await mutate(() => api.post(`/smart-academic/schedules/${pjSchedule.id}/pjs`, { studentId: selectedStudentId }), "PJ mata kuliah ditetapkan.")) setPjSchedule(null);
  }
  async function removePj() {
    const studentId = pjSchedule?.smartAcademicPjs[0]?.student.id;
    if (!pjSchedule || !studentId) return;
    if (await mutate(() => api.delete(`/smart-academic/schedules/${pjSchedule.id}/pjs/${studentId}`), "PJ mata kuliah dihapus.")) setPjSchedule(null);
  }
  async function review(move: Move, approved: boolean, rejection?: string) {
    if (await mutate(() => api.patch(`/smart-academic/moves/${move.id}/review`, { approved, rejectionReason: rejection || null }), approved ? "Pengajuan disetujui." : "Pengajuan ditolak.")) {
      setRejecting(null); setRejectionReason("");
    }
  }

  const tabs: [Tab, string, string, React.ReactNode][] = [
    ["jadwal", "Jadwal", role === "KOORDINATOR_LAB" ? "Jadwal & PJ" : "Jadwal Saya", <TbCalendar key="a" />],
    ["slot", "Slot", "Slot Kosong", <TbClock key="b" />],
    ["pengajuan", role === "ASISTEN_LAB" ? `Tinjau (${pending.length})` : "Pengajuan", role === "ASISTEN_LAB" ? `Perlu Ditinjau (${pending.length})` : "Pengajuan", <TbShieldCheck key="c" />],
    ["riwayat", "Riwayat", "Riwayat", <TbBook2 key="d" />],
  ];

  return <div className="academic-page space-y-4 pb-32 sm:space-y-6 sm:pb-24">
    <header className="relative overflow-hidden rounded-2xl border border-[#1a1a1a]/10 bg-[#1f2d42] px-4 py-5 text-white shadow-sm sm:px-6 sm:py-7">
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-white/5" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#ffb181]"><TbSchool className="h-4 w-4" /> Ruang Akademik</div>
          <h1 className="mt-2 max-w-xl font-heading text-[1.65rem] font-black leading-[1.08] sm:text-3xl">Jadwal lebih fleksibel, kelas tetap tertib</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Laporkan kelas kosong, temukan slot, lalu biarkan sistem memeriksa konflik dan persetujuan.</p>
        </div>
        <button onClick={() => void load()} className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="Muat ulang"><TbRefresh className={loading ? "animate-spin" : ""} /></button>
      </div>
    </header>

    {notice && <div className={`flex items-start justify-between gap-3 rounded-xl border-2 p-3 text-sm font-bold ${notice.type === "ok" ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-rose-600 bg-rose-50 text-rose-900"}`}>
      <span className="flex gap-2"><TbAlertCircle className="mt-0.5 shrink-0" />{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Tutup"><TbX /></button>
    </div>}

    <nav className="grid grid-cols-4 gap-1 rounded-2xl border border-[#1a1a1a]/10 bg-white p-1.5 shadow-sm" aria-label="Fitur akademik">
      {tabs.map(([id, mobileLabel, desktopLabel, icon]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-bold leading-tight transition-colors sm:min-h-[48px] sm:flex-row sm:gap-2 sm:px-3 sm:text-sm ${tab === id ? "bg-[#f3701e] text-[#1a1a1a]" : "text-[#5a5a5a] hover:bg-[#f5ede6]"}`}><span className="text-lg sm:text-base">{icon}</span><span className="max-w-full truncate sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{desktopLabel}</span></button>)}
    </nav>

    {tab === "jadwal" && <section className="space-y-3">
      <SectionTitle icon={<TbSchool />} title="Jadwal praktikum" text="Data langsung dari Manajemen Jadwal. Tidak perlu membuat term, kelas, atau mata kuliah ulang." />
      {loading ? <Empty text="Memuat jadwal..." /> : schedules.length === 0 ? <Empty text="Belum ada jadwal praktikum untuk akun ini." /> : <div className="space-y-4">{schedules.map((schedule) => {
        const hasPj = schedule.smartAcademicPjs.length > 0;
        return <article key={schedule.id} className="relative overflow-hidden rounded-2xl border border-[#1a1a1a]/10 bg-white shadow-[0_5px_18px_rgba(26,26,26,0.07)]">
          <div className={`h-1.5 w-full ${hasPj ? "bg-[#4b607f]" : "bg-[#f3701e]"}`} />
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1f2d42] text-xl text-white shadow-sm"><TbSchool /></div>
              <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.08em] text-[#d95911]">{schedule.className || "Kelas belum diisi"} · Semester {schedule.semester || "-"}</p><h3 className="mt-1 font-heading text-xl font-black leading-tight text-[#1a1a1a]">{schedule.title}</h3></div>
              <div className="flex shrink-0 flex-col items-end rounded-xl border border-[#1a1a1a]/5 bg-[#f5ede6] px-3 py-2 text-right"><span className="text-[11px] font-black uppercase tracking-wide text-[#686868]">{schedule.day}</span><span className="text-sm font-black tabular-nums text-[#1a1a1a]">{schedule.startTime}–{schedule.endTime}</span></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#f7f4f1] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#777]">Ruangan</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#34445d]"><TbMapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{schedule.lab.name}</span></p></div>
              <div className="rounded-xl bg-[#f7f4f1] p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#777]">Pengampu</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#34445d]"><TbUser className="h-4 w-4 shrink-0" /> <span className="truncate">{schedule.lecturerName || "Belum diisi"}</span></p></div>
            </div>
            <div className={`mt-3 rounded-xl px-3 py-2.5 ${hasPj ? "bg-[#edf2f8]" : "bg-[#fff2e8]"}`}>{hasPj ? <div><p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-[#4b607f]">Penanggung jawab mata kuliah</p><div className="flex flex-wrap gap-2">{schedule.smartAcademicPjs.slice(0, 1).map(({ student }) => <span key={student.id} className="inline-flex items-center gap-2 text-sm font-bold text-[#1f2d42]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4b607f] text-xs text-white">{student.name.charAt(0).toUpperCase()}</span>{student.name}</span>)}</div></div> : <p className="flex items-center gap-2 text-sm font-bold text-[#a8440c]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3701e]/15"><TbAlertCircle /></span> PJ belum ditetapkan</p>}</div>
          </div>
          {(canManagePj || canReport) && <div className={`grid border-t border-[#1a1a1a]/10 bg-[#faf8f6] ${canManagePj && canReport ? "grid-cols-2" : "grid-cols-1"}`}>{canManagePj && <button onClick={() => void openPj(schedule)} className="flex min-h-[54px] items-center justify-center gap-2 border-r border-[#1a1a1a]/10 px-3 text-sm font-bold text-[#34445d] transition-colors hover:bg-[#e8d8c9]"><TbUsers className="text-lg" /> {hasPj ? "Ubah PJ" : "Atur PJ"}</button>}{canReport && <button onClick={() => { setReporting(schedule); setReportDate(today()); }} className="flex min-h-[54px] items-center justify-center gap-2 px-3 text-sm font-black text-[#b84b0d] transition-colors hover:bg-[#fff0e5]"><TbUserCheck className="text-lg" /> Laporkan status</button>}</div>}
        </article>;
      })}</div>}
    </section>}

    {tab === "slot" && <section className="space-y-3"><SectionTitle icon={<TbClock />} title="Slot kosong tersedia" text="Slot hanya muncul setelah PJ atau Ketua Kelas melaporkan dosen tidak masuk atau perkuliahan online." />
      {openSlots.length === 0 ? <Empty text="Belum ada slot kosong yang dapat dipakai." /> : openSlots.map((report) => <article key={report.id} className="neo-card border-2 border-emerald-700 bg-emerald-50 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><span className="neo-badge bg-emerald-700 px-2 py-1 text-[10px] font-black text-white">TERSEDIA</span><h3 className="mt-2 font-heading text-lg font-black">{report.schedule.title}</h3><p className="text-sm">{new Date(report.occurrenceDate).toLocaleDateString("id-ID", { dateStyle: "full" })} · {report.schedule.startTime}–{report.schedule.endTime}</p><p className="text-sm font-bold">{report.schedule.lab.name}</p><p className="mt-2 text-xs text-[#5a5a5a]">{report.source}{report.notes ? ` · ${report.notes}` : ""}</p></div>
          {role === "MAHASISWA" && <button onClick={() => setMoving(report)} className="neo-btn min-h-[44px] bg-[#f3701e] px-4 text-sm font-black text-white">Ajukan maju ke slot ini <TbArrowRight /></button>}</div>
      </article>)}</section>}

    {tab === "pengajuan" && <section className="space-y-3"><SectionTitle icon={<TbShieldCheck />} title={role === "ASISTEN_LAB" ? "Persetujuan operasional" : "Pengajuan pemajuan jadwal"} text={role === "ASISTEN_LAB" ? "Hanya pengajuan lab tempat Anda sedang check-in yang tampil." : "Hijau disetujui otomatis. Kuning ditinjau Koordinator atau Aslab yang sedang bertugas."} />
      {moves.length === 0 ? <Empty text="Belum ada pengajuan." /> : moves.map((move) => <MoveCard key={move.id} move={move} canReview={["KOORDINATOR_LAB", "ASISTEN_LAB"].includes(role || "") && move.status === "PENDING_REVIEW"} onApprove={() => void review(move, true)} onReject={() => setRejecting(move)} />)}</section>}

    {tab === "riwayat" && <section className="space-y-3"><SectionTitle icon={<TbBook2 />} title="Riwayat keputusan" text="Semua keputusan otomatis dan petugas tercatat transparan." />
      {moves.filter((move) => move.status !== "PENDING_REVIEW").length === 0 ? <Empty text="Belum ada riwayat perubahan." /> : moves.filter((move) => move.status !== "PENDING_REVIEW").map((move) => <MoveCard key={move.id} move={move} canReview={false} onApprove={() => {}} onReject={() => {}} />)}</section>}

    {reporting && <StatusReportSheet title="Laporkan status" onClose={() => setReporting(null)} saving={saving} onSubmit={submitReport}>
      <div className="flex items-center gap-3 rounded-2xl bg-[#f5ede6] p-3.5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1f2d42] text-xl text-white"><TbSchool /></span><div className="min-w-0"><h3 className="truncate font-heading text-lg font-black">{reporting.title}</h3><p className="mt-0.5 text-xs font-semibold text-[#5a5a5a]">{reporting.className} · {reporting.day}, {reporting.startTime}–{reporting.endTime} · {reporting.lab.name}</p></div></div>
      <label className="block"><span className="text-xs font-black uppercase tracking-wide text-[#5a5a5a]">Tanggal pertemuan</span><div className="relative mt-1.5"><TbCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4b607f]" /><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="min-h-[48px] w-full rounded-xl border border-[#1a1a1a]/15 bg-white pl-10 pr-3 text-base font-bold outline-none focus:ring-2 focus:ring-[#f3701e]/30" required /></div></label>
      <fieldset><legend className="text-xs font-black uppercase tracking-wide text-[#5a5a5a]">Status pertemuan</legend><div className="mt-2 grid grid-cols-3 gap-2">{([['MASUK','Masuk',TbCheck],['KOSONG','Kosong',TbX],['ONLINE','Online',TbClock]] as const).map(([value,label,Icon]) => <button key={value} type="button" onClick={() => setReportStatus(value)} aria-pressed={reportStatus === value} className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-black transition-colors ${reportStatus === value ? value === 'MASUK' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : value === 'KOSONG' ? 'border-[#f3701e] bg-[#fff0e5] text-[#a8440c]' : 'border-[#4b607f] bg-[#edf2f8] text-[#34445d]' : 'border-[#1a1a1a]/10 bg-white text-[#686868]'}`}><Icon className="text-xl" />{label}</button>)}</div></fieldset>
      <fieldset><legend className="text-xs font-black uppercase tracking-wide text-[#5a5a5a]">Informasi dari</legend><div className="mt-2 flex flex-wrap gap-2">{['WhatsApp dosen','Disampaikan langsung','Grup kelas'].map((item) => <button key={item} type="button" onClick={() => setSource(item)} aria-pressed={source === item} className={`min-h-[42px] rounded-xl border px-3 text-xs font-bold transition-colors ${source === item ? 'border-[#4b607f] bg-[#4b607f] text-white' : 'border-[#1a1a1a]/10 bg-white text-[#5a5a5a]'}`}>{item}</button>)}</div></fieldset>
      <label className="block"><span className="text-xs font-black uppercase tracking-wide text-[#5a5a5a]">Catatan <span className="font-medium normal-case">(opsional)</span></span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-[#1a1a1a]/15 bg-white p-3 text-base outline-none placeholder:text-[#999] focus:ring-2 focus:ring-[#f3701e]/30" placeholder="Tambahkan informasi dari dosen..." /></label>
    </StatusReportSheet>}

    {moving && <Modal title="Ajukan pemajuan jadwal" onClose={() => setMoving(null)}><form onSubmit={submitMove} className="space-y-3"><div className="rounded-xl border-2 border-emerald-700 bg-emerald-50 p-3 text-sm"><b>Slot tujuan</b><br />{moving.schedule.startTime}–{moving.schedule.endTime} · {moving.schedule.lab.name}</div><label className="block text-xs font-black">Jadwal kelas yang ingin dimajukan<select value={targetScheduleId} onChange={(e) => setTargetScheduleId(e.target.value)} className="neo-input mt-1 min-h-[44px] w-full" required><option value="">Pilih jadwal</option>{schedules.filter((item) => item.id !== moving.schedule.id).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.startTime}–{item.endTime}</option>)}</select></label><label className="block text-xs font-black">Alasan<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="neo-input mt-1 min-h-24 w-full" placeholder="Dosen meminta kelas dimajukan" /></label><p className="text-xs text-[#5a5a5a]">Sistem akan memeriksa bentrok kelas, dosen, lab, booking, logbook, dan kunci.</p><Submit saving={saving} text="Periksa & ajukan" /></form></Modal>}

    {pjSchedule && <Modal title={pjSchedule.smartAcademicPjs.length ? "Ubah PJ mata kuliah" : "Tetapkan PJ mata kuliah"} onClose={() => setPjSchedule(null)}><div className="space-y-4"><div className="flex items-center gap-3 rounded-2xl bg-[#f5ede6] p-3.5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1f2d42] text-xl text-white"><TbSchool /></span><div className="min-w-0"><h3 className="truncate font-heading text-lg font-black">{pjSchedule.title}</h3><p className="mt-0.5 text-xs font-semibold text-[#5a5a5a]">{pjSchedule.className} · Semester {pjSchedule.semester} · {pjSchedule.day}, {pjSchedule.startTime}–{pjSchedule.endTime}</p></div></div><label className="block"><span className="text-xs font-black uppercase tracking-wide text-[#5a5a5a]">Mahasiswa satu kelas</span><select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="mt-1.5 min-h-[50px] w-full rounded-xl border border-[#1a1a1a]/15 bg-white px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-[#f3701e]/30"><option value="">Pilih mahasiswa</option>{classmates.map((item) => <option key={item.id} value={item.id}>{item.name}{item.nim ? ` · ${item.nim}` : ""}</option>)}</select><p className="mt-2 text-xs leading-5 text-[#686868]">Hanya mahasiswa aktif dengan kelas dan semester yang sama yang dapat dipilih.</p></label>{pjSchedule.smartAcademicPjs.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#edf2f8] p-3"><div><p className="text-[11px] font-black uppercase tracking-wide text-[#4b607f]">PJ saat ini</p><p className="mt-1 text-sm font-bold text-[#1f2d42]">{pjSchedule.smartAcademicPjs[0].student.name}</p></div><button type="button" disabled={saving} onClick={() => void removePj()} className="min-h-[44px] rounded-xl border border-rose-700 px-3 text-sm font-black text-rose-800 disabled:opacity-50">Hapus PJ</button></div>}<button disabled={!selectedStudentId || saving || (pjSchedule.smartAcademicPjs.length === 1 && selectedStudentId === pjSchedule.smartAcademicPjs[0].student.id)} onClick={() => void assignPj()} className="min-h-[50px] w-full rounded-xl bg-[#f3701e] px-4 font-black text-[#1a1a1a] shadow-sm disabled:opacity-50">{saving ? "Menyimpan..." : pjSchedule.smartAcademicPjs.length ? "Simpan perubahan PJ" : "Tetapkan sebagai PJ"}</button></div></Modal>}

    {rejecting && <Modal title="Tolak pengajuan" onClose={() => setRejecting(null)}><div className="space-y-3"><label className="block text-xs font-black">Alasan penolakan<textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="neo-input mt-1 min-h-24 w-full" required /></label><button disabled={rejectionReason.trim().length < 3 || saving} onClick={() => void review(rejecting, false, rejectionReason)} className="neo-btn min-h-[44px] w-full bg-rose-700 font-black text-white">Tolak pengajuan</button></div></Modal>}
  </div>;
}

function SectionTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-start gap-3 px-1 py-1"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8d8c9] text-xl text-[#34445d]">{icon}</span><div><h2 className="font-heading text-xl font-black leading-tight">{title}</h2><p className="mt-1 text-sm leading-5 text-[#5a5a5a]">{text}</p></div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#1a1a1a]/25 bg-white px-6 py-12 text-center text-sm font-semibold text-[#5a5a5a] shadow-sm">{text}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { const [mounted, setMounted] = useState(false); useEffect(() => { queueMicrotask(() => setMounted(true)); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []); if (!mounted) return null; return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-xl font-black">{title}</h2><button type="button" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#f5ede6]" aria-label="Tutup"><TbX /></button></div></div><div className="min-h-0 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">{children}</div></div></div>, document.body); }
function StatusReportSheet({ title, onClose, saving, onSubmit, children }: { title: string; onClose: () => void; saving: boolean; onSubmit: (event: React.FormEvent) => void; children: React.ReactNode }) { const [mounted, setMounted] = useState(false); useEffect(() => { queueMicrotask(() => setMounted(true)); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []); if (!mounted) return null; return createPortal(<div className="fixed inset-0 z-[9999] flex items-end bg-black/60 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true"><form onSubmit={onSubmit} className="flex h-[min(92dvh,760px)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:h-auto sm:max-h-[760px] sm:max-w-lg sm:rounded-2xl"><div className="shrink-0 px-4 pt-3 sm:px-5"><div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#1a1a1a]/20 sm:hidden" /><div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-xl font-black">{title}</h2><button type="button" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#f5ede6]" aria-label="Tutup"><TbX /></button></div></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-5">{children}</div><div className="shrink-0 border-t border-[#1a1a1a]/10 bg-white px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_20px_rgba(26,26,26,.06)] sm:px-5 sm:pb-4"><Submit saving={saving} text="Simpan laporan status" /></div></form></div>, document.body); }
function Submit({ saving, text }: { saving: boolean; text: string }) { return <button disabled={saving} className="min-h-[50px] w-full rounded-xl bg-[#f3701e] px-4 font-black text-[#1a1a1a] shadow-sm transition-colors hover:bg-[#e45f0c] disabled:opacity-50">{saving ? "Menyimpan..." : text}</button>; }
function MoveCard({ move, canReview, onApprove, onReject }: { move: Move; canReview: boolean; onApprove: () => void; onReject: () => void }) { const green = move.riskLevel === "GREEN"; return <article className={`neo-card border-2 p-4 ${green ? "border-emerald-700 bg-emerald-50" : "border-amber-600 bg-amber-50"}`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap gap-2"><span className={`neo-badge px-2 py-1 text-[10px] font-black text-white ${green ? "bg-emerald-700" : "bg-amber-600"}`}>{green ? "HIJAU" : "KUNING"}</span><span className="neo-badge bg-white px-2 py-1 text-[10px] font-black">{STATUS[move.status]}</span></div><h3 className="mt-2 font-heading text-lg font-black">{move.targetSchedule.title}</h3><p className="text-sm">Menjadi {move.startTime}–{move.endTime} · {move.lab?.name || move.targetSchedule.lab.name}</p>{move.riskReasons?.length > 0 && <ul className="mt-2 list-inside list-disc text-xs font-bold text-amber-900">{move.riskReasons.map((item) => <li key={item}>{item}</li>)}</ul>}<p className="mt-2 text-xs text-[#5a5a5a]">{move.reviewedBy ? `Diputuskan oleh ${move.reviewedBy.name}` : green ? "Lolos semua pemeriksaan sistem" : "Menunggu petugas aktif"}{move.rejectionReason ? ` · ${move.rejectionReason}` : ""}</p></div>{canReview && <div className="flex gap-2"><button onClick={onApprove} className="neo-btn min-h-[44px] bg-emerald-700 px-4 text-xs font-black text-white"><TbCheck /> Setujui</button><button onClick={onReject} className="neo-btn min-h-[44px] bg-rose-700 px-4 text-xs font-black text-white"><TbX /> Tolak</button></div>}</div></article>; }
