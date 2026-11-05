"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TbCheck, TbLoader2, TbLock } from "react-icons/tb";

const API = process.env.NEXT_PUBLIC_API_URL || "";
function passwordError(value: string): string {
  if (value.length < 12) return "Minimal 12 karakter";
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) return "Gunakan huruf besar, kecil, angka, dan simbol";
  return "";
}

export default function VerifyExternalStudentPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { queueMicrotask(() => setToken(new URLSearchParams(window.location.search).get("token") || "")); }, []);
  const validation = useMemo(() => passwordError(password), [password]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (validation || password !== confirm) { setError(validation || "Konfirmasi password tidak sama"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/access-requests/external-student/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password, confirmPassword: confirm }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Verifikasi gagal"); setDone(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Verifikasi gagal"); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center bg-[#e8d8c9] p-4"><section className="neo-card mx-auto w-full max-w-md bg-white p-6 sm:p-8">
    {done ? <div className="text-center"><TbCheck className="mx-auto text-green-700" size={48} /><h1 className="mt-3 font-heading text-2xl font-bold">Akun berhasil diaktifkan</h1><p className="mt-2 text-sm text-[#5a5a5a]">Login menggunakan email dan password yang baru dibuat.</p><Link href="/login" className="neo-btn mt-5 inline-flex min-h-11 items-center bg-[#f3701e] px-5">Masuk</Link></div> : <>
      <TbLock size={36} className="text-[#4b607f]" /><h1 className="mt-3 font-heading text-2xl font-bold">Buat Password Akun</h1><p className="mt-2 text-sm text-[#5a5a5a]">Verifikasi email dan aktifkan akun mahasiswa Anda.</p>
      <form onSubmit={submit} className="mt-6 space-y-4"><label className="block space-y-1"><span className="text-sm font-bold">Password</span><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="neo-input min-h-11 w-full px-4" /></label><label className="block space-y-1"><span className="text-sm font-bold">Konfirmasi password</span><input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="neo-input min-h-11 w-full px-4" /></label>{error && <p role="alert" className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={loading || !token} className="neo-btn flex min-h-12 w-full items-center justify-center gap-2 bg-[#f3701e] font-bold">{loading && <TbLoader2 className="animate-spin" />} Aktifkan Akun</button></form>
    </>}
  </section></main>;
}
