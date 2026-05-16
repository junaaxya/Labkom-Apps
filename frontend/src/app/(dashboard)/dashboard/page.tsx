"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { TbRefresh } from "react-icons/tb";
import api from "@/services/api";
import type { Role } from "@/types";
import {
  AsistenDashboard,
  DashboardHeader,
  KoordinatorDashboard,
  MahasiswaDashboard,
  type KeyItem,
  type LabInfo,
  type LeaderboardEntry,
  type LocalUser,
  type LogbookItem,
  type MissionItem,
  type PCAgentStats,
  type ScheduleItem,
  type ShiftItem,
  type TicketItem,
} from "./dashboard-views";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { usePullToRefresh } from "./use-pull-to-refresh";

dayjs.locale("id");

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

function getUserId(user: LocalUser | null): string {
  if (!user) return "";
  return user.userId || user.id || "";
}

export default function DashboardPage() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [labs, setLabs] = useState<LabInfo[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ScheduleItem[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [attendanceToday, setAttendanceToday] = useState(0);
  const [activeTicketCount, setActiveTicketCount] = useState(0);
  const [attendanceMonthCount, setAttendanceMonthCount] = useState(0);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [healthScore, setHealthScore] = useState<{ score: number; level: string } | null>(null);
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [activeLogbooks, setActiveLogbooks] = useState<LogbookItem[]>([]);
  const [myMissions, setMyMissions] = useState<MissionItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pcAgentStats, setPcAgentStats] = useState<PCAgentStats | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const parsed = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(parsed || {});
      } catch {
        setUser({});
      }
    });
  }, []);

  const load = useCallback(async () => {
    const role = user?.role;
    const uid = getUserId(user);
    if (!role) return;

    setLoading(true);

    const [labsRes, schedulesRes, keysRes] = await Promise.all([
      api.get<{ data: LabInfo[] }>("/labs").catch(() => ({ data: [] })),
      api.get<{ data: ScheduleItem[] }>("/schedules/today").catch(() => ({ data: [] })),
      api.get<{ data: KeyItem[] }>("/keys").catch(() => ({ data: [] })),
    ]);
    setLabs(asArray<LabInfo>(labsRes.data));
    setTodaySchedules(asArray<ScheduleItem>(schedulesRes.data));
    setKeys(asArray<KeyItem>(keysRes.data));

    if (role === "KOORDINATOR_LAB") {
      const [ticketRes, ticketStatsRes, attendanceRes, aiRes, healthRes, logbookRes, pcAnalyticsRes] = await Promise.all([
        api.get<{ data: TicketItem[] }>("/tickets?limit=10").catch(() => ({ data: [] })),
        api.get<{ data: { open?: number; inProgress?: number } }>("/tickets/stats").catch(() => ({ data: { open: 0, inProgress: 0 } })),
        api.get<{ data: { todayCount: number } }>("/attendance/today-count").catch(() => ({ data: { todayCount: 0 } })),
        api.get<{ data: string[] }>("/ai/insights").catch(() => ({ data: [] })),
        api.get<{ data: { score: number; level: string } }>("/ai/predictive/health").catch(() => ({ data: null })),
        api.get<{ data: LogbookItem[] }>("/logbooks?status=CHECKED_IN").catch(() => ({ data: [] })),
        api.get<{ data: PCAgentStats }>("/pcs/analytics").catch(() => ({ data: null })),
      ]);
      const ticketStats = ticketStatsRes.data || { open: 0, inProgress: 0 };
      setTickets(asArray<TicketItem>(ticketRes.data));
      setActiveTicketCount((ticketStats.open || 0) + (ticketStats.inProgress || 0));
      setAttendanceToday(attendanceRes.data?.todayCount || 0);
      setAiInsights(asArray<string>(aiRes.data));
      setHealthScore(healthRes.data || null);
      setActiveLogbooks(asArray<LogbookItem>(logbookRes.data));
      setPcAgentStats(pcAnalyticsRes.data || null);
    }

    if (role === "ASISTEN_LAB") {
      const [missionRes, ticketRes, shiftRes, leaderboardRes, attendanceRes] = await Promise.all([
        api.get<{ data: MissionItem[] }>("/missions/my").catch(() => ({ data: [] })),
        api.get<{ data: TicketItem[] }>(`/tickets?assignedTo=${uid}`).catch(() => ({ data: [] })),
        api.get<{ data: ShiftItem[] }>("/shifts/today").catch(() => ({ data: [] })),
        api.get<{ data: LeaderboardEntry[] }>("/leaderboard").catch(() => ({ data: [] })),
        api.get<{ data: { createdAt?: string }[] }>("/attendance/me").catch(() => ({ data: [] })),
      ]);

      const allShifts = asArray<ShiftItem>(shiftRes.data);
      const myShifts = allShifts.filter((shift) => (shift.userId || shift.assistantId) === uid);
      const attendanceThisMonth = asArray<{ createdAt?: string }>(attendanceRes.data).filter((item) => {
        if (!item.createdAt) return false;
        return dayjs(item.createdAt).month() === dayjs().month() && dayjs(item.createdAt).year() === dayjs().year();
      });

      setMyMissions(asArray<MissionItem>(missionRes.data));
      setTickets(asArray<TicketItem>(ticketRes.data));
      setShifts(myShifts);
      setLeaderboard(asArray<LeaderboardEntry>(leaderboardRes.data));
      setAttendanceMonthCount(attendanceThisMonth.length);
    }

    if (role === "MAHASISWA") {
      const [ticketRes, notifRes] = await Promise.all([
        api.get<{ data: TicketItem[] }>("/tickets/my").catch(() => ({ data: [] })),
        api.get<{ data: { count: number } }>("/notifications/unread-count").catch(() => ({ data: { count: 0 } })),
      ]);
      setTickets(asArray<TicketItem>(ticketRes.data));
      setUnreadCount(notifRes.data?.count || 0);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: load });

  const role: Role = user?.role || "MAHASISWA";
  const uid = getUserId(user);

  const mahasiswaSchedules = useMemo(() => {
    if (!user) return todaySchedules;
    return todaySchedules.filter((schedule) => {
      const classMatch = user.className ? schedule.className === user.className : true;
      const semesterMatch = user.semester ? String(schedule.semester || "") === String(user.semester) : true;
      return classMatch && semesterMatch;
    });
  }, [todaySchedules, user]);

  const myRankEntry = leaderboard.find((entry) => entry.userId === uid);

  return (
    <div className="space-y-4 sm:space-y-6 relative" style={{ backgroundColor: "#e8d8c9" }}>
      <div
        className="fixed top-[56px] left-0 right-0 z-30 flex justify-center pointer-events-none md:hidden"
        style={{
          transform: `translateY(${Math.min(pullDistance, 80) * 0.5}px)`,
          opacity: pullDistance > 20 ? 1 : 0,
          transition: isRefreshing ? "none" : "opacity 0.1s",
        }}
      >
        <div className="bg-white rounded-full p-2 shadow-lg border border-[#e8d8c9]">
          <TbRefresh
            className={`w-5 h-5 text-[#4b607f] ${isRefreshing ? "animate-spin" : ""}`}
            style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 4}deg)` }}
          />
        </div>
      </div>

      <DashboardHeader
        user={user}
        subtitle={
          role === "KOORDINATOR_LAB"
            ? "Ringkasan operasional laboratorium hari ini."
            : role === "ASISTEN_LAB"
              ? "Pantau misi, shift, dan ticket Anda hari ini."
              : "Lihat jadwal kelas dan laporan kerusakan terbaru."
        }
      />

      {loading ? (
        <DashboardSkeleton role={role} />
      ) : role === "KOORDINATOR_LAB" ? (
        <KoordinatorDashboard
          labs={labs}
          schedules={todaySchedules}
          tickets={tickets}
          activeTicketCount={activeTicketCount}
          attendanceToday={attendanceToday}
          health={healthScore}
          insights={aiInsights}
          keys={keys}
          activeLogbooks={activeLogbooks}
          pcAgentStats={pcAgentStats}
        />
      ) : role === "ASISTEN_LAB" ? (
        <AsistenDashboard
          shifts={shifts}
          myMissions={myMissions}
          assignedTickets={tickets}
          myRank={myRankEntry?.rank || 0}
          myPoints={myRankEntry?.totalPoints || 0}
          attendanceMonthCount={attendanceMonthCount}
        />
      ) : (
        <MahasiswaDashboard
          schedules={mahasiswaSchedules}
          myTickets={tickets}
          unreadCount={unreadCount}
          keys={keys}
          isKetuaKelas={Boolean(user?.isKetuaKelas)}
        />
      )}
    </div>
  );
}
