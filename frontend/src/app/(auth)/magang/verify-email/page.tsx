"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TbAlertCircle, TbCircleCheck, TbFlask, TbLoader2, TbMail } from "react-icons/tb";

type Outcome = "idle" | "success" | "error";

const GENERIC_ERROR = "Tautan verifikasi tidak valid atau sudah kedaluwarsa. Minta tautan baru melalui kanal resmi.";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [outcome, setOutcome] = useState<Outcome>(token ? "idle" : "error");
  const [isLoading, setIsLoading] = useState(false);

  const verifyEmail = async () => {
    if (!token || isLoading || outcome !== "idle") return;

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/access-requests/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => null);
      setOutcome(response.ok && data?.success ? "success" : "error");
    } catch {
      setOutcome("error");
    } finally {
      setIsLoading(false);
    }
  };

  const isSuccess = outcome === "success";
  const message = isSuccess
    ? "Email berhasil diverifikasi. Pengajuan sedang menunggu persetujuan Koordinator Laboratorium."
    : outcome === "error"
      ? GENERIC_ERROR
      : "Konfirmasi email untuk melanjutkan proses pengajuan MAGANG.";

  return (
    <main className="min-h-screen bg-[var(--color-cream)] px-4 py-8 sm:px-6 sm:py-12 flex items-center justify-center">
      <section className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[var(--color-orange)] neo-border neo-shadow-lg mb-4">
            <TbFlask className="text-white text-3xl" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[#1a1a1a]">Verifikasi Email MAGANG</h1>
          <p className="text-[#5a5a5a] font-medium mt-2">Labkom Management</p>
        </div>

        <div className="neo-card bg-white p-6 sm:p-8">
          <div className={`mb-6 p-4 neo-border-sm rounded-lg flex items-start gap-3 ${isSuccess ? "bg-[#dcfce7]" : outcome === "error" ? "bg-[#ffcdd2]" : "bg-[var(--color-secondary)]"}`}>
            {isSuccess ? (
              <TbCircleCheck className="text-green-700 text-2xl mt-0.5 shrink-0" />
            ) : outcome === "error" ? (
              <TbAlertCircle className="text-red-600 text-2xl mt-0.5 shrink-0" />
            ) : (
              <TbMail className="text-[var(--color-steel-blue)] text-2xl mt-0.5 shrink-0" />
            )}
            <p className="text-sm font-bold text-[#1a1a1a]">{message}</p>
          </div>

          {outcome === "idle" && (
            <button
              type="button"
              onClick={verifyEmail}
              disabled={isLoading || !token}
              className="w-full min-h-[44px] py-3.5 bg-[var(--color-orange)] text-[#1a1a1a] neo-btn flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <TbLoader2 className="animate-spin text-xl" /> : <TbMail className="text-xl" />}
              <span>{isLoading ? "Memverifikasi..." : "Verifikasi Email"}</span>
            </button>
          )}

          {outcome !== "idle" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/login" className="min-h-[44px] py-3 px-4 bg-[var(--color-steel-blue)] text-white neo-btn flex items-center justify-center text-sm font-bold">
                Ke Halaman Login
              </Link>
              <Link href="/register" className="min-h-[44px] py-3 px-4 bg-[var(--color-secondary)] text-[#1a1a1a] neo-btn flex items-center justify-center text-sm font-bold">
                Kembali ke Pengajuan
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center"><TbLoader2 className="text-[var(--color-steel-blue)] text-4xl animate-spin" /></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
