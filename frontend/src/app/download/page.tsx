import Link from "next/link";
import { TbArrowLeft, TbBrandAndroid, TbDownload, TbListCheck, TbShieldCheck, TbVersions } from "react-icons/tb";

const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL || "/downloads/labkom-management.apk";
const apkVersion = process.env.NEXT_PUBLIC_ANDROID_APK_VERSION || "1.0.0";
const apkUpdatedAt = process.env.NEXT_PUBLIC_ANDROID_APK_UPDATED_AT || "02 Agustus 2026";
const apkSize = process.env.NEXT_PUBLIC_ANDROID_APK_SIZE || "Belum diisi";

const installSteps = [
  "Tekan tombol Download APK dan tunggu file selesai diunduh.",
  "Buka file APK dari browser, Google Drive, atau File Manager.",
  "Saat diminta, aktifkan izin Install unknown apps untuk aplikasi yang dipakai membuka APK.",
  "Tekan Install, tunggu proses selesai, lalu buka LabKom Management dan login.",
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[#e8d8c9] px-4 py-8 text-[#1a1a1a] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2 font-bold neo-btn"
        >
          <TbArrowLeft className="h-4 w-4" />
          Kembali ke Landing Page
        </Link>

        <section className="neo-card overflow-hidden bg-white p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f5ede6] px-4 py-2 text-sm font-black uppercase neo-border-sm">
                <TbBrandAndroid className="h-4 w-4 text-[#f3701e]" />
                Aplikasi Android Resmi
              </span>

              <div className="space-y-3">
                <h1 className="font-heading text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                  Download APK LabKom Management
                </h1>
                <p className="max-w-2xl text-sm font-medium text-[#5a5a5a] sm:text-base">
                  Install aplikasi Android LabKom langsung dari website. APK ini membuka sistem produksi
                  <span className="font-black text-[#1a1a1a]"> https://lab-ilkom.my.id</span>.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={apkUrl}
                  className="neo-btn inline-flex min-h-[48px] items-center justify-center gap-2 bg-[#f3701e] px-6 py-3 text-base font-black text-white"
                >
                  <TbDownload className="h-5 w-5" />
                  Download APK
                </a>
                <Link
                  href="/login"
                  className="neo-btn inline-flex min-h-[48px] items-center justify-center gap-2 bg-white px-6 py-3 text-base font-black"
                >
                  Buka Login Web
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-[#eef2f7] p-4 neo-border-sm">
                  <p className="flex items-center gap-2 text-xs font-black uppercase text-[#5a5a5a]">
                    <TbVersions className="h-4 w-4 text-[#4b607f]" />
                    Versi APK
                  </p>
                  <p className="mt-2 text-lg font-black">{apkVersion}</p>
                </div>
                <div className="rounded-xl bg-[#eef2f7] p-4 neo-border-sm">
                  <p className="text-xs font-black uppercase text-[#5a5a5a]">Update Terakhir</p>
                  <p className="mt-2 text-lg font-black">{apkUpdatedAt}</p>
                </div>
                <div className="rounded-xl bg-[#eef2f7] p-4 neo-border-sm">
                  <p className="text-xs font-black uppercase text-[#5a5a5a]">Ukuran File</p>
                  <p className="mt-2 text-lg font-black">{apkSize}</p>
                </div>
              </div>
            </div>

            <aside className="space-y-4 rounded-2xl bg-[#4b607f] p-5 text-white neo-border sm:p-6">
              <h2 className="font-heading text-2xl font-black">Sebelum Install</h2>
              <ul className="space-y-3 text-sm font-medium text-white/90">
                <li className="flex gap-3">
                  <TbShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#f3701e]" />
                  Pastikan download hanya dari website resmi LabKom.
                </li>
                <li className="flex gap-3">
                  <TbShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#f3701e]" />
                  APK ini khusus Android. iPhone tetap memakai web/PWA.
                </li>
                <li className="flex gap-3">
                  <TbShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#f3701e]" />
                  Saat pertama install, Android mungkin meminta izin Install unknown apps.
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="neo-card bg-white p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f3701e] text-white neo-border-sm">
              <TbListCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-black">Cara Install untuk Mahasiswa</h2>
              <p className="text-sm font-medium text-[#5a5a5a]">Ikuti langkah ini satu per satu di HP Android.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {installSteps.map((step, index) => (
              <div key={step} className="rounded-xl bg-[#f5ede6] p-4 neo-border-sm">
                <p className="text-xs font-black uppercase text-[#5a5a5a]">Langkah {index + 1}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-[#1a1a1a]">{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
