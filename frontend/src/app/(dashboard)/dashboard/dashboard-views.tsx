import Link from "next/link";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import {
  TbBell,
  TbBrain,
  TbBuildingWarehouse,
  TbCalendarEvent,
  TbCircleCheck,
  TbClipboardList,
  TbDeviceDesktop,
  TbKey,
  TbSparkles,
  TbTargetArrow,
  TbTicket,
  TbTrophy,
  TbUserCode,
  TbArrowRight,
  TbChartBar,
  TbAlertTriangle,
  TbWifi,
  TbWifiOff,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import { MobileCard } from "@/components/ui/mobile-card";

export interface LocalUser {
  userId?: string;
  id?: string;
  name?: string;
  role?: "KOORDINATOR_LAB" | "ASISTEN_LAB" | "MAHASISWA";
  email?: string;
  semester?: string;
  className?: string;
  isKetuaKelas?: boolean;
}

export interface LabInfo {
  id: string;
  name: string;
  status: string;
  pcs?: { id: string; isOnline?: boolean }[];
}

export interface ScheduleItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  className?: string;
  semester?: string;
  lecturerName?: string;
  lab?: { id?: string; name?: string };
  createdAt?: string;
  date?: string;
}

export interface TicketItem {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
  lab?: { name?: string };
}

export interface MissionItem {
  id: string;
  title: string;
  status: string;
  points?: number;
}

export interface ShiftItem {
  id: string;
  userId?: string;
  assistantId?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  lab?: { name?: string };
}

export interface KeyItem {
  id: string;
  keyCode: string;
  status: string;
  lab?: { name?: string };
  currentHolder?: { id?: string; name?: string };
}

export interface LogbookItem {
  id: string;
  status: string;
  lab?: { name?: string };
  officialCheckinById?: string;
  officialCheckinBy?: { id?: string; name?: string };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
}

export interface PCAgentStats {
  totalPCs: number;
  onlineCount: number;
  offlineCount: number;
  unknownCount: number;
  warningCount: number;
  needsCheckCount: number;
}

interface StatCardItem {
  label: string;
  value: number;
  icon: IconType;
  tone: string;
}

export function statusBadge(status?: string) {
  switch (status) {
    case "ONGOING":
    case "IN_PROGRESS":
    case "TAKEN":
    case "BORROWED":
      return "bg-[#4b607f] text-white";
    case "OPEN":
      return "bg-[#f3701e] text-white";
    case "RESOLVED":
    case "FINISHED":
    case "AVAILABLE":
      return "bg-emerald-500 text-white";
    default:
      return "bg-[#e8d8c9] text-[#1a1a1a]";
  }
}

function StatCard({ item, index = 0 }: { item: StatCardItem; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`neo-card p-3 sm:p-5 bg-white border-l-4 min-h-[88px] sm:min-h-[120px] ${item.tone.replace('text-', 'border-')} hover:-translate-y-[3px] hover:shadow-[6px_6px_0px_#1a1a1a] transition-all duration-300`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3 h-full">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-xs uppercase font-bold text-[#5a5a5a] tracking-wider sm:tracking-widest mb-1 truncate">{item.label}</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + (index * 0.05) }}
            className="font-heading text-2xl sm:text-4xl font-bold text-[#1a1a1a] leading-none"
          >
            {item.value}
          </motion.p>
        </div>
        <div className="w-8 h-8 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center relative overflow-hidden">
          <div className={`absolute inset-0 opacity-15 ${item.tone.replace('text-', 'bg-')}`}></div>
          <item.icon className={`w-4 h-4 sm:w-6 sm:h-6 relative z-10 ${item.tone}`} strokeWidth={2.2} />
        </div>
      </div>
    </motion.div>
  );
}

function Section({ title, action, children, icon: Icon, delay = 0.1 }: { title: string; action?: ReactNode; children: ReactNode; icon?: IconType; delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="neo-card bg-white flex flex-col h-full overflow-hidden"
    >
      <div className="px-3 sm:px-5 py-2 sm:py-3 border-b-2 border-[#1a1a1a] bg-[#f5ede6] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#f3701e] shrink-0" strokeWidth={2.5} />}
          <h3 className="font-heading text-xs sm:text-base font-bold text-[#1a1a1a] tracking-tight truncate uppercase sm:normal-case sm:tracking-tight">{title}</h3>
        </div>
        {action && (
          <div className="shrink-0">{action}</div>
        )}
      </div>
      <div className="p-2.5 sm:p-5 flex-1">{children}</div>
    </motion.div>
  );
}

