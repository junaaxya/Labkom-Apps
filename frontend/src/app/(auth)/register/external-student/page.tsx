"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { TbArrowLeft, TbLoader2, TbMail, TbSchool, TbUser } from "react-icons/tb";

const API = process.env.NEXT_PUBLIC_API_URL || "";

export default function ExternalStudentRegistrationPage() {
  const [form, setForm] = useState({ name: "", nim: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [canResend, setCanResend] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/access-requests/external-student`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 503) setCanResend(true);
        throw new Error(result.message || "Pendaftaran gagal");
      }
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Pendaftaran gagal");
    } finally { setLoading(false); }
  };

  return <main className="min-h-screen bg-[#e8d8c9] p-4 sm:p-8"><div className="mx-auto max-w-lg space-y-4">
    <Link href="/register" className="neo-btn inline-flex min-h-11 items-center gap-2 bg-white px-4"><TbArrowLeft /> Kembali</Link>
    <section className="neo-card bg-white p-6 sm:p-8">
      <div className="mb-6"><h1 className="font-heading text-2xl font-bold sm:text-3xl">Daftar Mahasiswa Prodi Lain</h1><p className="mt-2 text-sm text-[#5a5a5a]">Masukkan identitas Anda. Tautan aktivasi akun dikirim ke email.</p></div>
      {sent ? <div className="rounded-xl border-2 border-green-700 bg-green-50 p-5"><p className="font-bold text-green-900">Periksa email Anda</p><p className="mt-2 text-sm text-green-800">Klik tautan verifikasi dalam 24 jam, lalu buat password untuk mengaktifkan akun.</p><Link href="/login" className="neo-btn mt-4 inline-flex min-h-11 items-center bg-white px-4">Ke Login</Link></div> :
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5"><span className="text-sm font-bold">Nama lengkap</span><div className="relative"><TbUser className="absolute left-4 top-1/2 -translate-y-1/2" /><input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="neo-input min-h-11 w-full pl-11 pr-4" /></div></label>
        <label className="block space-y-1.5"><span className="text-sm font-bold">NIM</span><div className="relative"><TbSchool className="absolute left-4 top-1/2 -translate-y-1/2" /><input required value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} className="neo-input min-h-11 w-full pl-11 pr-4" /></div></label>
        <label className="block space-y-1.5"><span className="text-sm font-bold">Email aktif</span><div className="relative"><TbMail className="absolute left-4 top-1/2 -translate-y-1/2" /><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="neo-input min-h-11 w-full pl-11 pr-4" /></div></label>
        <p className="rounded-lg bg-[#f5ede6] p-3 text-xs font-medium">Semester dan kelas belum terisi saat akun aktif. Koordinator dapat melengkapinya agar jadwal akademik sesuai cohort Anda.</p>
        {error && <div role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-700"><p>{error}</p>{canResend && <button type="button" onClick={async () => { setLoading(true); await fetch(`${API}/access-requests/external-student/resend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email }) }); setLoading(false); setSent(true); }} className="neo-btn mt-3 min-h-11 bg-white px-4 text-[#1a1a1a]">Kirim Ulang Email</button>}</div>}
        <button disabled={loading} className="neo-btn flex min-h-12 w-full items-center justify-center gap-2 bg-[#f3701e] font-bold">{loading && <TbLoader2 className="animate-spin" />} {loading ? "Mengirim..." : "Kirim Tautan Verifikasi"}</button>
      </form>}
    </section>
  </div></main>;
}
