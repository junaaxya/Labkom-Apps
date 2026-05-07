"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TbMail, TbLock, TbEye, TbEyeOff, TbLoader2, TbAlertCircle, TbFlask, TbUsers, TbCalendarTime, TbUser, TbIdBadge } from "react-icons/tb";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    nim: "",
    role: "MAHASISWA" as const,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return Math.min(score, 4);
  };

  const strength = getPasswordStrength(formData.password);

  const getStrengthColor = () => {
    if (strength === 0) return "bg-[#e8d8c9]";
    if (strength === 1) return "bg-red-500";
    if (strength === 2) return "bg-orange-500";
    if (strength === 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (strength === 0) return "";
    if (strength === 1) return "Sangat Lemah";
    if (strength === 2) return "Lemah";
    if (strength === 3) return "Sedang";
    return "Kuat";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Password dan Konfirmasi Password tidak cocok");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password minimal 6 karakter");
      setIsLoading(false);
      return;
    }

    try {
      const { confirmPassword: _, ...payload } = formData;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Registrasi gagal");
        setIsLoading(false);
        return;
      }

      localStorage.setItem("token", data.data.token);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      window.location.href = "/dashboard";
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-cream)] flex flex-col md:flex-row overflow-hidden">
      <div className="hidden md:flex md:w-1/2 bg-[var(--color-steel-blue)] p-12 relative flex-col justify-between neo-border-r border-[#1a1a1a] border-r-4 z-10 overflow-hidden">
        <div className="absolute top-10 right-10 w-32 h-32 bg-[var(--color-orange)] rounded-full neo-border neo-shadow-lg opacity-90" />
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-[var(--color-cream)] rotate-12 neo-border neo-shadow-lg" />
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-[#22c55e] rotate-45 neo-border neo-shadow" />
        
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#1a1a1a 2px, transparent 2px)',
            backgroundSize: '24px 24px'
          }}
        />

        <div className="relative z-20">
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-[var(--color-orange)] neo-border neo-shadow-lg mb-8"
          >
            <TbFlask className="text-white text-4xl" />
          </motion.div>
          <motion.h1 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="font-heading text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-[4px_4px_0_rgba(26,26,26,1)]"
          >
            Labkom<br />Management
          </motion.h1>
          <motion.p 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="text-xl text-[var(--color-cream)] font-medium max-w-md neo-border-sm bg-[#1a1a1a] p-4 rounded-lg shadow-[4px_4px_0_var(--color-orange)]"
          >
            Bergabunglah untuk akses mudah ke peminjaman alat dan penjadwalan.
          </motion.p>
        </div>

        <div className="relative z-20 space-y-6 mt-12">
          {[
            { icon: TbUsers, text: "Manajemen Asisten & Pengguna" },
            { icon: TbFlask, text: "Pelacakan Inventaris Real-time" },
            { icon: TbCalendarTime, text: "Penjadwalan Praktikum Mudah" },
          ].map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + (idx * 0.1), type: "spring" }}
              className="flex items-center gap-4 neo-card bg-[var(--color-cream)] p-4 max-w-sm hover:translate-x-2 transition-transform"
            >
              <div className="p-2 bg-[var(--color-orange)] neo-border rounded-md">
                <feature.icon className="text-[#1a1a1a] text-xl" />
              </div>
              <span className="font-bold text-[#1a1a1a]">{feature.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-20 bg-[var(--color-cream)] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md my-auto"
        >
          <div className="md:hidden text-center mb-10 mt-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[var(--color-orange)] neo-border neo-shadow-lg mb-4"
            >
              <TbFlask className="text-white text-3xl" />
            </motion.div>
            <h1 className="font-heading text-4xl font-bold text-[#1a1a1a] drop-shadow-[2px_2px_0_var(--color-orange)]">Labkom</h1>
            <p className="text-[#1a1a1a] font-medium mt-2 bg-white inline-block px-3 py-1 neo-border-sm rounded-md shadow-[2px_2px_0_#1a1a1a]">Sistem Manajemen Laboratorium</p>
          </div>

          <div className="neo-card p-6 sm:p-8 bg-white relative">
            <div className="absolute -top-4 -right-4 w-12 h-12 bg-[var(--color-steel-blue)] rounded-full neo-border hidden sm:block" />
            <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-[var(--color-orange)] rounded-none rotate-12 neo-border hidden sm:block" />

            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-2">
              Buat Akun 🚀
            </h2>
            <p className="text-[#5a5a5a] mb-6 font-medium">Lengkapi data di bawah untuk mendaftar.</p>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                  className="mb-6 p-4 bg-[#ffcdd2] neo-border rounded-lg flex items-start gap-3 origin-top"
                  style={{ transformOrigin: "top center" }}
                  key={error}
                  onAnimationComplete={() => {}}
                >
                  <motion.div
                     animate={{ x: [-5, 5, -5, 5, 0] }}
                     transition={{ duration: 0.4 }}
                  >
                    <TbAlertCircle className="text-red-600 text-xl mt-0.5 shrink-0" />
                  </motion.div>
                  <p className="text-sm text-red-800 font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5 group">
                <label className="block text-sm font-bold text-[#1a1a1a]">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5a5a5a] group-focus-within:text-[var(--color-steel-blue)] transition-colors">
                    <TbUser className="text-xl" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Masukkan nama lengkap"
                    required
                    className="w-full pl-11 pr-4 py-2.5 neo-input focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 group">
                  <label className="block text-sm font-bold text-[#1a1a1a]">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5a5a5a] group-focus-within:text-[var(--color-steel-blue)] transition-colors">
                      <TbMail className="text-xl" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="nama@email.com"
                      required
                      className="w-full pl-11 pr-4 py-2.5 neo-input focus:outline-none text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 group">
                  <label className="block text-sm font-bold text-[#1a1a1a]">
                    NIM
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5a5a5a] group-focus-within:text-[var(--color-steel-blue)] transition-colors">
                      <TbIdBadge className="text-xl" />
                    </div>
                    <input
                      type="text"
                      name="nim"
                      value={formData.nim}
                      onChange={handleChange}
                      placeholder="NIM Mahasiswa"
                      className="w-full pl-11 pr-4 py-2.5 neo-input focus:outline-none text-sm transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 group">
                <label className="block text-sm font-bold text-[#1a1a1a]">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5a5a5a] group-focus-within:text-[var(--color-steel-blue)] transition-colors">
                    <TbLock className="text-xl" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimal 6 karakter"
                    required
                    className="w-full pl-11 pr-12 py-2.5 neo-input focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#5a5a5a] hover:text-[var(--color-orange)] transition-colors focus:outline-none"
                  >
                    {showPassword ? <TbEyeOff className="text-xl" /> : <TbEye className="text-xl" />}
                  </button>
                </div>
                
                {formData.password && (
                  <div className="pt-1">
                    <div className="flex gap-1 h-1.5 w-full bg-[var(--color-cream)] rounded-full overflow-hidden neo-border-sm mb-1">
                      {[1, 2, 3, 4].map((index) => (
                        <div 
                          key={index} 
                          className={`h-full flex-1 transition-colors duration-300 ${strength >= index ? getStrengthColor() : "bg-transparent"}`} 
                        />
                      ))}
                    </div>
                    <p className="text-xs font-bold text-right" style={{ color: strength >= 3 ? "#22c55e" : strength === 2 ? "#eab308" : "#ef4444" }}>
                      {getStrengthText()}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 group">
                <label className="block text-sm font-bold text-[#1a1a1a]">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5a5a5a] group-focus-within:text-[var(--color-steel-blue)] transition-colors">
                    <TbLock className="text-xl" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Ulangi password"
                    required
                    className="w-full pl-11 pr-12 py-2.5 neo-input focus:outline-none text-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#5a5a5a] hover:text-[var(--color-orange)] transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <TbEyeOff className="text-xl" /> : <TbEye className="text-xl" />}
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={!isLoading ? { scale: 1.02, y: -2, boxShadow: "5px 5px 0px #1a1a1a" } : {}}
                  whileTap={!isLoading ? { scale: 0.98, y: 0, boxShadow: "1px 1px 0px #1a1a1a" } : {}}
                  className="w-full py-3.5 bg-[var(--color-steel-blue)] text-white neo-btn flex items-center justify-center gap-2 disabled:opacity-70 disabled:bg-[#d4c4b5] disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <>
                      <TbLoader2 className="animate-spin text-xl" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Daftar Sekarang</span>
                  )}
                </motion.button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t-2 border-dashed border-[#1a1a1a] text-center">
              <p className="text-sm font-medium text-[#5a5a5a]">
                Sudah punya akun?{" "}
                <Link
                  href="/login"
                  className="font-bold text-[var(--color-orange)] hover:text-[var(--color-steel-blue)] hover:underline underline-offset-4 transition-colors inline-block neo-hover px-2 py-1 rounded bg-[var(--color-cream)] neo-border-sm"
                >
                  Masuk ke Sistem
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
