"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import {
  TbBook2,
  TbQrcode,
  TbTicket,
  TbMap2,
  TbRobot,
  TbTrophy,
  TbArrowRight,
  TbStar,
  TbUsers,
  TbDeviceDesktopAnalytics,
  TbCheck,
} from "react-icons/tb";
import type { IconType } from "react-icons";

const features: { icon: IconType; label: string; description: string; color: string }[] = [
  { icon: TbBook2, label: "Logbook Digital", description: "Catat penggunaan lab tanpa kertas. Cepat & rapi.", color: "#4b607f" },
  { icon: TbQrcode, label: "QR Key Tracking", description: "Pantau peminjaman kunci lab secara real-time.", color: "#f3701e" },
  { icon: TbTicket, label: "Ticketing System", description: "Laporkan kerusakan alat langsung dari sistem.", color: "#22c55e" },
  { icon: TbMap2, label: "Peta Interaktif", description: "Lihat ketersediaan PC lab dalam satu layar.", color: "#eab308" },
  { icon: TbRobot, label: "Asisten AI", description: "Bantuan otomatis untuk troubleshooting dasar.", color: "#9ca3af" },
  { icon: TbTrophy, label: "Misi & Gamifikasi", description: "Selesaikan misi dan dapatkan reward menarik.", color: "#ef4444" },
];

const stats = [
  { label: "Laboratorium", value: "8+", icon: TbDeviceDesktopAnalytics },
  { label: "Pengguna Aktif", value: "2.5K", icon: TbUsers },
  { label: "Tiket Selesai", value: "15K+", icon: TbCheck },
];

