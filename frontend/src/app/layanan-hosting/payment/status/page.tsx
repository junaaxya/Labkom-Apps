"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import { TbAlertTriangle, TbCheck, TbClock, TbLoader2, TbMailForward, TbX } from "react-icons/tb";
import { formatIdr } from "@/lib/hosting-plans";

interface StatusResponse {
  success: boolean;
  message?: string;
  data?: {
    orderId: string;
    status: "SUCCESS" | "PROCESS" | "FAILED" | "UNKNOWN";
    statusCode: string;
    statusMessage?: string;
    reference?: string;
    planName: string;
    amount: number;
  };
}

type TransactionStatus = NonNullable<StatusResponse["data"]>["status"];

function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL belum dikonfigurasi.");
  return url;
}

function getStatusCopy(status: TransactionStatus) {
  if (status === "SUCCESS") {
    return {
      icon: TbCheck,
      iconClass: "bg-[#22c55e]",
      title: "Pembayaran Berhasil",
      description: "Pesanan VPS Anda sudah masuk. Tim LabKom akan menyiapkan layanan dan mengirim credential ke email Anda dalam 1x24 jam.",
    };
  }

  if (status === "PROCESS") {
    return {
      icon: TbClock,
      iconClass: "bg-[#eab308]",
      title: "Pembayaran Sedang Diproses",
      description: "Pembayaran masih menunggu konfirmasi dari Duitku. Buka kembali halaman ini setelah pembayaran selesai.",
    };
  }

  if (status === "FAILED") {
    return {
      icon: TbX,
      iconClass: "bg-red-600",
      title: "Pembayaran Gagal atau Kedaluwarsa",
      description: "Transaksi tidak berhasil diproses. Anda bisa membuat pesanan baru dari halaman paket hosting.",
    };
  }

  return {
    icon: TbAlertTriangle,
    iconClass: "bg-[#5a5a5a]",
    title: "Status Belum Dikenali",
    description: "Duitku belum mengembalikan status yang bisa dipetakan. Silakan cek kembali beberapa saat lagi.",
  };
}

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("merchantOrderId") || searchParams.get("order_id") || "";
  const [data, setData] = useState<StatusResponse["data"]>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      if (!orderId) {
        setError("Order ID tidak ditemukan pada URL pembayaran.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${getApiBaseUrl()}/hosting/transactions/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as StatusResponse;

        if (!response.ok || !result.data) {
          throw new Error(result.message || "Gagal mengecek status transaksi.");
        }

        if (active) {
          setData(result.data);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Gagal mengecek status transaksi.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStatus();

    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <StatusShell>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#4b607f] neo-border-sm">
          <TbLoader2 className="h-10 w-10 animate-spin text-white" />
        </div>
        <h1 className="mt-6 text-3xl font-heading font-bold">Mengecek Status Pembayaran</h1>
        <p className="mt-4 font-medium leading-relaxed text-[#5a5a5a]">
          Sistem sedang mengambil status transaksi langsung dari Duitku.
        </p>
      </StatusShell>
    );
  }

  if (error || !data) {
    return (
      <StatusShell>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600 neo-border-sm">
          <TbAlertTriangle className="h-10 w-10 text-white" />
        </div>
        <h1 className="mt-6 text-3xl font-heading font-bold">Status Tidak Dapat Dicek</h1>
        <p className="mt-4 font-medium leading-relaxed text-[#5a5a5a]">{error}</p>
        {orderId && (
          <p className="mt-4 rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] px-3 py-2 text-sm font-bold">
            Order ID: {orderId}
          </p>
        )}
        <StatusActions />
      </StatusShell>
    );
  }

  const copy = getStatusCopy(data.status);
  const Icon = copy.icon;

  return (
    <StatusShell>
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full neo-border-sm ${copy.iconClass}`}>
        <Icon className="h-10 w-10 text-white" />
      </div>

      <h1 className="mt-6 text-3xl font-heading font-bold">{copy.title}</h1>
      <p className="mt-4 font-medium leading-relaxed text-[#5a5a5a]">{copy.description}</p>

      <div className="mt-5 space-y-2 rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] px-4 py-3 text-left text-sm font-semibold">
        <p>Order ID: {data.orderId}</p>
        {data.reference && <p>Reference: {data.reference}</p>}
        <p>Paket: {data.planName}</p>
        <p>Total: {formatIdr(data.amount)}</p>
      </div>

      {data.status === "SUCCESS" && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-[#4b607f]">
          <TbMailForward className="h-5 w-5" />
          Cek email dan WhatsApp untuk update provisioning.
        </div>
      )}

      <StatusActions />
    </StatusShell>
  );
}

function StatusShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8d8c9] px-5 py-12 text-[#1a1a1a]">
      <section className="neo-card max-w-xl bg-white p-7 text-center sm:p-10">{children}</section>
    </main>
  );
}

function StatusActions() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Link href="/layanan-hosting#pricing" className="neo-btn bg-[#f3701e] px-5 py-3 font-bold text-white">
        Kembali ke Paket Hosting
      </Link>
      <Link href="/" className="neo-btn bg-white px-5 py-3 font-bold">
        Beranda LabKom
      </Link>
    </div>
  );
}

export default function HostingPaymentStatusPage() {
  return (
    <Suspense
      fallback={
        <StatusShell>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#4b607f] neo-border-sm">
            <TbLoader2 className="h-10 w-10 animate-spin text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-heading font-bold">Mengecek Status Pembayaran</h1>
        </StatusShell>
      }
    >
      <PaymentStatusContent />
    </Suspense>
  );
}
