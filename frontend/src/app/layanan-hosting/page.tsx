import type { Metadata } from "next";
import Link from "next/link";
import {
  TbArrowRight,
  TbCheck,
  TbClock,
  TbCreditCard,
  TbHeadset,
  TbReceipt,
  TbServer2,
  TbShieldCheck,
  TbSettings,
} from "react-icons/tb";
import { HostingOrderButton } from "@/components/hosting/hosting-order-button";
import { HOSTING_PLANS, formatIdr, type HostingPlan } from "@/lib/hosting-plans";

export const metadata: Metadata = {
  title: "Paket Layanan Hosting VPS | LabKom",
  description:
    "Paket layanan hosting VPS LabKom dengan harga dalam Rupiah dan pembayaran online melalui Midtrans.",
};

const includedFeatures = [
  "Setup awal server",
  "Backup harian otomatis",
  "SSL gratis untuk domain yang terhubung",
  "Proteksi jaringan dasar",
  "Monitoring uptime",
  "Dukungan teknis via WhatsApp/email",
];

const processSteps = [
  {
    icon: TbServer2,
    title: "Pilih Paket",
    description: "Customer memilih paket VPS sesuai kebutuhan CPU, RAM, dan storage.",
  },
  {
    icon: TbReceipt,
    title: "Isi Data Pemesan",
    description: "Customer mengisi nama, email, WhatsApp, dan catatan konfigurasi.",
  },
  {
    icon: TbCreditCard,
    title: "Bayar via Midtrans",
    description: "Sistem membuat transaksi dan customer memilih metode pembayaran di halaman Midtrans.",
  },
  {
    icon: TbSettings,
    title: "Provisioning Layanan",
    description: "Setelah pembayaran terkonfirmasi, tim LabKom menyiapkan VPS dan mengirim credential.",
  },
];

