import Link from "next/link";
import { TbX } from "react-icons/tb";

export default function HostingPaymentFailedPage({
  searchParams,
}: {
  searchParams?: { order_id?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8d8c9] px-5 py-12 text-[#1a1a1a]">
      <section className="neo-card max-w-xl bg-white p-7 text-center sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-600 neo-border-sm">
          <TbX className="h-10 w-10 text-white" />
        </div>

        <h1 className="mt-6 text-3xl font-heading font-bold">Pembayaran Gagal</h1>
        <p className="mt-4 font-medium leading-relaxed text-[#5a5a5a]">
          Pembayaran tidak dapat diproses. Anda bisa mencoba lagi dari halaman paket hosting atau
          memilih metode pembayaran lain di Midtrans.
        </p>

        {searchParams?.order_id && (
          <p className="mt-4 rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] px-3 py-2 text-sm font-bold">
            Order ID: {searchParams.order_id}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/layanan-hosting#pricing" className="neo-btn bg-[#f3701e] px-5 py-3 font-bold text-white">
            Coba Lagi
          </Link>
          <Link href="/layanan-hosting" className="neo-btn bg-white px-5 py-3 font-bold">
            Kembali
          </Link>
        </div>
      </section>
    </main>
  );
}