function QuickActions({ items }: { items: { label: string; href: string; icon: IconType }[] }) {
  return (
    <Section title="Quick Actions" icon={TbTargetArrow} delay={0.4}>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <Link 
            key={item.href} 
            href={item.href} 
            className="neo-btn bg-white text-[#1a1a1a] p-3 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-3 group min-h-[96px] sm:min-h-[auto] rounded-xl active:shadow-none active:translate-y-0 sm:neo-hover"
          >
            <div className="w-10 h-10 rounded-full bg-[#f5ede6] flex items-center justify-center group-hover:bg-[#f3701e] group-hover:text-white transition-colors duration-300">
              <item.icon className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center leading-tight">{item.label}</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

export function DashboardHeader({ user, subtitle }: { user: LocalUser | null; subtitle: string }) {
  const currentDate = dayjs().format("dddd, D MMMM YYYY");
  const firstName = user?.name?.split(" ")[0] || "User";
  
  const hour = dayjs().hour();
  let greeting = "Selamat Malam";
  if (hour >= 5 && hour < 12) greeting = "Selamat Pagi";
  else if (hour >= 12 && hour < 15) greeting = "Selamat Siang";
  else if (hour >= 15 && hour < 18) greeting = "Selamat Sore";

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="neo-card bg-white relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#f3701e] via-[#4b607f] to-[#f3701e]"></div>
      
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full border-4 border-[#e8d8c9] opacity-50"></div>
      <div className="absolute right-12 top-12 w-4 h-4 bg-[#f3701e] rounded-sm transform rotate-45"></div>
      <div className="absolute right-24 bottom-6 w-8 h-8 rounded-full border-2 border-[#4b607f] opacity-30"></div>
      
      <div className="p-3 sm:p-6 md:p-8 relative z-10">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="neo-badge px-2 py-0.5 sm:px-3 sm:py-1.5 bg-[#f5ede6] text-[#1a1a1a] font-bold text-[10px] sm:text-xs inline-block">
            {currentDate}
          </div>
          <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-[#1a1a1a] text-white text-[10px] sm:text-xs font-bold rounded-md inline-block">
            {user?.role?.replace("_", " ")}
          </div>
        </div>

        <h1 className="font-heading text-lg sm:text-3xl lg:text-4xl font-bold text-[#1a1a1a] mt-2 sm:mt-3 mb-1 sm:mb-1.5 tracking-tight">
          {greeting}, <span className="text-[#4b607f]">{firstName}</span>! 👋
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-[#5a5a5a] max-w-2xl font-medium leading-relaxed">{subtitle}</p>
      </div>
    </motion.div>
  );
}

export function KoordinatorDashboard({
  labs,
  schedules,
  tickets,
  activeTicketCount,
  attendanceToday,
  health,
  insights,
  keys,
  activeLogbooks,
  pcAgentStats,
}: {
  labs: LabInfo[];
  schedules: ScheduleItem[];
  tickets: TicketItem[];
  activeTicketCount: number;
  attendanceToday: number;
  health: { score: number; level: string } | null;
  insights: string[];
  keys: KeyItem[];
  activeLogbooks: LogbookItem[];
  pcAgentStats?: PCAgentStats | null;
}) {
  const pcOnline = pcAgentStats?.onlineCount ?? labs.reduce((acc, lab) => acc + (lab.pcs?.filter((pc) => pc.isOnline).length || 0), 0);
  const borrowedKeys = keys.filter((k) => k.status === "BORROWED");

  const stats: StatCardItem[] = [
    { label: "Total Lab", value: labs.length, icon: TbBuildingWarehouse, tone: "text-[#4b607f]" },
    { label: "PC Online", value: pcOnline, icon: TbDeviceDesktop, tone: "text-emerald-500" },
    { label: "Ticket Aktif", value: activeTicketCount, icon: TbTicket, tone: "text-[#f3701e]" },
    { label: "Asleb Bertugas", value: attendanceToday, icon: TbUserCode, tone: "text-[#4b607f]" },
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">{stats.map((item, idx) => <StatCard key={item.label} item={item} index={idx} />)}</div>

      {pcAgentStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Section
            title="PC Agent Monitor"
            icon={TbDeviceDesktop}
            delay={0.05}
            action={
              <Link href="/pc-monitoring" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
                <span className="hidden sm:inline">Detail</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-4 rounded-xl neo-border-sm bg-[#fcf8f4] text-center hover:bg-[#f5ede6] transition-colors">
                <TbWifi className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mx-auto mb-1 sm:mb-2" />
                <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a]">{pcAgentStats.onlineCount}</p>
                <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5a5a5a] mt-0.5 sm:mt-1">Online</p>
              </div>
              <div className="p-2.5 sm:p-4 rounded-xl neo-border-sm bg-[#fcf8f4] text-center hover:bg-[#f5ede6] transition-colors">
                <TbWifiOff className="w-5 h-5 sm:w-6 sm:h-6 text-[#6b7280] mx-auto mb-1 sm:mb-2" />
                <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a]">{pcAgentStats.offlineCount}</p>
                <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5a5a5a] mt-0.5 sm:mt-1">Offline</p>
              </div>
              <div className="p-2.5 sm:p-4 rounded-xl neo-border-sm bg-[#fcf8f4] text-center hover:bg-[#f5ede6] transition-colors">
                <TbDeviceDesktop className="w-5 h-5 sm:w-6 sm:h-6 text-[#9ca3af] mx-auto mb-1 sm:mb-2" />
                <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a]">{pcAgentStats.unknownCount}</p>
                <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5a5a5a] mt-0.5 sm:mt-1">Unknown</p>
              </div>
              <div className="p-2.5 sm:p-4 rounded-xl neo-border-sm bg-[#fcf8f4] text-center hover:bg-[#f5ede6] transition-colors">
                <TbAlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-[#f3701e] mx-auto mb-1 sm:mb-2" />
                <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a]">{pcAgentStats.warningCount}</p>
                <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5a5a5a] mt-0.5 sm:mt-1">Warnings</p>
              </div>
              <div className="p-2.5 sm:p-4 rounded-xl neo-border-sm bg-[#fcf8f4] text-center hover:bg-[#f5ede6] transition-colors">
                <TbClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 mx-auto mb-1 sm:mb-2" />
                <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a]">{pcAgentStats.needsCheckCount}</p>
                <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#5a5a5a] mt-0.5 sm:mt-1">Perlu Cek</p>
              </div>
            </div>
          </Section>
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <Section title="Status Lab" icon={TbBuildingWarehouse} delay={0.1}>
          <div className="space-y-3">
            {labs.map((lab) => {
              const totalPc = lab.pcs?.length || 0;
              const onlinePc = lab.pcs?.filter((pc) => pc.isOnline).length || 0;
              const onlinePercentage = totalPc > 0 ? Math.round((onlinePc / totalPc) * 100) : 0;
              const activeSchedule = schedules.filter((s) => s.lab?.id === lab.id && ["SCHEDULED", "ONGOING"].includes(s.status)).length;
              return (
                <div key={lab.id} className="relative pl-3 sm:pl-0 sm:p-3 rounded-xl sm:neo-border-sm sm:bg-[#fcf8f4] sm:hover:bg-[#f5ede6] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#4b607f] rounded-full sm:hidden"></div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="font-bold text-[#1a1a1a] text-sm leading-tight min-w-0 truncate">{lab.name}</p>
                    <span className="neo-badge px-2 py-0.5 text-[9px] sm:text-xs bg-[#e8d8c9] text-[#1a1a1a] font-bold shrink-0">{lab.status}</span>
                  </div>
                  
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1 font-medium">
                      <span className="text-[#5a5a5a]">PC Online: <span className="text-[#1a1a1a] font-bold">{onlinePc}/{totalPc}</span></span>
                      <span className="text-[#5a5a5a]">{onlinePercentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#e8d8c9] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${onlinePercentage}%` }}></div>
                    </div>
                  </div>
                  
                  {activeSchedule > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-[#5a5a5a] font-medium">
                      <TbCalendarEvent className="w-3.5 h-3.5 text-[#f3701e] shrink-0" />
                      <span>{activeSchedule} Jadwal Aktif</span>
                    </div>
                  )}
                </div>
              );
            })}
            {labs.length === 0 && <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Belum ada data lab.</p>}
          </div>
        </Section>

        <Section title="Aktivitas Terbaru" icon={TbBell} delay={0.2}>
          <div className="space-y-3">
            {activeLogbooks.slice(0, 3).map((logbook) => (
              <div key={logbook.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-[#fcf8f4] flex gap-2 sm:gap-3 items-start group sm:hover:bg-[#f5ede6] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1.5 w-0.5 h-4 bg-[#4b607f] rounded-full sm:hidden"></div>
                <div className="hidden sm:block mt-1 w-2 h-2 rounded-full bg-[#4b607f] shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#1a1a1a] group-hover:text-[#f3701e] transition-colors truncate">Sesi aktif di {logbook.lab?.name || "Lab"}</p>
                  <p className="text-[10px] sm:text-xs text-[#5a5a5a] font-medium mt-0.5">Status: {logbook.status}</p>
                </div>
              </div>
            ))}
            {tickets.slice(0, 3).map((ticket) => (
              <div key={ticket.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-white flex gap-2 sm:gap-3 items-start group sm:hover:bg-[#fcf8f4] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1.5 w-0.5 h-4 bg-[#f3701e] rounded-full sm:hidden"></div>
                <div className="hidden sm:block mt-1 w-2 h-2 rounded-full bg-[#f3701e] shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-[#1a1a1a] group-hover:text-[#f3701e] transition-colors truncate">{ticket.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] sm:text-xs text-[#5a5a5a] font-medium">{ticket.lab?.name || "Lab"}</span>
                    <span className="w-1 h-1 rounded-full bg-[#e8d8c9]"></span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${statusBadge(ticket.status)}`}>{ticket.status}</span>
                  </div>
                </div>
              </div>
            ))}
            {activeLogbooks.length === 0 && tickets.length === 0 && (
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Belum ada aktivitas terbaru.</p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <Section title="AI Insights + Health Score" icon={TbBrain} delay={0.25}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl neo-border-sm bg-[#1a1a1a] text-white flex items-center justify-between shadow-[4px_4px_0px_#f3701e] hover:-translate-y-1 transition-transform">
              <div className="inline-flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                  <TbChartBar className="w-5 h-5 text-[#f3701e]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-300">Lab Health Score</p>
                  <p className="font-heading text-2xl sm:text-3xl font-bold mt-1">
                    {health ? `${health.score}` : "-"}
                    {health && <span className="text-sm font-medium text-[#f3701e] ml-2 uppercase tracking-widest">{health.level}</span>}
                  </p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-[#2a2a2a] border-t-[#f3701e] flex items-center justify-center animate-[spin_3s_linear_infinite]">
                <div className="w-8 h-8 rounded-full border-2 border-[#4b607f] border-r-transparent animate-[spin_2s_linear_infinite_reverse]"></div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <TbSparkles className="w-4 h-4 text-[#f3701e]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#5a5a5a]">AI Recommendations</span>
              </div>
              {insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.slice(0, 3).map((insight, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + (idx * 0.1) }}
                      key={`${insight}-${idx}`} 
                      className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-[#fcf8f4] text-sm text-[#1a1a1a] font-medium leading-relaxed sm:hover:bg-[#f5ede6] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-2.5 sm:pb-0 last:border-0 last:pb-0"
                    >
                      <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#f3701e] rounded-full sm:hidden"></div>
                      <span className="hidden sm:inline text-[#f3701e] font-bold mr-2">→</span>
                      {insight}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Belum ada insight AI.</p>
              )}
            </div>
          </div>
        </Section>

        <Section 
          title="Pemegang Kunci Saat Ini" 
          icon={TbKey} 
          delay={0.3}
          action={
            <Link href="/keys" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
              <span className="hidden sm:inline">Lihat Semua</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        >
          <div className="space-y-3">
            {borrowedKeys.map((key) => (
              <div key={key.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-[#fcf8f4] flex items-center justify-between gap-2 sm:hover:bg-[#f5ede6] transition-colors group border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#4b607f] rounded-full sm:hidden"></div>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#e8d8c9] flex items-center justify-center group-hover:bg-white transition-colors shrink-0">
                    <TbKey className="w-4 h-4 sm:w-5 sm:h-5 text-[#1a1a1a]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[#1a1a1a] truncate">
                      <span className="text-[#f3701e]">{key.keyCode}</span> · {key.lab?.name || "Lab"}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[#5a5a5a] font-medium truncate">Pemegang: <span className="text-[#1a1a1a] font-bold">{key.currentHolder?.name || "-"}</span></p>
                  </div>
                </div>
                <span className="neo-badge px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-[#4b607f] text-white shrink-0">Dipinjam</span>
              </div>
            ))}
            {borrowedKeys.length === 0 && (
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Tidak ada kunci dipinjam saat ini.</p>
            )}
          </div>
        </Section>
      </div>

      <Section 
        title="Jadwal Hari Ini" 
        icon={TbCalendarEvent} 
        delay={0.35}
        action={
          <Link href="/schedules" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
            <span className="hidden sm:inline">Lihat Jadwal</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        }
      >
        <div className="md:hidden space-y-3">
          {schedules.map((schedule) => (
            <MobileCard
              key={schedule.id}
              title={schedule.title}
              subtitle={schedule.lab?.name || "-"}
              badge={
                <span className={`inline-block px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-md border-2 border-[#1a1a1a] ${statusBadge(schedule.status)}`}>
                  {schedule.status}
                </span>
              }
              fields={[
                {
                  label: "Waktu",
                  value: (
                    <span className="bg-[#e8d8c9] px-2 py-1 rounded-md text-[#1a1a1a] text-xs font-bold">
                      {schedule.startTime} - {schedule.endTime}
                    </span>
                  ),
                },
                { label: "Dosen", value: schedule.lecturerName || "-" },
              ]}
            />
          ))}
          {schedules.length === 0 && (
            <div className="p-6 text-center bg-white">
              <TbCalendarEvent className="w-10 h-10 mx-auto text-[#e8d8c9] mb-2" />
              <p className="text-sm font-bold text-[#5a5a5a]">Tidak ada jadwal hari ini.</p>
            </div>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto rounded-xl neo-border-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f5ede6] text-[#1a1a1a] font-bold border-b-2 border-[#1a1a1a]">
              <tr>
                <th className="py-3 px-4 uppercase tracking-wider text-xs">Waktu</th>
                <th className="py-3 px-4 uppercase tracking-wider text-xs">Mata Kuliah</th>
                <th className="py-3 px-4 uppercase tracking-wider text-xs">Lab</th>
                <th className="py-3 px-4 uppercase tracking-wider text-xs">Dosen</th>
                <th className="py-3 px-4 uppercase tracking-wider text-xs text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule, idx) => (
                <tr 
                  key={schedule.id} 
                  className={`border-b border-[#e8d8c9] hover:bg-[#fcf8f4] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#fafaf9]'}`}
                >
                  <td className="py-3 px-4 font-medium whitespace-nowrap">
                    <span className="bg-[#e8d8c9] px-2 py-1 rounded-md text-[#1a1a1a] text-xs font-bold">
                      {schedule.startTime} - {schedule.endTime}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-[#1a1a1a]">{schedule.title}</td>
                  <td className="py-3 px-4 font-medium text-[#5a5a5a]">{schedule.lab?.name || "-"}</td>
                  <td className="py-3 px-4 text-[#5a5a5a]">{schedule.lecturerName || "-"}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-md border-2 border-[#1a1a1a] ${statusBadge(schedule.status)}`}>
                      {schedule.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedules.length === 0 && (
            <div className="p-6 text-center bg-white">
              <TbCalendarEvent className="w-10 h-10 mx-auto text-[#e8d8c9] mb-2" />
              <p className="text-sm font-bold text-[#5a5a5a]">Tidak ada jadwal hari ini.</p>
            </div>
          )}
        </div>
      </Section>

      <QuickActions items={[{ label: "Buat Jadwal", href: "/schedules", icon: TbCalendarEvent }, { label: "Buat Misi", href: "/missions", icon: TbTargetArrow }, { label: "Lihat Laporan", href: "/reports", icon: TbClipboardList }]} />
    </div>
  );
}

export function AsistenDashboard({
  shifts,
  myMissions,
  assignedTickets,
  myRank,
  myPoints,
  attendanceMonthCount,
}: {
  shifts: ShiftItem[];
  myMissions: MissionItem[];
  assignedTickets: TicketItem[];
  myRank: number;
  myPoints: number;
  attendanceMonthCount: number;
}) {
  const activeMissionCount = myMissions.filter((m) => m.status === "TAKEN").length;
  const tasksToday = shifts.length + assignedTickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length;
  const stats: StatCardItem[] = [
    { label: "Misi Aktif", value: activeMissionCount, icon: TbTargetArrow, tone: "text-[#f3701e]" },
    { label: "Poin Saya", value: myPoints, icon: TbSparkles, tone: "text-[#4b607f]" },
    { label: "Absensi Bulan Ini", value: attendanceMonthCount, icon: TbCircleCheck, tone: "text-emerald-500" },
    { label: "Tugas Hari Ini", value: tasksToday, icon: TbClipboardList, tone: "text-[#4b607f]" },
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">{stats.map((item, idx) => <StatCard key={item.label} item={item} index={idx} />)}</div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <Section title="Jadwal Shift Saya Hari Ini" icon={TbCalendarEvent} delay={0.1}>
          <div className="space-y-3">
            {shifts.map((shift) => (
              <div key={shift.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-[#fcf8f4] flex flex-col gap-1.5 sm:hover:bg-[#f5ede6] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#4b607f] rounded-full sm:hidden"></div>
                <div className="flex justify-between items-center gap-2">
                  <span className="neo-badge px-2 py-0.5 text-[10px] bg-[#4b607f] text-white font-bold truncate">{shift.lab?.name || "Lab"}</span>
                  <span className={`px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-sm shrink-0 ${statusBadge(shift.status)}`}>{shift.status || "-"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TbCalendarEvent className="w-3.5 h-3.5 text-[#5a5a5a] shrink-0" />
                  <p className="font-heading text-base sm:text-lg font-bold text-[#1a1a1a]">{shift.startTime || "-"} <span className="text-[#5a5a5a] text-xs mx-0.5">s/d</span> {shift.endTime || "-"}</p>
                </div>
              </div>
            ))}
            {shifts.length === 0 && (
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Tidak ada shift hari ini.</p>
            )}
          </div>
        </Section>
        
        <Section title="Misi yang Sedang Dikerjakan" icon={TbTargetArrow} delay={0.2}>
          <div className="space-y-3">
            {myMissions.filter((m) => m.status === "TAKEN").slice(0, 5).map((mission) => (
              <div key={mission.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-white sm:hover:-translate-y-1 transition-transform sm:shadow-[2px_2px_0px_#1a1a1a] border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#f3701e] rounded-full sm:hidden"></div>
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <p className="font-bold text-sm text-[#1a1a1a] line-clamp-2 min-w-0">{mission.title}</p>
                  <span className="flex-shrink-0 inline-flex items-center justify-center bg-[#f5ede6] text-[#f3701e] font-bold text-xs px-2 py-0.5 rounded-md border-2 border-[#1a1a1a]">
                    +{mission.points || 0}
                  </span>
                </div>
                <div className="w-full bg-[#e8d8c9] rounded-full h-1 mt-2 mb-0.5 overflow-hidden">
                  <div className="bg-[#4b607f] h-1 rounded-full" style={{ width: '60%' }}></div>
                </div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-[#5a5a5a] text-right">In Progress</p>
              </div>
            ))}
            {myMissions.filter((m) => m.status === "TAKEN").length === 0 && (
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Tidak ada misi aktif.</p>
            )}
          </div>
        </Section>
        
        <Section title="Leaderboard Position" icon={TbTrophy} delay={0.3}>
          <div className="p-6 rounded-xl neo-border-sm bg-[#1a1a1a] text-white text-center h-full flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#4b607f]/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <motion.div 
              animate={{ y: [0, -10, 0] }} 
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="relative z-10"
            >
              <TbTrophy className="w-10 h-10 sm:w-16 sm:h-16 mx-auto text-[#f3701e] drop-shadow-[0_0_15px_rgba(243,112,30,0.5)]" />
            </motion.div>
            
            <div className="relative z-10 mt-4">
              <p className="font-heading text-3xl sm:text-4xl md:text-6xl font-bold text-white drop-shadow-md">
                #{myRank > 0 ? myRank : "-"}
              </p>
              <p className="text-sm font-bold uppercase tracking-widest text-[#f3701e] mt-2">Peringkat Anda</p>
            </div>
            
            {myRank > 0 && myRank <= 3 && (
              <div className="absolute top-4 right-4 bg-[#f3701e] text-white text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider transform rotate-12">
                Top 3!
              </div>
            )}
          </div>
        </Section>
      </div>
      
      <Section 
        title="Ticket yang Di-assign ke Saya" 
        icon={TbTicket} 
        delay={0.4}
        action={
          <Link href="/tickets" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
            <span className="hidden sm:inline">Lihat Ticket</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedTickets.slice(0, 6).map((ticket) => (
            <div key={ticket.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-white flex items-center justify-between gap-2 sm:hover:shadow-[4px_4px_0px_#1a1a1a] sm:hover:-translate-y-1 transition-all border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
              <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#f3701e] rounded-full sm:hidden"></div>
              <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="hidden sm:block w-3 h-3 rounded-full mt-1.5 bg-[#f3701e] shrink-0"></div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#1a1a1a] mb-0.5 truncate">{ticket.title}</p>
                  <p className="text-[10px] font-medium text-[#5a5a5a] bg-[#f5ede6] inline-block px-2 py-0.5 rounded-md">{ticket.lab?.name || "Lab"}</p>
                </div>
              </div>
              <span className={`flex-shrink-0 px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider rounded-md border-2 border-[#1a1a1a] ${statusBadge(ticket.status)}`}>
                {ticket.status}
              </span>
            </div>
          ))}
          {assignedTickets.length === 0 && (
            <div className="col-span-full">
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Belum ada ticket yang di-assign.</p>
            </div>
          )}
        </div>
      </Section>
      <QuickActions items={[{ label: "Absen Masuk", href: "/attendance", icon: TbCircleCheck }, { label: "Ambil Misi", href: "/missions", icon: TbTargetArrow }, { label: "Lihat Ticket", href: "/tickets", icon: TbTicket }]} />
    </div>
  );
}

export function MahasiswaDashboard({ schedules, myTickets, unreadCount, keys, isKetuaKelas }: { schedules: ScheduleItem[]; myTickets: TicketItem[]; unreadCount: number; keys: KeyItem[]; isKetuaKelas: boolean }) {
  const stats: StatCardItem[] = [
    { label: "Jadwal Hari Ini", value: schedules.length, icon: TbCalendarEvent, tone: "text-[#4b607f]" },
    { label: "Laporan Saya", value: myTickets.length, icon: TbTicket, tone: "text-[#f3701e]" },
    { label: "Notifikasi", value: unreadCount, icon: TbBell, tone: "text-emerald-500" },
  ];
  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">{stats.map((item, idx) => <StatCard key={item.label} item={item} index={idx} />)}</div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <Section 
          title="Jadwal Lab Hari Ini" 
          icon={TbCalendarEvent} 
          delay={0.1}
          action={
            <Link href="/schedules" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
              <span className="hidden sm:inline">Lihat Jadwal</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        >
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-white flex gap-2 sm:gap-4 items-start sm:items-center sm:hover:bg-[#fcf8f4] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#4b607f] rounded-full sm:hidden"></div>
                <div className="bg-[#e8d8c9] px-2 py-1.5 sm:px-3 sm:py-2 rounded-md border-2 border-[#1a1a1a] shrink-0 min-w-[90px] sm:min-w-[120px] text-center">
                  <p className="font-bold text-[#1a1a1a] text-xs sm:text-sm">{schedule.startTime}</p>
                  <p className="text-[10px] font-medium text-[#5a5a5a]">s/d {schedule.endTime}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#1a1a1a] text-sm mb-0.5 leading-tight truncate">{schedule.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="neo-badge px-2 py-0.5 text-[9px] bg-[#4b607f] text-white uppercase tracking-wider">
                      {schedule.lab?.name || "Lab"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {schedules.length === 0 && (
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Tidak ada jadwal untuk kelas Anda hari ini.</p>
            )}
          </div>
        </Section>
        
        <Section 
          title="Laporan Kerusakan Terakhir" 
          icon={TbTicket} 
          delay={0.2}
          action={
            <Link href="/tickets/my" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
              <span className="hidden sm:inline">Lihat Riwayat</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        >
          <div className="space-y-3">
            {myTickets.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-[#fcf8f4] flex items-center justify-between gap-2 sm:hover:bg-[#f5ede6] transition-colors border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full sm:hidden ${ticket.status === 'RESOLVED' || ticket.status === 'FINISHED' ? 'bg-emerald-500' : ticket.status === 'OPEN' ? 'bg-[#f3701e]' : 'bg-[#4b607f]'}`}></div>
                <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className={`hidden sm:block w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${ticket.status === 'RESOLVED' || ticket.status === 'FINISHED' ? 'bg-emerald-500' : ticket.status === 'OPEN' ? 'bg-[#f3701e]' : 'bg-[#4b607f]'}`}></div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[#1a1a1a] mb-0.5 truncate">{ticket.title}</p>
                    <p className="text-[10px] font-medium text-[#5a5a5a]">{dayjs(ticket.createdAt).format("DD MMM YYYY · HH:mm")}</p>
                  </div>
                </div>
                <span className={`flex-shrink-0 px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider rounded-md border-2 border-[#1a1a1a] ${statusBadge(ticket.status)}`}>
                  {ticket.status}
                </span>
              </div>
            ))}
            {myTickets.length === 0 && (
              <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Belum ada laporan kerusakan.</p>
            )}
          </div>
        </Section>
      </div>
      
      {isKetuaKelas && (
        <Section 
          title="Kunci Lab" 
          icon={TbKey} 
          delay={0.3}
          action={
            <Link href="/keys" className="group flex items-center gap-1 text-sm font-bold text-[#f3701e] hover:text-[#1a1a1a] transition-colors">
              <span className="hidden sm:inline">Kelola Kunci</span> <TbArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {keys.slice(0, 6).map((key) => (
              <div key={key.id} className="relative pl-3 sm:pl-0 sm:p-3 sm:rounded-xl sm:neo-border-sm sm:bg-white flex items-center justify-between gap-2 sm:hover:shadow-[4px_4px_0px_#1a1a1a] sm:hover:-translate-y-1 transition-all border-b border-[#e8d8c9] sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#f3701e] rounded-full sm:hidden"></div>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f5ede6] flex items-center justify-center shrink-0">
                    <TbKey className="w-4 h-4 sm:w-5 sm:h-5 text-[#f3701e]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-[#1a1a1a] truncate">{key.keyCode}</p>
                    <p className="text-[10px] font-medium text-[#5a5a5a] truncate">{key.lab?.name || "Lab"}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider rounded-md border-2 border-[#1a1a1a] shrink-0 ${statusBadge(key.status)}`}>
                  {key.status}
                </span>
              </div>
            ))}
            {keys.length === 0 && (
              <div className="col-span-full">
                <p className="text-xs sm:text-sm text-[#5a5a5a] p-3 sm:p-4 text-center neo-border border-dashed rounded-xl">Data kunci tidak tersedia.</p>
              </div>
            )}
          </div>
        </Section>
      )}
      <QuickActions items={[{ label: "Lihat Jadwal", href: "/schedules", icon: TbCalendarEvent }, { label: "Lapor Kerusakan", href: "/tickets/new", icon: TbTicket }]} />
    </div>
  );
}