function PriceCard({ plan }: { plan: HostingPlan }) {
  const monthlyPrice = Math.round(plan.price / 12);

  return (
    <article
      className={`neo-card flex h-full flex-col p-5 ${
        plan.isPopular ? "!bg-[#4b607f] text-white" : "bg-white text-[#1a1a1a]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-heading font-bold">{plan.name}</h3>
          <p className={plan.isPopular ? "text-white/80" : "text-[#5a5a5a]"}>
            {plan.subtitle}
          </p>
        </div>
        <span
          className={`rounded-lg border-2 px-2 py-1 text-xs font-bold ${
            plan.isPopular
              ? "border-white bg-[#f3701e] text-white"
              : "border-[#1a1a1a] bg-[#f5ede6]"
          }`}
        >
          Hemat {plan.discount}%
        </span>
      </div>

      <p className={`mt-3 text-sm ${plan.isPopular ? "text-white/75" : "text-[#5a5a5a]"}`}>
        {plan.tagline}
      </p>

      <div className="mt-5">
        <div className="flex items-end gap-1">
          <span className="text-3xl font-heading font-bold">
            {formatIdr(monthlyPrice)}
          </span>
          <span className={plan.isPopular ? "pb-1 text-sm text-white/75" : "pb-1 text-sm text-[#5a5a5a]"}>
            /bulan
          </span>
        </div>
        <p className={plan.isPopular ? "mt-2 text-sm text-white/75" : "mt-2 text-sm text-[#5a5a5a]"}>
          Dibayar {formatIdr(plan.price)} untuk 12 bulan
        </p>
        <p className={plan.isPopular ? "text-xs text-white/60 line-through" : "text-xs text-[#5a5a5a] line-through"}>
          Harga normal {formatIdr(plan.originalPrice)}
        </p>
      </div>

      <div className={`my-5 h-[3px] ${plan.isPopular ? "bg-white/30" : "bg-[#1a1a1a]"}`} />

      <ul className="space-y-3">
        {plan.specs.map((spec) => (
          <li key={spec.label} className="flex items-center justify-between gap-4 text-sm">
            <span className={plan.isPopular ? "text-white/75" : "text-[#5a5a5a]"}>
              {spec.label}
            </span>
            <span className="font-bold">{spec.value}</span>
          </li>
        ))}
      </ul>

      <ul className="mt-5 flex flex-1 flex-col gap-2">
        {includedFeatures.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <TbCheck className={plan.isPopular ? "mt-0.5 h-4 w-4 text-[#f3701e]" : "mt-0.5 h-4 w-4 text-[#4b607f]"} />
            <span className={plan.isPopular ? "text-white/85" : "text-[#5a5a5a]"}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <HostingOrderButton plan={plan} />
        <p className={plan.isPopular ? "mt-3 text-center text-xs text-white/65" : "mt-3 text-center text-xs text-[#5a5a5a]"}>
          Perpanjangan: {formatIdr(plan.renewalPrice)}/tahun
        </p>
      </div>
    </article>
  );
}

export default function HostingServicesPage() {
  return (
    <main className="min-h-screen bg-[#e8d8c9] text-[#1a1a1a]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#f3701e] text-xl font-heading font-bold text-white neo-border-sm neo-shadow-sm">
            L
          </span>
          <span className="font-heading text-xl font-bold">LabKom Hosting</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden font-bold text-[#4b607f] sm:inline">
            Login LabKom
          </Link>
          <a href="#pricing" className="neo-btn bg-white px-4 py-2 text-sm">
            Lihat Harga
          </a>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <span className="neo-badge bg-white text-[#1a1a1a]">
            VPS kampus dengan pembayaran Midtrans
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-heading font-bold leading-tight sm:text-5xl lg:text-6xl">
            Paket Layanan Hosting VPS untuk Website dan Aplikasi Anda
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-[#5a5a5a]">
            LabKom menyediakan layanan VPS berbasis server mandiri kampus untuk kebutuhan website,
            sistem informasi, aplikasi praktikum, dan project bisnis. Harga tercantum dalam IDR dan
            pembayaran diproses melalui Midtrans.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#pricing" className="neo-btn inline-flex items-center justify-center gap-2 bg-[#f3701e] px-6 py-3 font-bold text-white">
              Pilih Paket <TbArrowRight className="h-5 w-5" />
            </a>
            <a href="#process" className="neo-btn inline-flex items-center justify-center bg-white px-6 py-3 font-bold">
              Lihat Alur Pemesanan
            </a>
          </div>
        </div>

        <div className="neo-card bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#4b607f] p-5 text-white">
              <TbShieldCheck className="h-9 w-9 text-[#f3701e]" />
              <h2 className="mt-4 text-2xl font-heading font-bold">Server Mandiri</h2>
              <p className="mt-2 text-sm text-white/80">
                Infrastruktur dikelola internal untuk kebutuhan hosting kampus dan customer umum.
              </p>
            </div>
            <div className="rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] p-5">
              <TbClock className="h-9 w-9 text-[#4b607f]" />
              <h2 className="mt-4 text-2xl font-heading font-bold">Aktif 1x24 Jam</h2>
              <p className="mt-2 text-sm font-medium text-[#5a5a5a]">
                Credential dikirim setelah pembayaran berhasil dan konfigurasi selesai.
              </p>
            </div>
            <div className="rounded-lg border-2 border-[#1a1a1a] bg-white p-5 sm:col-span-2">
              <TbHeadset className="h-9 w-9 text-[#f3701e]" />
              <h2 className="mt-4 text-2xl font-heading font-bold">Dukungan Setup</h2>
              <p className="mt-2 text-sm font-medium text-[#5a5a5a]">
                Tim membantu setup awal seperti OS preference, hostname, SSL, dan kebutuhan deploy dasar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y-4 border-[#1a1a1a] bg-[#f5ede6] py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-10 max-w-3xl">
            <span className="neo-badge bg-white text-[#1a1a1a]">Harga Produk dalam IDR</span>
            <h2 className="mt-4 text-3xl font-heading font-bold sm:text-4xl">
              Pilih Paket VPS
            </h2>
            <p className="mt-3 font-medium text-[#5a5a5a]">
              Semua harga ditampilkan dalam Rupiah, berlaku untuk komitmen 12 bulan, dan pembayaran
              dilakukan satu kali melalui payment gateway Midtrans.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {HOSTING_PLANS.map((plan) => (
              <PriceCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      <section id="process" className="mx-auto max-w-7xl px-5 py-16">
        <div className="mb-10 max-w-3xl">
          <span className="neo-badge bg-white text-[#1a1a1a]">End-to-End Process</span>
          <h2 className="mt-4 text-3xl font-heading font-bold sm:text-4xl">
            Alur Pemesanan sampai Pembayaran
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          {processSteps.map((step, index) => (
            <article key={step.title} className="neo-card bg-white p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f3701e] text-white neo-border-sm">
                <step.icon className="h-6 w-6" />
              </div>
              <p className="mt-5 text-sm font-heading font-bold text-[#4b607f]">
                Langkah {index + 1}
              </p>
              <h3 className="mt-1 text-xl font-heading font-bold">{step.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-[#5a5a5a]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="neo-card bg-[#4b607f] p-7 text-white sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-3xl font-heading font-bold">Butuh paket khusus?</h2>
              <p className="mt-3 max-w-2xl text-white/80">
                Untuk kebutuhan dedicated resource, migrasi aplikasi, atau kontrak instansi,
                hubungi tim LabKom sebelum melakukan pembayaran.
              </p>
            </div>
            <a href="#pricing" className="neo-btn inline-flex items-center justify-center bg-[#f3701e] px-6 py-3 font-bold text-white">
              Mulai Pesan
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
