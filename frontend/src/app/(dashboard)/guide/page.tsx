"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TbAlertTriangle,
  TbApps,
  TbBook,
  TbCalendar,
  TbChevronDown,
  TbKey,
  TbPhone,
  TbRobot,
} from "react-icons/tb";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  content: React.ReactNode;
}

export default function GuidePage() {
  const [openSection, setOpenSection] = useState<string>("aturan-umum");

  const sections = useMemo<GuideSection[]>(
    () => [
      {
        id: "aturan-umum",
        title: "Aturan Umum Laboratorium",
        icon: TbBook,
        content: (
          <ul className="space-y-2 list-disc pl-5 text-sm text-[#4a4a4a]">
            <li>Dilarang membawa makanan dan minuman ke dalam laboratorium.</li>
            <li>Jaga kebersihan meja, kursi, dan area kerja setelah menggunakan lab.</li>
            <li>Matikan PC dan perangkat pendukung setelah sesi selesai.</li>
            <li>Laporkan kerusakan perangkat kepada asisten/koordinator lab secepatnya.</li>
          </ul>
        ),
      },
      {
        id: "pinjam-kunci",
        title: "Cara Meminjam Kunci",
        icon: TbKey,
        content: (
          <ol className="space-y-2 list-decimal pl-5 text-sm text-[#4a4a4a]">
            <li>Scan QR laboratorium pada pintu atau area check-in.</li>
            <li>Klik tombol <b>Ambil</b> pada menu peminjaman kunci.</li>
            <li>Gunakan laboratorium sesuai jadwal dan kebutuhan kegiatan.</li>
            <li>Setelah selesai, kembalikan kunci melalui menu pengembalian.</li>
          </ol>
        ),
      },
      {
        id: "lapor-kerusakan",
        title: "Cara Melaporkan Kerusakan",
        icon: TbAlertTriangle,
        content: (
          <ol className="space-y-2 list-decimal pl-5 text-sm text-[#4a4a4a]">
            <li>Scan QR pada unit PC/perangkat yang bermasalah.</li>
            <li>Pilih kategori kerusakan yang sesuai.</li>
            <li>Isi deskripsi kerusakan secara jelas dan ringkas.</li>
            <li>Kirim laporan untuk ditindaklanjuti oleh tim lab.</li>
          </ol>
        ),
      },
      {
        id: "jadwal-lab",
        title: "Jadwal Laboratorium",
        icon: TbCalendar,
        content: (
          <div className="space-y-2 text-sm text-[#4a4a4a]">
            <p>
              Jadwal laboratorium terbagi menjadi tiga jenis utama agar penggunaan ruang lebih teratur:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Praktikum</b>: Sesi kelas resmi sesuai jadwal mata kuliah.</li>
              <li><b>Peminjaman</b>: Penggunaan di luar jadwal praktikum dengan persetujuan.</li>
              <li><b>Kegiatan</b>: Event, workshop, atau aktivitas akademik lainnya.</li>
            </ul>
          </div>
        ),
      },
      {
        id: "kontak-bantuan",
        title: "Kontak & Bantuan",
        icon: TbPhone,
        content: (
          <div className="space-y-2 text-sm text-[#4a4a4a]">
            <p>Jika membutuhkan bantuan cepat, hubungi Koordinator Lab melalui kanal resmi jurusan.</p>
            <p>
              Untuk pertanyaan umum, Anda juga bisa menggunakan FAQ Bot pada halaman
              <Link href="/faq" className="font-semibold text-[#4b607f] hover:underline ml-1">
                /faq
              </Link>
              .
            </p>
          </div>
        ),
      },
      {
        id: "software-tersedia",
        title: "Software yang Tersedia",
        icon: TbApps,
        content: (
          <ul className="space-y-2 list-disc pl-5 text-sm text-[#4a4a4a]">
            <li>Visual Studio Code, IntelliJ IDEA, dan tools pemrograman dasar.</li>
            <li>Microsoft Office / LibreOffice untuk produktivitas dokumen.</li>
            <li>Browser modern (Chrome/Firefox/Edge) untuk kebutuhan praktikum web.</li>
            <li>Software pendukung jaringan, basis data, dan multimedia sesuai kurikulum.</li>
          </ul>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] text-[#1a1a1a] flex items-center justify-center neo-border-sm shrink-0">
          <TbBook size={28} strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#1a1a1a]">Panduan Lab</h1>
          <p className="text-[#4b607f] font-medium mt-1">Aturan dan prosedur penggunaan laboratorium</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {sections.map((section) => {
            const isOpen = openSection === section.id;
            const Icon = section.icon;

            return (
              <div key={section.id} className="neo-card bg-white overflow-hidden transition-all duration-200 hover:shadow-[4px_4px_0px_#1a1a1a]">
                <button
                  type="button"
                  onClick={() => setOpenSection((prev) => (prev === section.id ? "" : section.id))}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left hover:bg-[#f5ede6] transition-colors duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${isOpen ? 'bg-[#f3701e]' : 'bg-[#4b607f]'} text-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-center shrink-0 transition-colors duration-300`}>
                      <Icon className="w-6 h-6" strokeWidth={2.2} />
                    </div>
                    <h2 className="font-heading text-lg sm:text-xl font-bold text-[#1a1a1a]">{section.title}</h2>
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center neo-border-sm ${isOpen ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#1a1a1a]'} transition-all duration-300`}>
                    <TbChevronDown
                      size={20}
                      className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={2.2}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-2 border-t-2 border-[#1a1a1a] bg-[#f5ede6]">
                    <div className="pt-4 font-medium leading-relaxed">
                      {section.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="neo-card p-6 bg-[#f5ede6] hover:shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200">
            <div className="w-14 h-14 rounded-full bg-white neo-border flex items-center justify-center mb-4 shadow-[4px_4px_0px_#1a1a1a]">
              <TbRobot size={32} className="text-[#f3701e]" strokeWidth={2.2} />
            </div>
            <h3 className="font-heading font-bold text-xl text-[#1a1a1a] mb-2">Butuh Bantuan Cepat?</h3>
            <p className="text-[#4b607f] text-sm font-medium mb-6">
              Tanyakan pada AI Assistant kami untuk mendapat jawaban instan seputar lab.
            </p>
            <Link
              href="/faq"
              className="neo-btn w-full py-3 bg-[#f3701e] hover:bg-[#d95f10] transition-colors duration-200 text-white font-bold flex items-center justify-center gap-2"
            >
              <TbRobot size={20} strokeWidth={2.2} /> Buka FAQ Bot
            </Link>
          </div>

          <div className="neo-card p-6 bg-white hover:shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200">
            <h3 className="font-heading font-bold text-lg text-[#1a1a1a] mb-4 flex items-center gap-2">
              <TbAlertTriangle className="text-[#f3701e]" size={24} /> Informasi Penting
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 neo-border-sm rounded-xl">
                <p className="text-sm font-bold text-red-700">Dalam Keadaan Darurat</p>
                <p className="text-xs font-medium text-red-600 mt-1">Segera hubungi satpam gedung atau koordinator lab terdekat.</p>
              </div>
              <div className="p-3 bg-blue-50 neo-border-sm rounded-xl">
                <p className="text-sm font-bold text-blue-700">Jam Operasional</p>
                <p className="text-xs font-medium text-blue-600 mt-1">Senin - Jumat: 08.00 - 16.00 WIB</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
