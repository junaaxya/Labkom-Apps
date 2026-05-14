"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TbLock,
  TbCheck,
  TbLoader2,
  TbInfoCircle,
  TbMail,
  TbPhone,
  TbSchool,
  TbUsers,
  TbShieldCheck,
  TbEye,
  TbEyeOff,
  TbEdit,
  TbId,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { SinglePhotoUpload } from "@/components/ui/photo-upload";
import { toUploadDisplayUrl } from "@/utils/upload-url";

function errMsg(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return fallback;
}

interface ProfileData {
  id: string;
  email: string;
  name: string;
  nim?: string;
  nip?: string;
  role: string;
  semester?: string;
  className?: string;
  isKetuaKelas: boolean;
  avatar?: string;
  phone?: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [semester, setSemester] = useState("");
  const [className, setClassName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get<{ data: ProfileData }>("/auth/profile");
      setProfile(res.data);
      setName(res.data.name || "");
      setPhone(res.data.phone || "");
      setSemester(res.data.semester || "");
      setClassName(res.data.className || "");
      setAvatar(res.data.avatar || "");
      setAvatarLoadFailed(false);
    } catch {
      toast.error("Gagal memuat profil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchProfile();
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setAvatarLoadFailed(false);
    });
  }, [avatar, profile?.avatar]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch<{ data: ProfileData }>("/auth/profile", {
        name,
        phone: phone || undefined,
        semester: semester || undefined,
        className: className || undefined,
        avatar: avatar || undefined,
      });
      setProfile(res.data);
      setAvatar(res.data.avatar || "");
      setAvatarLoadFailed(false);
      localStorage.setItem("user", JSON.stringify(res.data));
      toast.success("Profil berhasil diperbarui");
    } catch (err) {
      toast.error(errMsg(err, "Gagal update profil"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setChangingPassword(true);
    try {
      await api.patch("/auth/change-password", { currentPassword, newPassword });
      toast.success("Password berhasil diubah");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(errMsg(err, "Gagal ubah password"));
    } finally {
      setChangingPassword(false);
    }
  };

  const roleLabels: Record<string, string> = {
    KOORDINATOR_LAB: "Koordinator Lab",
    ASISTEN_LAB: "Asisten Lab",
    MAHASISWA: "Mahasiswa",
  };

  const roleBg: Record<string, string> = {
    KOORDINATOR_LAB: "bg-[#4b607f]",
    ASISTEN_LAB: "bg-[#f3701e]",
    MAHASISWA: "bg-emerald-500",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 min-h-[60vh]">
        <TbLoader2 className="w-12 h-12 animate-spin text-[#4b607f]" />
      </div>
    );
  }

  const initial = (profile?.name || "U").charAt(0).toUpperCase();
  const profileAvatar = (avatar || profile?.avatar || "").trim();
  const avatarUrl = profileAvatar ? toUploadDisplayUrl(profileAvatar) : "";
  const shouldRenderAvatar = Boolean(avatarUrl) && !avatarLoadFailed;

  const infoPills = [
    { icon: TbSchool, label: "Semester", value: profile?.semester || "-", color: "bg-[#4b607f]" },
    { icon: TbUsers, label: "Kelas", value: profile?.className || "-", color: "bg-[#f3701e]" },
    { icon: TbPhone, label: "Telepon", value: profile?.phone || "-", color: "bg-emerald-500" },
    { icon: TbId, label: profile?.nim ? "NIM" : "NIP", value: profile?.nim || profile?.nip || "-", color: "bg-amber-500" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card bg-white overflow-hidden">
        <div className="h-24 bg-[#4b607f] relative">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='white'/%3E%3C/svg%3E\")" }}
          />
          <div className="absolute -bottom-12 left-6 sm:left-8">
            <div className="w-24 h-24 rounded-2xl bg-[#f3701e] border-3 border-[#1a1a1a] shadow-[5px_5px_0px_#1a1a1a] flex items-center justify-center">
              {shouldRenderAvatar ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={`Foto profil ${profile?.name || "User"}`}
                  className="w-full h-full rounded-[14px] object-cover"
                  referrerPolicy="no-referrer"
                  onLoad={() => setAvatarLoadFailed(false)}
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <span className="font-heading text-4xl font-bold text-white">{initial}</span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-16 px-6 sm:px-8 pb-6">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">{profile?.name || "User"}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${roleBg[profile?.role || ""] || "bg-gray-500"}`}>
                <TbShieldCheck size={13} strokeWidth={2.5} />
                {roleLabels[profile?.role || ""] || profile?.role}
              </span>
              {profile?.isKetuaKelas && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-400 text-[#1a1a1a] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
                  <TbUsers size={13} strokeWidth={2.5} />
                  Ketua Kelas
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm text-[#5a5a5a]">
              <span className="inline-flex items-center gap-1.5">
                <TbMail size={15} strokeWidth={2.2} className="text-[#4b607f]" />
                {profile?.email}
              </span>
              {(profile?.nim || profile?.nip) && (
                <span className="inline-flex items-center gap-1.5">
                  <TbId size={15} strokeWidth={2.2} className="text-[#4b607f]" />
                  {profile?.nim || profile?.nip}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t-2 border-dashed border-[#d5c4b5]">
            {infoPills.map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-[#f5ede6] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] hover:-translate-y-0.5 transition-transform duration-200">
                <div className={`w-7 h-7 rounded-lg ${item.color} border-2 border-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a] flex items-center justify-center mb-1.5`}>
                  <item.icon size={13} strokeWidth={2.2} className="text-white" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5a5a5a]">{item.label}</p>
                <p className="font-heading text-lg font-bold text-[#1a1a1a] truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="neo-card bg-white overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-[#f5ede6] border-b-2 border-[#1a1a1a] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4b607f] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-center">
              <TbEdit size={16} strokeWidth={2.2} className="text-white" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-[#1a1a1a]">Edit Profil</h2>
              <p className="text-xs text-[#5a5a5a]">Perbarui informasi pribadi</p>
            </div>
          </div>
            
          <form onSubmit={handleUpdateProfile} className="p-6 flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              <SinglePhotoUpload
                value={avatar}
                onChange={(url) => {
                  setAvatarLoadFailed(false);
                  setAvatar(url);
                  setProfile((current) => (current ? { ...current, avatar: url } : current));
                }}
                category="avatars"
                label="Foto Profil"
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Nama Lengkap</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="neo-input w-full min-h-[44px] bg-white px-4 py-3" placeholder="Masukkan nama lengkap" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">No. Telepon</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" className="neo-input w-full min-h-[44px] bg-white px-4 py-3" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#5a5a5a]">
                  Email <span className="text-[10px] font-normal text-[#9a9a9a]">(tidak bisa diubah)</span>
                </label>
                <input type="email" value={profile?.email || ""} disabled className="neo-input w-full min-h-[44px] bg-[#f5ede6] text-[#5a5a5a] cursor-not-allowed px-4 py-3" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#1a1a1a]">Semester</label>
                  <input type="text" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="Contoh: 4" className="neo-input w-full min-h-[44px] bg-white px-4 py-3" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-[#1a1a1a]">Kelas</label>
                  <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Contoh: TI-4A" className="neo-input w-full min-h-[44px] bg-white px-4 py-3" />
                </div>
              </div>
            </div>
            <div className="mt-6 pt-5 border-t-2 border-dashed border-[#d5c4b5]">
              <motion.button
                type="submit"
                disabled={saving}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-[#4b607f] hover:bg-[#3a4f6a] text-white neo-btn font-bold flex items-center justify-center gap-2 transition-colors duration-200 disabled:opacity-50"
              >
                {saving ? <TbLoader2 size={18} strokeWidth={2.2} className="animate-spin" /> : <TbCheck size={18} strokeWidth={2.2} />}
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </motion.button>
            </div>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="neo-card bg-white overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-[#f5ede6] border-b-2 border-[#1a1a1a] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f3701e] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-center">
              <TbLock size={16} strokeWidth={2.2} className="text-white" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-[#1a1a1a]">Ubah Password</h2>
              <p className="text-xs text-[#5a5a5a]">Jaga keamanan akun</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 flex-1 flex flex-col">
            <div className="p-3 rounded-xl bg-[#fcf8f4] border-2 border-dashed border-[#d5c4b5] mb-5 flex items-start gap-2.5">
              <TbInfoCircle size={16} strokeWidth={2.2} className="text-[#f3701e] shrink-0 mt-0.5" />
              <p className="text-xs text-[#5a5a5a]">Minimal 6 karakter. Gunakan kombinasi huruf dan angka.</p>
            </div>
            <div className="space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Password Saat Ini</label>
                <div className="relative">
                  <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="neo-input w-full min-h-[44px] bg-white px-4 py-3 pr-12" placeholder="Masukkan password saat ini" required />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5a5a5a] hover:text-[#1a1a1a] transition-colors">
                    {showCurrentPassword ? <TbEyeOff size={18} strokeWidth={2.2} /> : <TbEye size={18} strokeWidth={2.2} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Password Baru</label>
                <div className="relative">
                  <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} className="neo-input w-full min-h-[44px] bg-white px-4 py-3 pr-12" placeholder="Minimal 6 karakter" required />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5a5a5a] hover:text-[#1a1a1a] transition-colors">
                    {showNewPassword ? <TbEyeOff size={18} strokeWidth={2.2} /> : <TbEye size={18} strokeWidth={2.2} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Konfirmasi Password Baru</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} className="neo-input w-full min-h-[44px] bg-white px-4 py-3 pr-12" placeholder="Ketik ulang password baru" required />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5a5a5a] hover:text-[#1a1a1a] transition-colors">
                    {showConfirmPassword ? <TbEyeOff size={18} strokeWidth={2.2} /> : <TbEye size={18} strokeWidth={2.2} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 font-medium">Password tidak cocok</p>
                )}
              </div>
            </div>
            <div className="mt-6 pt-5 border-t-2 border-dashed border-[#d5c4b5]">
              <motion.button
                type="submit"
                disabled={changingPassword}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-[#f3701e] hover:bg-[#d95f10] text-white neo-btn font-bold flex items-center justify-center gap-2 transition-colors duration-200 disabled:opacity-50"
              >
                {changingPassword ? <TbLoader2 size={18} strokeWidth={2.2} className="animate-spin" /> : <TbLock size={18} strokeWidth={2.2} />}
                {changingPassword ? "Memproses..." : "Ubah Password"}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
}
