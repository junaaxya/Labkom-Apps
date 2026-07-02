"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { TbLoader2 } from "react-icons/tb";

function RedirectToStatus() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("merchantOrderId") || searchParams.get("order_id");
    const target = orderId
      ? `/layanan-hosting/payment/status?merchantOrderId=${encodeURIComponent(orderId)}`
      : "/layanan-hosting/payment/status";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8d8c9] px-5 py-12 text-[#1a1a1a]">
      <section className="neo-card max-w-xl bg-white p-7 text-center sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#4b607f] neo-border-sm">
          <TbLoader2 className="h-10 w-10 animate-spin text-white" />
        </div>
        <h1 className="mt-6 text-3xl font-heading font-bold">Mengarahkan ke Status Pembayaran</h1>
      </section>
    </main>
  );
}

export default function HostingPaymentFailedPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToStatus />
    </Suspense>
  );
}