export default function Home() {
  const router = useRouter();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -100]);
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    }
  }, [mounted, router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#e8d8c9] font-sans overflow-x-hidden text-[#1a1a1a] selection:bg-[#f3701e] selection:text-white neo-grain">
      
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          style={{ y: y1 }}
          className="absolute top-20 right-[10%] w-32 h-32 bg-[#4b607f] neo-border neo-shadow opacity-20 rotate-12"
        />
        <motion.div 
          style={{ y: y2 }}
          className="absolute top-60 left-[5%] w-24 h-24 rounded-full bg-[#f3701e] neo-border neo-shadow opacity-20"
        />
        <motion.div 
          style={{ y: y1 }}
          className="absolute bottom-40 right-[20%] w-40 h-8 bg-white neo-border neo-shadow opacity-20 -rotate-6"
        />
      </div>

      <main className="relative z-10">
        <nav className="p-6 max-w-7xl mx-auto flex justify-between items-center animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-[#f3701e] neo-border neo-shadow-sm rounded-lg -rotate-3 hover:rotate-0 transition-transform">
              <span className="text-white font-heading font-bold text-2xl">L</span>
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight hidden sm:block">Labkom</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="px-5 py-2 font-bold hover:bg-[#d4c4b5] transition-colors rounded-lg">
              Masuk
            </Link>
            <Link href="/register" className="px-5 py-2 bg-white text-[#1a1a1a] neo-btn hidden sm:block">
              Daftar Sekarang
            </Link>
          </div>
        </nav>

        <section className="pt-20 pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white neo-border-sm rounded-full mb-8 shadow-[2px_2px_0px_#1a1a1a]"
          >
            <TbStar className="text-[#f3701e] fill-[#f3701e]" />
            <span className="text-sm font-bold">V2.0 Tersedia Sekarang</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-7xl font-heading font-bold leading-[1.1] mb-6 max-w-4xl"
          >
            Manajemen Lab yang <br className="hidden sm:block"/>
            <span className="neo-gradient-text relative inline-block">
              Tidak Membosankan.
              <svg className="absolute w-full h-4 -bottom-2 left-0 text-[#f3701e]" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/>
              </svg>
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-[#5a5a5a] max-w-2xl mb-12"
          >
            Sistem terpusat untuk asisten dan mahasiswa. Lacak perangkat, lapor kerusakan, dan dapatkan poin gamifikasi dalam satu platform brutal.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link href="/register" className="w-full sm:w-auto text-center px-8 py-4 bg-[#f3701e] text-white neo-btn text-lg flex items-center justify-center gap-2 group">
              Mulai Sekarang <TbArrowRight className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/login" className="w-full sm:w-auto text-center px-8 py-4 bg-white text-[#1a1a1a] neo-btn text-lg">
              Eksplorasi Fitur
            </Link>
          </motion.div>
        </section>

        <section className="border-y-4 border-[#1a1a1a] bg-white py-12 mb-32 overflow-hidden relative">
          <div className="absolute inset-0 bg-[#e8d8c9] opacity-20" style={{ backgroundImage: 'radial-gradient(#1a1a1a 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y-4 md:divide-y-0 md:divide-x-4 divide-[#1a1a1a] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_#1a1a1a] bg-white rounded-xl">
              {stats.map((stat, i) => (
                <div key={i} className="p-8 flex flex-col items-center text-center bg-white hover:bg-[#f5ede6] transition-colors">
                  <stat.icon className="w-10 h-10 mb-4 text-[#4b607f]" />
                  <h3 className="text-3xl sm:text-4xl font-heading font-bold mb-2">{stat.value}</h3>
                  <p className="font-bold text-[#5a5a5a] uppercase tracking-wider text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 max-w-7xl mx-auto pb-32">
          <div className="text-center mb-16">
            <span className="neo-tag mb-4 bg-[#f5ede6]">Fitur Unggulan</span>
            <h2 className="text-4xl sm:text-5xl font-heading font-bold">Semua yang kamu butuhkan.</h2>
            <div className="w-24 h-4 bg-[#f3701e] mx-auto mt-4 rounded-full border-2 border-[#1a1a1a]"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="neo-card-hover p-6 flex flex-col h-full bg-white relative overflow-hidden group"
              >
                <div 
                  className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"
                  style={{ backgroundColor: feature.color }}
                />
                
                <div 
                  className="w-14 h-14 rounded-xl border-2 border-[#1a1a1a] flex items-center justify-center mb-6 shadow-[3px_3px_0px_#1a1a1a]"
                  style={{ backgroundColor: feature.color }}
                >
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                
                <h3 className="text-xl font-heading font-bold mb-3">{feature.label}</h3>
                <p className="text-[#5a5a5a] font-medium leading-relaxed flex-grow">
                  {feature.description}
                </p>
                
                <div className="mt-6 flex items-center text-sm font-bold group-hover:text-[#f3701e] transition-colors w-fit">
                  <span>Pelajari lebih lanjut</span>
                  <TbArrowRight className="ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="px-6 max-w-5xl mx-auto pb-32">
          <div className="neo-card bg-[#4b607f] p-8 sm:p-12 text-center text-white relative overflow-hidden neo-shadow-lg">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}></div>
            
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-5xl font-heading font-bold mb-6">Siap untuk transisi lab digital?</h2>
              <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
                Tinggalkan pencatatan manual. Beralih ke Labkom sekarang dan nikmati kemudahan manajemen lab.
              </p>
              <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-[#f3701e] text-white neo-btn text-lg neo-glow">
                Daftar Gratis <TbArrowRight />
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t-4 border-[#1a1a1a] bg-white pt-12 pb-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-[#f3701e] neo-border rounded-lg">
                <span className="text-white font-heading font-bold text-xl">L</span>
              </div>
              <span className="font-heading font-bold text-xl tracking-tight">Labkom</span>
            </div>
            
            <div className="flex gap-6 text-sm font-bold text-[#5a5a5a]">
              <Link href="#" className="hover:text-[#f3701e] hover:underline decoration-2 underline-offset-4">Tentang</Link>
              <Link href="#" className="hover:text-[#f3701e] hover:underline decoration-2 underline-offset-4">Privasi</Link>
              <Link href="#" className="hover:text-[#f3701e] hover:underline decoration-2 underline-offset-4">Ketentuan</Link>
            </div>
          </div>
          
          <div className="max-w-7xl mx-auto mt-8 pt-8 border-t-2 border-[#1a1a1a]/10 flex flex-col md:flex-row justify-between items-center text-sm font-medium text-[#5a5a5a]">
            <p>&copy; {new Date().getFullYear()} Labkom. Semua hak cipta dilindungi.</p>
            <p>Versi 2.0.0-beta</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
