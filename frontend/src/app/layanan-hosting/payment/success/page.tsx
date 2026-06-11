import Link from "next/link";
import { TbCheck, TbClock, TbMailForward } from "react-icons/tb";

export default function HostingPaymentSuccessPage({
  searchParams,
}: {
  searchParams?: { status?: string; order_id?: string };
}) {
  const isPending = searchParams?.status === "pending";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8d8c9] px-5 py-12 text-[#1a1a1a]">
      <section className="neo-card max-w-xl bg-white p-7 text-center sm:p-10">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full neo-border-sm ${
          isPending ? "bg-[#eab308]" : "bg-[#22c55e]"
        }`}>
          {isPending ? (
            <TbClock className="h-10 w-10 text-white" />
          ) : (
            <TbCheck className="h-10 w-10 text-white" />
          )}
        </div>

        <h1 className="mt-6 text-3xl font-heading font-bold">
          {isPending ? "Pembayaran Sedang Diproses" : "Pembayaran Berhasil"}
        </h1>
        <p className="mt-4 font-medium leading-relaxed text-[#5a5a5a]">
          {isPending
            ? "Terima kasih. Pembayaran Anda sedang menunggu konfirmasi dari Midtrans. Tim LabKom akan memproses pesanan setelah pembayaran berhasil."
            : "Terima kasih. Pesanan VPS Anda sudah masuk. Tim LabKom akan menyiapkan layanan dan mengirim credential ke email Anda dalam 1x24 jam."}
        </p>

        {searchParams?.order_id && (
          <p className="mt-4 rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] px-3 py-2 text-sm font-bold">
            Order ID: {searchParams.order_id}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-[#4b607f]">
          <TbMailForward className="h-5 w-5" />
          Cek email dan WhatsApp untuk update provisioning.
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/layanan-hosting" className="neo-btn bg-[#f3701e] px-5 py-3 font-bold text-white">
            Kembali ke Paket Hosting
          </Link>
          <Link href="/" className="neo-btn bg-white px-5 py-3 font-bold">
            Beranda LabKom
          </Link>
        </div>
      </section>
    </main>
  );
}
