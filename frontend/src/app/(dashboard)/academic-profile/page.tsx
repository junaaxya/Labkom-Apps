"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TbAlertTriangle, TbExternalLink, TbLoader2, TbLogout, TbSchool } from "react-icons/tb";
import api from "@/services/api";
import type { ApiResponse, User } from "@/types";

type Status = {
  required: boolean;
  activeTerm?: { id: string; code: string; name: string; startDate?: string; endDate?: string } | null;
  classes?: Array<{ id: string; code: string; name: string }>;
  current?: { semester?: string | null; studyProgram?: string | null; className?: string | null };
  suggestedSemester?: string;
  calendarUrl?: string;
};

export default function AcademicProfilePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [semester, setSemester] = useState(""); const [studyProgram, setStudyProgram] = useState(""); const [className, setClassName] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { queueMicrotask(async () => { const response = await api.get<ApiResponse<Status>>("/access-requests/academic-profile"); setStatus(response.data); setSemester(response.data.suggestedSemester || "1"); setStudyProgram(response.data.current?.studyProgram || ""); setClassName(response.data.current?.className || ""); }); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await api.patch<ApiResponse<User>>("/access-requests/academic-profile", { semester, studyProgram, className });
      const current = JSON.parse(localStorage.getItem("user") || "{}") as User;
      const updated = { ...current, ...response.data, academicProfileRequired: false };
      localStorage.setItem("user", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("labkom:user-updated", { detail: updated }));
      router.replace("/dashboard");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Gagal menyimpan profil akademik"); }
    finally { setSaving(false); }
  };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.assign("/login"); };
  if (!status) return <div className="flex min-h-[60vh] items-center justify-center"><TbLoader2 className="animate-spin" size={36} /></div>;
  return <div className="mx-auto max-w-xl space-y-3"><div className="flex justify-end"><button type="button" onClick={logout} className="neo-btn inline-flex min-h-11 items-center gap-2 bg-white px-4"><TbLogout /> Keluar</button></div><section className="neo-card overflow-hidden bg-white"><header className="border-b-2 border-[#1a1a1a] bg-[#fff3cd] p-5"><div className="flex gap-3"><TbAlertTriangle className="shrink-0 text-amber-700" size={28} /><div><h1 className="font-heading text-2xl font-bold">Lengkapi Profil Akademik</h1><p className="mt-1 text-sm font-medium">Akses Anda sementara dibatasi agar jadwal, kelas, dan fitur akademik tidak salah. Isi data berikut untuk membuka dashboard penuh.</p></div></div></header><form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
    {status.activeTerm && <div className="rounded-xl border-2 border-[#4b607f] bg-[#f5ede6] p-4"><p className="text-xs font-bold uppercase text-[#4b607f]">Term aktif</p><p className="font-heading text-lg font-bold">{status.activeTerm.name}</p><p className="mt-1 text-xs text-[#5a5a5a]">Semester tidak dinaikkan diam-diam. Sistem menyarankan kenaikan dan Anda wajib mengonfirmasi.</p></div>}
    <label className="block space-y-1.5"><span className="text-sm font-bold">Program studi</span><input required value={studyProgram} onChange={(e) => setStudyProgram(e.target.value)} placeholder="Contoh: Teknik Informatika" className="neo-input min-h-11 w-full px-4" /></label>
    <label className="block space-y-1.5"><span className="text-sm font-bold">Semester aktif</span><select value={semester} onChange={(e) => setSemester(e.target.value)} className="neo-input min-h-11 w-full px-4">{Array.from({ length: 14 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>Semester {value}</option>)}</select></label>
    <label className="block space-y-1.5"><span className="text-sm font-bold">Kelas</span>{status.classes?.length ? <select required value={className} onChange={(e) => setClassName(e.target.value)} className="neo-input min-h-11 w-full px-4"><option value="">Pilih kelas</option>{status.classes.map((item) => <option key={item.id} value={item.code}>{item.name} ({item.code})</option>)}</select> : <input required value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Contoh: TI-3A" className="neo-input min-h-11 w-full px-4" />}</label>
    {status.calendarUrl && <a href={status.calendarUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-bold text-[#4b607f] underline"><TbExternalLink /> Lihat kalender akademik resmi UNMUH Babel</a>}
    {error && <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <button disabled={saving || !studyProgram || !className} className="neo-btn flex min-h-12 w-full items-center justify-center gap-2 bg-[#f3701e] font-bold">{saving ? <TbLoader2 className="animate-spin" /> : <TbSchool />} Simpan dan Buka Dashboard</button>
  </form></section></div>;
}
