"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TbTarget, TbTrophy, TbClipboardList, TbUsers, TbChecklist, TbCheck, TbX, TbPlus, TbClock, TbInbox, TbUpload, TbSend } from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { PhotoUpload } from "@/components/ui/photo-upload";

type MissionStatus = "OPEN" | "TAKEN" | "SUBMITTED" | "APPROVED" | "REJECTED";

interface MissionItem {
  id: string;
  title: string;
  description: string;
  points: number;
  status: MissionStatus;
  deadline?: string;
  claimedBy?: string;
  claimId?: string;
}

interface MyMissionClaim {
  id: string;
  status: string;
  proof?: string;
  mission: {
    id: string;
    title: string;
    description: string;
    points: number;
    deadline?: string;
    status: MissionStatus;
  };
}

const statusConfig: Record<MissionStatus, { label: string; color: string }> = {
  OPEN: { label: "Tersedia", color: "bg-green-500 text-white neo-border-sm" },
  TAKEN: { label: "Diklaim", color: "bg-blue-500 text-white neo-border-sm" },
  SUBMITTED: { label: "Disubmit", color: "bg-yellow-500 text-white neo-border-sm" },
  APPROVED: { label: "Disetujui", color: "bg-[#4b607f] text-white neo-border-sm" },
  REJECTED: { label: "Ditolak", color: "bg-red-500 text-white neo-border-sm" },
};

interface MissionStats {
  total: number;
  open: number;
  taken: number;
  submitted: number;
  approved: number;
  rejected: number;
}

interface LeaderboardEntry {
  id?: string;
  name?: string;
  userName?: string;
  points?: number;
  totalPoints?: number;
  avatar?: string;
}

const INITIAL_STATS: MissionStats = {
  total: 0,
  open: 0,
  taken: 0,
  submitted: 0,
  approved: 0,
  rejected: 0,
};

