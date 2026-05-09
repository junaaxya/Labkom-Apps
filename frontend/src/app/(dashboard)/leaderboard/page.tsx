"use client";

import { useState, useEffect } from "react";
import { TbTrophy, TbMedal, TbTarget, TbFlame, TbCalendarCheck, TbTicket, TbClipboardList, TbCrown, TbChevronDown, TbX } from "react-icons/tb";
import api from "@/services/api";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  email: string;
  totalPoints: number;
  missionsCompleted: number;
  totalAttendance: number;
  attendanceRate: number;
  dailyTasksCompleted: number;
  ticketsResolved: number;
}

interface OverallStats {
  totalAsistens: number;
  totalMissionsCompleted: number;
  totalPointsAwarded: number;
  totalTicketsResolved: number;
  activeMissions: number;
}

type Period = "all" | "semester" | "monthly" | "weekly";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);

  useEffect(() => {
    fetchLeaderboard();
    fetchStats();
  }, [period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any[] }>(`/leaderboard?period=${period}`);
      setLeaderboard(res.data || []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get<{ data: any }>("/leaderboard/stats");
      setStats(res.data || null);
    } catch {
      setStats(null);
    }
  };

  const fetchUserDetail = async (userId: string) => {
    try {
      const res = await api.get<{ data: any }>(`/leaderboard/user/${userId}`);
      setUserDetail(res.data);
      setSelectedUser(userId);
    } catch {
      setUserDetail(null);
    }
  };

  const periodLabels: Record<Period, string> = {
    all: "Semua Waktu",
    semester: "Semester Ini",
    monthly: "Bulan Ini",
    weekly: "Minggu Ini",
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-50 to-yellow-100 border-[#1a1a1a] shadow-[4px_4px_0px_#eab308]";
    if (rank === 2) return "bg-gradient-to-br from-gray-50 to-gray-100 border-[#1a1a1a] shadow-[4px_4px_0px_#9ca3af]";
    if (rank === 3) return "bg-gradient-to-br from-orange-50 to-[#f3701e]/10 border-[#1a1a1a] shadow-[4px_4px_0px_#f3701e]";
    return "bg-white border-[#1a1a1a] hover:shadow-[4px_4px_0px_#1a1a1a]";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <TbCrown className="w-8 h-8 text-yellow-500 drop-shadow-sm" strokeWidth={2.2} />;
    if (rank === 2) return <TbMedal className="w-8 h-8 text-gray-500 drop-shadow-sm" strokeWidth={2.2} />;
    if (rank === 3) return <TbMedal className="w-8 h-8 text-[#f3701e] drop-shadow-sm" strokeWidth={2.2} />;
    return <span className="font-heading font-bold text-xl text-[#1a1a1a] bg-[#e8d8c9] w-8 h-8 rounded-lg flex items-center justify-center neo-border">#{rank}</span>;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-heading)] text-[#1a1a1a] mb-1 tracking-tight">
            Leaderboard
          </h1>
          <p className="text-[#5a5a5a] text-sm sm:text-base leading-relaxed">Ranking performa asisten laboratorium</p>
        </div>

        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="neo-input pr-10 appearance-none cursor-pointer font-bold text-sm bg-white shadow-[2px_2px_0px_#1a1a1a] focus:shadow-[4px_4px_0px_#f3701e] transition-all"
          >
            {Object.entries(periodLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <TbChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-[#1a1a1a]" strokeWidth={2.5} />
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          {[
            { label: "Total Asleb", value: stats.totalAsistens, icon: TbTarget, color: "text-[#1a1a1a]", bg: "bg-[#e8d8c9]" },
            { label: "Misi Selesai", value: stats.totalMissionsCompleted, icon: TbTrophy, color: "text-green-700", bg: "bg-[#e8f5e9]" },
            { label: "Total Poin", value: stats.totalPointsAwarded, icon: TbFlame, color: "text-[#f3701e]", bg: "bg-orange-100" },
            { label: "Tiket Selesai", value: stats.totalTicketsResolved, icon: TbTicket, color: "text-blue-700", bg: "bg-blue-100" },
            { label: "Misi Aktif", value: stats.activeMissions, icon: TbClipboardList, color: "text-[#4b607f]", bg: "bg-[#4b607f]/10" },
          ].map((stat) => (
            <div key={stat.label} className="neo-card p-5 text-center neo-card-hover transition-all duration-200 bg-white hover:translate-y-[-2px]">
              <div className={`w-12 h-12 mx-auto rounded-full neo-border flex items-center justify-center mb-3 shadow-[2px_2px_0px_#1a1a1a] ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} strokeWidth={2.2} />
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-heading text-[#1a1a1a] leading-none">{stat.value}</p>
              <p className="text-xs sm:text-sm font-bold text-[#5a5a5a] mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="neo-card p-6 animate-pulse bg-white/50">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="neo-card p-12 text-center bg-white/50 border-dashed">
          <TbTrophy className="w-16 h-16 mx-auto text-[#4b607f]/40 mb-4" strokeWidth={1.5} />
          <p className="text-xl font-bold font-heading text-[#1a1a1a] mb-2">Belum ada data leaderboard</p>
          <p className="text-sm font-medium text-[#5a5a5a]">Data akan muncul setelah asisten lab menyelesaikan misi dan tugas harian</p>
        </div>
      ) : (
        <div className="space-y-6">
          {leaderboard.slice(0, 3).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8 pt-4">
              {leaderboard.slice(0, 3).map((entry, idx) => (
                <div
                  key={entry.userId}
                  onClick={() => fetchUserDetail(entry.userId)}
                  className={`neo-card p-6 text-center cursor-pointer transition-all duration-300 hover:-translate-y-2 relative mt-${idx === 0 ? '0' : '4'} ${getRankStyle(entry.rank)}`}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full neo-border flex items-center justify-center shadow-[2px_2px_0px_#1a1a1a]">
                    {getRankIcon(entry.rank)}
                  </div>
                  
                  <div className="w-20 h-20 mx-auto mt-6 rounded-2xl bg-[#4b607f] neo-border flex items-center justify-center text-white text-3xl font-heading font-bold mb-4 shadow-[4px_4px_0px_#1a1a1a]">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <h3 className="font-bold font-heading text-lg sm:text-xl text-[#1a1a1a] line-clamp-1">{entry.name}</h3>
                  <div className="flex items-center justify-center gap-1.5 mt-2 mb-6">
                    <TbFlame className="w-5 h-5 text-[#f3701e]" strokeWidth={2.5} />
                    <p className="text-[#f3701e] font-bold text-xl sm:text-2xl">{entry.totalPoints}</p>
                    <span className="text-sm font-bold text-[#f3701e]/80">pts</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t-2 border-[#1a1a1a]/10">
                    <div>
                      <p className="font-heading font-bold text-lg text-[#1a1a1a]">{entry.missionsCompleted}</p>
                      <p className="text-[#5a5a5a] text-xs font-bold uppercase tracking-wider mt-0.5">Misi</p>
                    </div>
                    <div className="border-x-2 border-[#1a1a1a]/10">
                      <p className="font-heading font-bold text-lg text-[#1a1a1a]">{entry.attendanceRate}%</p>
                      <p className="text-[#5a5a5a] text-xs font-bold uppercase tracking-wider mt-0.5">Hadir</p>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-lg text-[#1a1a1a]">{entry.ticketsResolved}</p>
                      <p className="text-[#5a5a5a] text-xs font-bold uppercase tracking-wider mt-0.5">Tiket</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {leaderboard.slice(3).map((entry) => (
              <div
                key={entry.userId}
                onClick={() => fetchUserDetail(entry.userId)}
                className="p-4 sm:p-5 flex flex-wrap sm:flex-nowrap items-center gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow bg-white neo-border-sm rounded-lg"
              >
                <div className="w-10 flex justify-center shrink-0">{getRankIcon(entry.rank)}</div>
                
                <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] neo-border flex items-center justify-center text-[#1a1a1a] font-heading font-bold text-xl shrink-0 shadow-[2px_2px_0px_#1a1a1a]">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-[150px]">
                  <p className="font-bold font-heading text-lg text-[#1a1a1a] truncate">{entry.name}</p>
                  <p className="text-sm font-medium text-[#5a5a5a] truncate">{entry.email}</p>
                </div>
                
                <div className="hidden lg:flex items-center gap-6 text-sm flex-1 justify-center">
                  <div className="text-center bg-[#f8f9fa] px-3 py-1.5 rounded-lg neo-border">
                    <p className="font-bold text-[#1a1a1a]">{entry.missionsCompleted}</p>
                    <p className="text-xs text-[#5a5a5a] font-bold">Misi</p>
                  </div>
                  <div className="text-center bg-[#f8f9fa] px-3 py-1.5 rounded-lg neo-border">
                    <p className="font-bold text-[#1a1a1a]">{entry.attendanceRate}%</p>
                    <p className="text-xs text-[#5a5a5a] font-bold">Hadir</p>
                  </div>
                  <div className="text-center bg-[#f8f9fa] px-3 py-1.5 rounded-lg neo-border">
                    <p className="font-bold text-[#1a1a1a]">{entry.dailyTasksCompleted}</p>
                    <p className="text-xs text-[#5a5a5a] font-bold">Tugas</p>
                  </div>
                  <div className="text-center bg-[#f8f9fa] px-3 py-1.5 rounded-lg neo-border">
                    <p className="font-bold text-[#1a1a1a]">{entry.ticketsResolved}</p>
                    <p className="text-xs text-[#5a5a5a] font-bold">Tiket</p>
                  </div>
                </div>
                
                <div className="text-right shrink-0 ml-auto sm:ml-0 bg-orange-50 px-4 py-2 rounded-xl neo-border">
                  <p className="font-bold font-heading text-[#f3701e] text-xl flex items-center gap-1 justify-end">
                    {entry.totalPoints}
                  </p>
                  <p className="text-xs font-bold text-[#f3701e]/80 uppercase tracking-wider">poin</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedUser && userDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div 
            className="bg-[#e8d8c9] neo-card shadow-[6px_6px_0px_#1a1a1a] p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#1a1a1a]">Detail Performa</h2>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="min-w-[44px] min-h-[44px] bg-white neo-border rounded-xl flex items-center justify-center font-bold hover:bg-[#1a1a1a] hover:text-white transition-colors flex-shrink-0"
              >
                <TbX className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-8 bg-white p-6 rounded-xl neo-border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-[#4b607f]/10" />
              <div className="w-24 h-24 mx-auto rounded-2xl bg-[#4b607f] neo-border flex items-center justify-center text-white text-4xl font-heading font-bold mb-4 shadow-[4px_4px_0px_#1a1a1a] relative z-10 -rotate-3">
                {userDetail.user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <h3 className="font-bold font-heading text-2xl text-[#1a1a1a]">{userDetail.user?.name}</h3>
              <p className="text-sm font-medium text-[#5a5a5a] mt-1">{userDetail.user?.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white neo-border rounded-xl p-5 text-center neo-card-hover transition-all duration-200">
                <div className="w-10 h-10 mx-auto bg-orange-100 rounded-lg flex items-center justify-center mb-2">
                  <TbFlame className="w-6 h-6 text-[#f3701e]" strokeWidth={2.2} />
                </div>
                <p className="text-3xl font-heading font-bold text-[#f3701e]">{userDetail.totalPoints}</p>
                <p className="text-sm font-bold text-[#5a5a5a] mt-1">Total Poin</p>
              </div>
              <div className="bg-white neo-border rounded-xl p-5 text-center neo-card-hover transition-all duration-200">
                <div className="w-10 h-10 mx-auto bg-[#e8f5e9] rounded-lg flex items-center justify-center mb-2">
                  <TbCalendarCheck className="w-6 h-6 text-green-700" strokeWidth={2.2} />
                </div>
                <p className="text-3xl font-heading font-bold text-green-600">{userDetail.streak} <span className="text-base">hari</span></p>
                <p className="text-sm font-bold text-[#5a5a5a] mt-1">Streak</p>
              </div>
            </div>

            <div className="mb-8">
              <h4 className="font-heading font-bold text-lg mb-4 text-[#1a1a1a]">Statistik Misi</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Selesai", value: userDetail.missionStats?.completed, color: "text-green-700 bg-[#e8f5e9]" },
                  { label: "Progress", value: userDetail.missionStats?.inProgress, color: "text-blue-700 bg-blue-100" },
                  { label: "Submit", value: userDetail.missionStats?.submitted, color: "text-yellow-700 bg-yellow-100" },
                  { label: "Ditolak", value: userDetail.missionStats?.rejected, color: "text-red-700 bg-red-100" },
                ].map((s) => (
                  <div key={s.label} className={`p-4 rounded-xl neo-border text-center ${s.color}`}>
                    <p className="font-heading font-bold text-2xl mb-1">{s.value || 0}</p>
                    <p className="text-xs font-bold uppercase tracking-wider">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {userDetail.pointsHistory?.length > 0 && (
              <div>
                <h4 className="font-heading font-bold text-lg mb-4 text-[#1a1a1a]">Riwayat Poin Terakhir</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                  {userDetail.pointsHistory.slice(0, 10).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-base p-4 bg-white neo-border rounded-xl">
                      <span className="font-medium text-[#1a1a1a] line-clamp-1 flex-1 pr-4">{p.reason}</span>
                      <span className="font-bold text-[#f3701e] bg-orange-50 px-3 py-1 rounded-lg neo-border whitespace-nowrap">
                        +{p.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setSelectedUser(null)} 
              className="w-full neo-btn bg-[#1a1a1a] text-white mt-6 py-4 text-lg hover:bg-[#333] transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
