"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TbCalendar, TbCheck, TbX } from "react-icons/tb";

function CalendarOAuthResult() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("status") === "connected";

  return (
    <main className="min-h-screen bg-[#fcf8f4] px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md bg-white neo-border rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_#1a1a1a] text-center">
        <div
          className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl neo-border ${
            connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {connected ? <TbCheck size={44} /> : <TbX size={44} />}
        </div>

        <div className="mb-3 flex items-center justify-center gap-2 text-[#4285F4]">
          <TbCalendar size={24} />
          <span className="font-bold">Google Calendar</span>
        </div>

        <h1 className="font-heading text-2xl font-bold text-[#1a1a1a]">
          {connected ? "Berhasil terhubung" : "Gagal menghubungkan kalender"}
        </h1>
        <p className="mt-3 font-medium leading-relaxed text-[#4b607f]">
          {connected
            ? "Akun Google Calendar Anda sudah terhubung. Tutup halaman ini dan kembali ke aplikasi LabKom."
            : "Izin Google belum berhasil disimpan. Tutup halaman ini, kembali ke aplikasi LabKom, lalu coba hubungkan kembali."}
        </p>

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={() => window.close()}
            className="neo-btn w-full bg-[#4b607f] py-3 font-bold text-white"
          >
            Tutup dan kembali ke aplikasi
          </button>
          <Link
            href="/"
            className="block text-sm font-bold text-[#4b607f] underline underline-offset-4"
          >
            Buka LabKom Web
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function CalendarOAuthResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fcf8f4] flex items-center justify-center font-bold text-[#4b607f]">
          Memeriksa hasil koneksi kalender...
        </main>
      }
    >
      <CalendarOAuthResult />
    </Suspense>
  );
}