export default function MissionsPage() {
  const toast = useToast();
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<MissionStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"missions" | "leaderboard" | "my">("missions");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<MyMissionClaim | null>(null);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [proofNote, setProofNote] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);
  const [myClaims, setMyClaims] = useState<MyMissionClaim[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    points: "",
    deadline: "",
  });

  const fetchStats = async () => {
    try {
      const res = await api.get<{ data: MissionStats }>("/missions/stats");
      setStats(res.data ?? INITIAL_STATS);
    } catch {
      setStats(INITIAL_STATS);
    }
  };

  const fetchMissions = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { items?: MissionItem[] } | MissionItem[] }>("/missions");
      const result = res.data ?? [];
      const items = Array.isArray(result) ? result : (result.items ?? []);
      setMissions(items as MissionItem[]);
    } catch (err: unknown) {
      setMissions([]);
      toast.error((err as { message?: string })?.message || "Gagal memuat misi");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get<{ data: LeaderboardEntry[] }>("/missions/leaderboard");
      setLeaderboard(res.data ?? []);
    } catch {
      setLeaderboard([]);
    }
  };

  const fetchMyClaims = async () => {
    try {
      const res = await api.get<{ data: MyMissionClaim[] }>("/missions/my");
      setMyClaims(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMyClaims([]);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchMissions(), fetchLeaderboard(), fetchStats(), fetchMyClaims()]);
  };

  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      if (!mounted) return;
      await Promise.all([fetchMissions(), fetchLeaderboard(), fetchStats(), fetchMyClaims()]);
    };
    initData();
    return () => { mounted = false; };
  }, []);

  const handleCreateMission = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmittingCreate(true);

    try {
      await api.post<{ data: MissionItem }>("/missions", {
        title: form.title,
        description: form.description,
        points: Number(form.points),
        deadline: form.deadline || undefined,
      });

      setShowCreateModal(false);
      setForm({
        title: "",
        description: "",
        points: "",
        deadline: "",
      });
      await refreshAll();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Gagal membuat misi");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleClaimMission = async (missionId: string) => {
    setClaimingId(missionId);
    try {
      await api.patch<{ data: MissionItem }>(`/missions/${missionId}/claim`, {});
      await refreshAll();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Gagal klaim misi");
    } finally {
      setClaimingId(null);
    }
  };

  const openSubmitProof = (claim: MyMissionClaim) => {
    setSelectedClaim(claim);
    setProofPhotos([]);
    setProofNote("");
    setShowSubmitModal(true);
  };

  const handleSubmitProof = async () => {
    if (!selectedClaim) return;
    if (proofPhotos.length === 0 && !proofNote.trim()) {
      toast.error("Upload foto bukti atau tulis catatan");
      return;
    }
    setSubmittingProof(true);
    try {
      const proof = [
        ...proofPhotos,
        ...(proofNote.trim() ? [`Catatan: ${proofNote.trim()}`] : []),
      ].join("\n");
      await api.patch(`/missions/claims/${selectedClaim.id}/submit`, { proof });
      toast.success("Bukti misi berhasil disubmit!");
      setShowSubmitModal(false);
      setSelectedClaim(null);
      await refreshAll();
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || "Gagal submit bukti");
    } finally {
      setSubmittingProof(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white neo-border shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-center">
            <TbTarget size={24} className="text-[#f3701e]" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-[#1a1a1a]">Mission System</h1>
            <p className="text-[#5a5a5a] font-medium mt-1">Kerjakan misi, kumpulkan poin!</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-[#f3701e] text-white neo-btn flex items-center gap-2 font-bold"
        >
          <TbPlus size={20} strokeWidth={2.2} />
          Buat Misi
        </motion.button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <motion.div whileHover={{ y: -4 }} className="neo-card p-5 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white mb-1">
            <TbClipboardList size={20} strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-[#1a1a1a]">{stats.total}</p>
          <p className="text-sm font-bold text-[#5a5a5a]">Total</p>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="neo-card p-5 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-1 neo-border-sm">
            <TbInbox size={20} strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-green-600">{stats.open}</p>
          <p className="text-sm font-bold text-[#5a5a5a]">Open</p>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="neo-card p-5 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1 neo-border-sm">
            <TbUsers size={20} strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-blue-600">{stats.taken}</p>
          <p className="text-sm font-bold text-[#5a5a5a]">Taken</p>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="neo-card p-5 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 mb-1 neo-border-sm">
            <TbChecklist size={20} strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-yellow-600">{stats.submitted}</p>
          <p className="text-sm font-bold text-[#5a5a5a]">Submitted</p>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="neo-card p-5 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#4b607f]/10 flex items-center justify-center text-[#4b607f] mb-1 neo-border-sm">
            <TbCheck size={20} strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-[#4b607f]">{stats.approved}</p>
          <p className="text-sm font-bold text-[#5a5a5a]">Approved</p>
        </motion.div>
        
        <motion.div whileHover={{ y: -4 }} className="neo-card p-5 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-1 neo-border-sm">
            <TbX size={20} strokeWidth={2.2} />
          </div>
          <p className="text-3xl font-heading font-bold text-red-600">{stats.rejected}</p>
          <p className="text-sm font-bold text-[#5a5a5a]">Rejected</p>
        </motion.div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setTab("missions")}
          className={`px-6 py-3 font-bold text-sm transition-all flex items-center gap-2 ${
            tab === "missions" ? "bg-[#4b607f] text-white neo-btn" : "bg-white text-[#1a1a1a] neo-btn border-2 border-transparent hover:border-[#1a1a1a]"
          }`}
        >
          <TbTarget size={18} strokeWidth={2.2} />
          Misi Aktif
        </button>
        <button
          onClick={() => setTab("my")}
          className={`px-6 py-3 font-bold text-sm transition-all flex items-center gap-2 ${
            tab === "my" ? "bg-[#4b607f] text-white neo-btn" : "bg-white text-[#1a1a1a] neo-btn border-2 border-transparent hover:border-[#1a1a1a]"
          }`}
        >
          <TbClipboardList size={18} strokeWidth={2.2} />
          Misi Saya
          {myClaims.filter((c) => c.status === "TAKEN").length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-[#f3701e] text-white rounded-full font-bold">
              {myClaims.filter((c) => c.status === "TAKEN").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("leaderboard")}
          className={`px-6 py-3 font-bold text-sm transition-all flex items-center gap-2 ${
            tab === "leaderboard" ? "bg-[#4b607f] text-white neo-btn" : "bg-white text-[#1a1a1a] neo-btn border-2 border-transparent hover:border-[#1a1a1a]"
          }`}
        >
          <TbTrophy size={18} strokeWidth={2.2} />
          Leaderboard
        </button>
      </div>

      {tab === "missions" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="md:col-span-2 lg:col-span-3 neo-card p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-[#1a1a1a] border-t-[#f3701e] rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-[#1a1a1a]">Memuat misi...</p>
            </div>
          ) : missions.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 neo-card p-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-[#f3701e]/10 flex items-center justify-center text-[#f3701e] mb-2 neo-border">
                <TbTarget size={32} strokeWidth={2.2} />
              </div>
              <h3 className="font-heading text-xl font-bold text-[#1a1a1a]">Belum Ada Misi</h3>
              <p className="text-[#5a5a5a] max-w-md">Jadilah yang pertama membuat misi untuk tim Anda. Tambahkan tugas dan berikan poin sebagai reward!</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-6 py-3 bg-[#1a1a1a] text-white neo-btn font-bold"
              >
                Buat Misi Sekarang
              </motion.button>
            </div>
          ) : (
            missions.map((mission, i) => (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="neo-card neo-card-hover relative overflow-hidden flex flex-col"
              >
                <div className={`h-1.5 w-full absolute top-0 left-0 ${statusConfig[mission.status]?.color.split(' ')[0] || "bg-gray-300"}`}></div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3 className="font-heading font-bold text-lg text-[#1a1a1a] leading-tight line-clamp-2">{mission.title}</h3>
                    <span className={`neo-badge px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${statusConfig[mission.status]?.color || "bg-gray-300 text-black neo-border-sm"}`}>
                      {statusConfig[mission.status]?.label || mission.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#5a5a5a] mb-6 flex-1 line-clamp-3">{mission.description}</p>
                  
                  <div className="mt-auto space-y-4">
                    <div className="flex items-center gap-4 text-xs font-bold text-[#5a5a5a]">
                      <div className="flex items-center gap-1.5">
                        <TbClock size={16} strokeWidth={2.2} className="text-[#1a1a1a]" />
                        {mission.deadline ? new Date(mission.deadline).toLocaleDateString("id-ID") : "Tanpa batas"}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t-2 border-[#1a1a1a]/10">
                      <div className="flex items-center gap-2 bg-[#f3701e] text-white px-3 py-1.5 rounded-lg neo-border-sm">
                        <TbTrophy size={16} strokeWidth={2.2} />
                        <span className="font-bold">{mission.points} Poin</span>
                      </div>
                      
                      {mission.status === "OPEN" && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleClaimMission(mission.id)}
                          disabled={claimingId === mission.id}
                          className="px-4 py-2 bg-[#4b607f] text-white neo-btn text-sm font-bold disabled:opacity-50"
                        >
                          {claimingId === mission.id ? "Memproses..." : "Klaim"}
                        </motion.button>
                      )}
                    </div>
                    
                    {mission.claimedBy && (
                      <div className="flex items-center gap-2 mt-2 bg-gray-50 p-2 rounded-lg neo-border-sm">
                        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-[10px] font-bold">
                          {mission.claimedBy.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-xs font-bold text-[#1a1a1a]">Dikerjakan oleh: <span className="text-[#4b607f]">{mission.claimedBy}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === "my" && (
        <div className="space-y-4">
          {myClaims.length === 0 ? (
            <div className="neo-card p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2 neo-border">
                <TbClipboardList size={32} strokeWidth={2.2} />
              </div>
              <h3 className="font-heading text-xl font-bold text-[#1a1a1a]">Belum Ada Misi</h3>
              <p className="text-[#5a5a5a] max-w-md">Klaim misi dari tab &quot;Misi Aktif&quot; untuk mulai mengerjakan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myClaims.map((claim) => (
                <motion.div
                  key={claim.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="neo-card relative overflow-hidden"
                >
                  <div className={`h-1.5 w-full absolute top-0 left-0 ${
                    claim.status === "TAKEN" ? "bg-blue-500" :
                    claim.status === "SUBMITTED" ? "bg-yellow-500" :
                    claim.status === "APPROVED" ? "bg-green-500" :
                    claim.status === "REJECTED" ? "bg-red-500" : "bg-gray-300"
                  }`}></div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <h3 className="font-heading font-bold text-lg text-[#1a1a1a] leading-tight">{claim.mission.title}</h3>
                      <span className={`neo-badge px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${
                        claim.status === "TAKEN" ? "bg-blue-500 text-white neo-border-sm" :
                        claim.status === "SUBMITTED" ? "bg-yellow-500 text-white neo-border-sm" :
                        claim.status === "APPROVED" ? "bg-green-500 text-white neo-border-sm" :
                        claim.status === "REJECTED" ? "bg-red-500 text-white neo-border-sm" : "bg-gray-300 text-black neo-border-sm"
                      }`}>
                        {claim.status === "TAKEN" ? "Dikerjakan" :
                         claim.status === "SUBMITTED" ? "Disubmit" :
                         claim.status === "APPROVED" ? "Disetujui" :
                         claim.status === "REJECTED" ? "Ditolak" : claim.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#5a5a5a] mb-4 line-clamp-2">{claim.mission.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-[#f3701e] text-white px-3 py-1.5 rounded-lg neo-border-sm">
                        <TbTrophy size={14} strokeWidth={2.2} />
                        <span className="font-bold text-sm">{claim.mission.points} Poin</span>
                      </div>
                      {claim.status === "TAKEN" && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openSubmitProof(claim)}
                          className="px-4 py-2 bg-[#f3701e] text-white neo-btn text-sm font-bold flex items-center gap-2"
                        >
                          <TbUpload size={16} strokeWidth={2.2} />
                          Submit Bukti
                        </motion.button>
                      )}
                    </div>
                    {claim.proof && (
                      <div className="mt-3 p-2 bg-gray-50 rounded-lg neo-border-sm">
                        <p className="text-xs font-bold text-[#5a5a5a] mb-1">Bukti:</p>
                        <p className="text-xs text-[#1a1a1a] whitespace-pre-wrap break-all">{claim.proof}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="neo-card p-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-[#1a1a1a]">
            <div className="w-10 h-10 rounded-xl bg-[#f3701e] flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a]">
              <TbTrophy size={24} className="text-white" strokeWidth={2.2} />
            </div>
            <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Top Achievers</h2>
          </div>
          <div className="space-y-4">
            {leaderboard.map((user, i) => (
              <motion.div
                key={user.id || user.name || user.userName || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center justify-between p-4 bg-white neo-border shadow-[4px_4px_0px_#1a1a1a] ${
                  i === 0 ? "border-[#f3701e] ring-2 ring-[#f3701e]/20" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 flex flex-col items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a] ${
                    i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-white"
                  }`}>
                    <span className="font-heading font-bold text-lg text-[#1a1a1a] leading-none">{i + 1}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#4b607f] flex items-center justify-center text-white text-sm font-bold neo-border-sm">
                      {(user.avatar || user.name || user.userName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-lg text-[#1a1a1a] leading-tight">{user.name || user.userName || "Unknown User"}</p>
                      {i === 0 && <p className="text-xs font-bold text-[#f3701e]">🌟 Top Performer</p>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="px-4 py-2 bg-[#1a1a1a] text-white font-heading font-bold text-lg neo-border shadow-[2px_2px_0px_#f3701e]">
                    {user.points ?? user.totalPoints ?? 0}
                  </span>
                  <span className="text-[10px] font-bold text-[#5a5a5a] uppercase tracking-wider mt-1">Total Points</span>
                </div>
              </motion.div>
            ))}
            {leaderboard.length === 0 && (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2 neo-border">
                  <TbUsers size={32} strokeWidth={2.2} />
                </div>
                <h3 className="font-heading text-xl font-bold text-[#1a1a1a]">Belum Ada Data</h3>
                <p className="text-[#5a5a5a] max-w-md">Klaim dan selesaikan misi untuk mulai mengumpulkan poin dan puncaki leaderboard!</p>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border-4 border-[#1a1a1a] rounded-xl shadow-[8px_8px_0px_#1a1a1a] p-8 w-full max-w-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-3 bg-[#f3701e] border-b-4 border-[#1a1a1a]"></div>
              
              <div className="flex items-center gap-3 mb-6 mt-2">
                <div className="w-12 h-12 rounded-xl bg-[#4b607f] flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a]">
                  <TbTarget size={24} className="text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-[#1a1a1a] leading-none">Buat Misi Baru</h2>
                  <p className="text-sm font-bold text-[#5a5a5a] mt-1">Tambahkan tantangan untuk tim</p>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleCreateMission}>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-2 uppercase tracking-wide">Judul Misi</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Bersihkan Server Rack"
                    className="w-full px-4 py-3 neo-input focus:outline-none text-base font-medium placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-2 uppercase tracking-wide">Deskripsi</label>
                  <textarea
                    rows={4}
                    required
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Detail instruksi misi yang harus dilakukan..."
                    className="w-full px-4 py-3 neo-input focus:outline-none text-base font-medium resize-none placeholder:text-gray-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-2 uppercase tracking-wide">Reward Poin</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <TbTrophy size={18} className="text-[#f3701e]" strokeWidth={2.2} />
                      </div>
                      <input
                        type="number"
                        min={1}
                        required
                        value={form.points}
                        onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))}
                        placeholder="100"
                        className="w-full pl-11 pr-4 py-3 neo-input focus:outline-none text-base font-bold text-[#f3701e]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1a1a1a] mb-2 uppercase tracking-wide">Batas Waktu</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <TbClock size={18} className="text-[#1a1a1a]" strokeWidth={2.2} />
                      </div>
                      <input
                        type="date"
                        value={form.deadline}
                        onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
                        className="w-full pl-11 pr-4 py-3 neo-input focus:outline-none text-base font-medium"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t-2 border-[#1a1a1a]/10">
                  <motion.button 
                    type="submit" 
                    disabled={submittingCreate} 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    className="flex-1 py-4 bg-[#f3701e] text-white neo-btn disabled:opacity-50 text-lg font-bold flex justify-center items-center gap-2"
                  >
                    {submittingCreate ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <TbCheck size={24} strokeWidth={2.2} />
                    )}
                    {submittingCreate ? "Menyimpan..." : "Buat Misi"}
                  </motion.button>
                  <motion.button 
                    type="button" 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    onClick={() => setShowCreateModal(false)} 
                    className="px-6 py-4 bg-white text-[#1a1a1a] neo-btn text-lg font-bold"
                  >
                    Batal
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSubmitModal && selectedClaim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSubmitModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border-4 border-[#1a1a1a] rounded-xl shadow-[8px_8px_0px_#1a1a1a] p-8 w-full max-w-lg relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-3 bg-[#4b607f] border-b-4 border-[#1a1a1a]"></div>

              <div className="flex items-center gap-3 mb-6 mt-2">
                <div className="w-12 h-12 rounded-xl bg-[#f3701e] flex items-center justify-center neo-border shadow-[2px_2px_0px_#1a1a1a]">
                  <TbSend size={24} className="text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-[#1a1a1a] leading-none">Submit Bukti</h2>
                  <p className="text-sm font-bold text-[#5a5a5a] mt-1">{selectedClaim.mission.title}</p>
                </div>
              </div>

              <div className="space-y-5">
                <PhotoUpload
                  value={proofPhotos}
                  onChange={setProofPhotos}
                  category="evidence"
                  maxFiles={5}
                  label="Foto Bukti Pengerjaan"
                />

                <div>
                  <label className="block text-sm font-bold text-[#1a1a1a] mb-2 uppercase tracking-wide">Catatan (opsional)</label>
                  <textarea
                    rows={3}
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder="Jelaskan apa yang sudah dikerjakan..."
                    className="w-full px-4 py-3 neo-input focus:outline-none text-base font-medium resize-none placeholder:text-gray-400"
                  />
                </div>

                <div className="flex gap-4 pt-4 border-t-2 border-[#1a1a1a]/10">
                  <motion.button
                    type="button"
                    onClick={handleSubmitProof}
                    disabled={submittingProof || (proofPhotos.length === 0 && !proofNote.trim())}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-4 bg-[#f3701e] text-white neo-btn disabled:opacity-50 text-lg font-bold flex justify-center items-center gap-2"
                  >
                    {submittingProof ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <TbSend size={24} strokeWidth={2.2} />
                    )}
                    {submittingProof ? "Mengirim..." : "Submit Bukti"}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowSubmitModal(false)}
                    className="px-6 py-4 bg-white text-[#1a1a1a] neo-btn text-lg font-bold"
                  >
                    Batal
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
