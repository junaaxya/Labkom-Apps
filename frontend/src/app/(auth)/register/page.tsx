"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TbAlertCircle, TbCalendarClock, TbChecklist, TbFileDescription, TbFlask, TbIdBadge, TbLoader2, TbMail, TbMapPin, TbPhone, TbSearch, TbSend, TbUser, TbUsers } from "react-icons/tb";
import type { AccessRequest, AccessRequestType } from "@/types";

type PublicLab = { id: string; name: string; location: string };

type RequestFormState = {
  type: AccessRequestType;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  institution: string;
  title: string;
  description: string;
  purpose: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: string;
  requestedRole: "MAGANG" | "";
  labId: string;
};

const initialForm: RequestFormState = {
  type: "PEMINJAMAN_LAB",
  applicantName: "",
  applicantEmail: "",
  applicantPhone: "",
  institution: "",
  title: "",
  description: "",
  purpose: "",
  date: "",
  startTime: "",
  endTime: "",
  participants: "1",
  requestedRole: "",
  labId: "",
};

export default function RegisterPage() {
  const [formData, setFormData] = useState<RequestFormState>(initialForm);
  const [requestCode, setRequestCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState("");
  const [checkedRequest, setCheckedRequest] = useState<AccessRequest | null>(null);
  const [labs, setLabs] = useState<PublicLab[]>([]);

  useEffect(() => {
    void fetch(`${process.env.NEXT_PUBLIC_API_URL}/access-requests/labs`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLabs(data.data ?? []);
      })
      .catch(() => setLabs([]));
  }, []);

  const typeLabel = useMemo(() => {
    return formData.type === "PEMINJAMAN_LAB"
      ? "Peminjaman Lab"
      : formData.type === "MAGANG"
        ? "Pengajuan Magang"
        : "Akses Tamu Sementara";
  }, [formData.type]);

  const approvalOutcomeText = useMemo(() => {
    if (formData.type === "PEMINJAMAN_LAB") {
      return "Jika disetujui, pengajuan akan masuk ke jadwal peminjaman lab dan Anda bisa mengikuti instruksi lanjutan dari Aslab atau Koordinator.";
    }

    if (formData.type === "MAGANG") {
      return "Jika disetujui, admin/koordinator akan menindaklanjuti proses akun atau akses magang sesuai kebutuhan operasional.";
    }

    return "Jika disetujui, Anda akan mendapat akses sementara yang terbatas untuk kebutuhan tamu, kegiatan khusus, atau akses singkat lainnya.";
  }, [formData.type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "type") {
        if (value === "MAGANG") {
          next.requestedRole = "MAGANG";
          next.labId = "";
          next.date = "";
          next.startTime = "";
          next.endTime = "";
          next.participants = "1";
        }
        if (value === "AKSES_SEMENTARA") {
          next.requestedRole = "";
          next.labId = "";
        }
        if (value === "PEMINJAMAN_LAB") {
          next.requestedRole = "";
        }
      }
      return next;
    });
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccessCode("");

    try {
      const payload = {
        ...formData,
        participants: formData.type === "PEMINJAMAN_LAB" ? Number(formData.participants) : undefined,
        requestedRole: formData.type === "MAGANG" ? "MAGANG" : undefined,
        labId: formData.type === "PEMINJAMAN_LAB" ? formData.labId : undefined,
        date: formData.type === "PEMINJAMAN_LAB" ? formData.date : undefined,
        startTime: formData.type === "PEMINJAMAN_LAB" ? formData.startTime : undefined,
        endTime: formData.type === "PEMINJAMAN_LAB" ? formData.endTime : undefined,
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/access-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Pengajuan gagal dikirim");
        setIsLoading(false);
        return;
      }

      setSuccessCode(data.data.requestCode);
      setFormData(initialForm);
      setRequestCode(data.data.requestCode);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!requestCode.trim()) {
      setError("Kode pengajuan wajib diisi");
      return;
    }

    setIsChecking(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/access-requests/check/${requestCode.trim().toUpperCase()}`);
      const data = await res.json();

      if (!data.success) {
        setCheckedRequest(null);
        setError(data.message || "Pengajuan tidak ditemukan");
        return;
      }

      setCheckedRequest(data.data);
    } catch {
      setError("Gagal memeriksa status pengajuan");
    } finally {
      setIsChecking(false);
    }
  };

  const statusBadge = checkedRequest?.status === "APPROVED"
    ? "bg-green-500 text-white"
    : checkedRequest?.status === "REJECTED"
      ? "bg-red-500 text-white"
      : checkedRequest?.status === "REVISION"
        ? "bg-yellow-400 text-[#1a1a1a]"
        : "bg-[#4b607f] text-white";

  const approvedStatusHint = checkedRequest?.status === "APPROVED"
    ? checkedRequest.type === "PEMINJAMAN_LAB"
      ? "Pengajuan sudah disetujui. Tim lab akan menindaklanjuti jadwal peminjaman Anda."
      : checkedRequest.type === "MAGANG"
        ? `Pengajuan disetujui. Silakan login memakai email pengajuan Anda dan password awal = kode pengajuan (${checkedRequest.requestCode}). Setelah berhasil masuk, segera ganti password.`
        : `Pengajuan disetujui. Silakan login memakai email pengajuan Anda dan password awal = kode pengajuan (${checkedRequest.requestCode}). Akses ini bersifat sementara dan terbatas.`
    : "";

  return (
    <div className="min-h-screen bg-[var(--color-cream)] flex flex-col md:flex-row overflow-hidden">
      <div className="hidden md:flex md:w-1/2 bg-[var(--color-steel-blue)] p-12 relative flex-col justify-between neo-border-r border-[#1a1a1a] border-r-4 z-10 overflow-hidden">
        <div className="absolute top-10 right-10 w-32 h-32 bg-[var(--color-orange)] rounded-full neo-border neo-shadow-lg opacity-90" />
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-[var(--color-cream)] rotate-12 neo-border neo-shadow-lg" />
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-[#22c55e] rotate-45 neo-border neo-shadow" />
        <div className="relative z-20">
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 100, damping: 15 }} className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-[var(--color-orange)] neo-border neo-shadow-lg mb-8">
            <TbFlask className="text-white text-4xl" />
          </motion.div>
          <motion.h1 initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2, type: "spring" }} className="font-heading text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-[4px_4px_0_rgba(26,26,26,1)]">Labkom<br />Management</motion.h1>
          <motion.p initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3, type: "spring" }} className="text-xl text-[var(--color-cream)] font-medium max-w-md neo-border-sm bg-[#1a1a1a] p-4 rounded-lg shadow-[4px_4px_0_var(--color-orange)]">Akun internal dibuat admin. Pengguna luar mengajukan akses dulu dari sini.</motion.p>
        </div>
        <div className="relative z-20 space-y-6 mt-12">
          {[
            { icon: TbChecklist, text: "Ajukan peminjaman lab" },
            { icon: TbUsers, text: "Ajukan akses magang" },
            { icon: TbSearch, text: "Cek status pengajuan" },
          ].map((feature, idx) => (
            <motion.div key={idx} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 + (idx * 0.1), type: "spring" }} className="flex items-center gap-4 neo-card bg-[var(--color-cream)] p-4 max-w-sm hover:translate-x-2 transition-transform">
              <div className="p-2 bg-[var(--color-orange)] neo-border rounded-md"><feature.icon className="text-[#1a1a1a] text-xl" /></div>
              <span className="font-bold text-[#1a1a1a]">{feature.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-20 bg-[var(--color-cream)] overflow-y-auto">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full max-w-2xl my-auto space-y-6">
          <div className="neo-card p-6 sm:p-8 bg-white relative">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] mb-2">Ajukan Akses / Peminjaman</h2>
            <p className="text-[#5a5a5a] mb-6 font-medium">Pilih jenis pengajuan, kirim detail, lalu tunggu review dari Aslab atau Koordinator Lab.</p>

            <AnimatePresence mode="wait">
              {error && <motion.div initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }} className="mb-6 p-4 bg-[#ffcdd2] neo-border rounded-lg flex items-start gap-3 origin-top"><TbAlertCircle className="text-red-600 text-xl mt-0.5 shrink-0" /><p className="text-sm text-red-800 font-bold">{error}</p></motion.div>}
            </AnimatePresence>

            {successCode && <div className="mb-6 rounded-lg bg-green-100 p-4 neo-border"><p className="text-sm font-bold text-green-800">Pengajuan terkirim. Kode Anda: <span className="font-heading">{successCode}</span></p></div>}

            <form onSubmit={submitRequest} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Jenis Pengajuan</span><select name="type" value={formData.type} onChange={handleChange} className="w-full px-4 py-3 min-h-[44px] neo-input"><option value="PEMINJAMAN_LAB">Peminjaman Lab</option><option value="MAGANG">Pengajuan Magang</option><option value="AKSES_SEMENTARA">Akses Tamu Sementara</option></select>{formData.type === "AKSES_SEMENTARA" && <p className="text-xs font-medium text-[#5a5a5a]">Untuk tamu, kegiatan khusus, workshop, kunjungan, atau akses singkat non-user tetap.</p>}</label>
                <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Nama Lengkap</span><div className="relative"><TbUser className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><input name="applicantName" value={formData.applicantName} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input" /></div></label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Email</span><div className="relative"><TbMail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><input type="email" name="applicantEmail" value={formData.applicantEmail} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input" /></div></label>
                <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">WhatsApp</span><div className="relative"><TbPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><input name="applicantPhone" value={formData.applicantPhone} onChange={handleChange} className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input" /></div></label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Institusi</span><input name="institution" value={formData.institution} onChange={handleChange} className="w-full px-4 py-3 min-h-[44px] neo-input" /></label>
                <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Judul</span><div className="relative"><TbFileDescription className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><input name="title" value={formData.title} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input" /></div></label>
              </div>

              {formData.type === "PEMINJAMAN_LAB" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Pilih Lab</span><div className="relative"><TbMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><select name="labId" value={formData.labId} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input"><option value="">— Pilih Lab —</option>{labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name} - {lab.location}</option>)}</select></div></label><label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Jumlah Peserta</span><div className="relative"><TbUsers className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><input type="number" min={1} name="participants" value={formData.participants} onChange={handleChange} required className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input" /></div></label></div>}

              {formData.type === "PEMINJAMAN_LAB" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Tanggal</span><input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full px-4 py-3 min-h-[44px] neo-input" /></label><label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Jam Mulai</span><input type="time" name="startTime" value={formData.startTime} onChange={handleChange} required className="w-full px-4 py-3 min-h-[44px] neo-input" /></label><label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Jam Selesai</span><input type="time" name="endTime" value={formData.endTime} onChange={handleChange} required className="w-full px-4 py-3 min-h-[44px] neo-input" /></label></div>}

              {formData.type === "MAGANG" && <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Role Diminta</span><div className="relative"><TbIdBadge className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a]" /><input value="MAGANG" disabled className="w-full pl-11 pr-4 py-3 min-h-[44px] neo-input bg-[#f5ede6] text-[#5a5a5a]" /></div></label>}

              <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Tujuan / Keterangan</span><textarea name="purpose" value={formData.purpose} onChange={handleChange} rows={3} className="w-full px-4 py-3 neo-input" placeholder={formData.type === "MAGANG" ? "Ceritakan tujuan magang / divisi / periode" : `Jelaskan kebutuhan ${typeLabel.toLowerCase()}`} /></label>
              <label className="space-y-1.5 block"><span className="block text-sm font-bold text-[#1a1a1a]">Deskripsi Tambahan</span><textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-4 py-3 neo-input" /></label>

              <div className="rounded-lg bg-[#f5ede6] p-4 neo-border-sm"><p className="text-sm font-bold text-[#1a1a1a]">Kalau pengajuan disetujui</p><p className="mt-1 text-sm text-[#5a5a5a]">{approvalOutcomeText}</p></div>

              <button type="submit" disabled={isLoading} className="w-full py-3.5 min-h-[44px] bg-[var(--color-orange)] text-[#1a1a1a] neo-btn flex items-center justify-center gap-2 disabled:opacity-70"><span className="flex items-center gap-2">{isLoading ? <TbLoader2 className="animate-spin text-xl" /> : <TbSend className="text-xl" />}{isLoading ? "Mengirim..." : "Kirim Pengajuan"}</span></button>
            </form>
          </div>

          <div className="neo-card p-6 sm:p-8 bg-white">
            <h3 className="font-heading text-xl font-bold text-[#1a1a1a] mb-2">Lacak Pengajuan Anda</h3>
            <p className="mb-4 text-sm font-medium text-[#5a5a5a]">Sudah pernah mengajukan? Masukkan kode pengajuan untuk melihat apakah pengajuan Anda masih diproses, disetujui, ditolak, atau perlu revisi.</p>
            <div className="flex flex-col sm:flex-row gap-3"><input value={requestCode} onChange={(e) => setRequestCode(e.target.value.toUpperCase())} placeholder="Contoh: BOOK-AB12CD34" className="neo-input flex-1 px-4 py-3 min-h-[44px]" /><button type="button" onClick={() => void checkStatus()} disabled={isChecking} className="neo-btn min-h-[44px] bg-[#4b607f] px-5 py-3 text-white">{isChecking ? "Mengecek..." : "Cek Status"}</button></div>

            {checkedRequest && <div className="mt-4 rounded-lg bg-[#f5ede6] p-4 neo-border"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-[#1a1a1a]">{checkedRequest.title}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge}`}>{checkedRequest.status}</span></div><p className="mt-2 text-sm font-medium text-[#5a5a5a]">Kode: {checkedRequest.requestCode}</p>{approvedStatusHint && <p className="mt-2 text-sm font-bold text-[#1a1a1a]">{approvedStatusHint}</p>}{checkedRequest.reviewerNotes && <p className="mt-2 text-sm text-[#1a1a1a]">Catatan reviewer: {checkedRequest.reviewerNotes}</p>}</div>}
          </div>

          <div className="text-center text-sm font-medium text-[#5a5a5a]">
            Sudah punya akun internal? <Link href="/login" className="font-bold text-[#1a1a1a] underline">Masuk di sini</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
