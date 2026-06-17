"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";
import type { IconType } from "react-icons";
import {
  TbLayoutDashboard,
  TbBuildingWarehouse,
  TbCalendarEvent,
  TbUsers,
  TbUserCode,
  TbBook2,
  TbKey,
  TbTicket,
  TbTargetArrow,
  TbTrophy,
  TbChartBar,
  TbSettings,
  TbChecklist,
  TbMap2,
  TbClipboardList,
  TbAlertTriangle,
  TbQrcode,
  TbFileDescription,
  TbBookmarks,
  TbCertificate,
  TbMessageCircle,
  TbDeviceDesktop,
  TbBolt,
  TbServer,
  TbRobot,
  TbBrain,
  TbCalendarStats,
  TbCalendarClock,
  TbArrowsExchange,
  TbSpeakerphone,
  TbX,
} from "react-icons/tb";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/providers/sidebar-context";

interface MenuItem {
  label: string;
  href: string;
  icon: IconType;
  group?: string;
}

const menuByRole: Record<Role, MenuItem[]> = {
  KOORDINATOR_LAB: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard, group: "Main" },
    { label: "Pengumuman", href: "/announcements", icon: TbSpeakerphone, group: "Main" },
    { label: "Manajemen Lab", href: "/labs", icon: TbBuildingWarehouse, group: "Management" },
    { label: "Manajemen Jadwal", href: "/schedules", icon: TbCalendarEvent, group: "Management" },
    { label: "Manajemen User", href: "/users", icon: TbUsers, group: "Management" },
    { label: "Daftar Asleb", href: "/assistants", icon: TbUserCode, group: "Management" },
    { label: "Monitoring Absensi", href: "/attendance/monitoring", icon: TbChecklist, group: "Operations" },
    { label: "Scan QR", href: "/scan", icon: TbQrcode, group: "Operations" },
    { label: "Monitoring Logbook", href: "/logbook", icon: TbBook2, group: "Operations" },
    { label: "Peminjaman Kunci", href: "/keys", icon: TbKey, group: "Operations" },
    { label: "Ticketing", href: "/tickets", icon: TbTicket, group: "Operations" },
    { label: "Approval Peminjaman", href: "/lab-booking", icon: TbCalendarClock, group: "Operations" },
    { label: "Manajemen Pengumuman", href: "/announcements/manage", icon: TbSpeakerphone, group: "Operations" },
    { label: "Misi & Verifikasi", href: "/missions", icon: TbTargetArrow, group: "Gamification" },
    { label: "Leaderboard", href: "/leaderboard", icon: TbTrophy, group: "Gamification" },
    { label: "Sertifikat", href: "/certificates", icon: TbCertificate, group: "Gamification" },
    { label: "Peta Lab", href: "/lab-map", icon: TbMap2, group: "Analytics" },
    { label: "Laporan", href: "/reports", icon: TbChartBar, group: "Analytics" },
    { label: "PC Monitoring", href: "/pc-monitoring", icon: TbDeviceDesktop, group: "Analytics" },
    { label: "Inventory", href: "/inventory", icon: TbServer, group: "Analytics" },
    { label: "Energi", href: "/energy", icon: TbBolt, group: "Analytics" },
    { label: "AI Assistant", href: "/ai-assistant", icon: TbRobot, group: "AI Features" },
    { label: "Predictive", href: "/predictive", icon: TbBrain, group: "AI Features" },
    { label: "Smart Scheduling", href: "/smart-scheduling", icon: TbCalendarStats, group: "AI Features" },
    { label: "FAQ Bot", href: "/faq", icon: TbMessageCircle, group: "System" },
    { label: "Pengaturan", href: "/settings", icon: TbSettings, group: "System" },
  ],
  ASISTEN_LAB: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard, group: "Main" },
    { label: "Pengumuman", href: "/announcements", icon: TbSpeakerphone, group: "Main" },
    { label: "Absensi Saya", href: "/attendance", icon: TbChecklist, group: "My Work" },
    { label: "Jadwal Tugas", href: "/schedules", icon: TbCalendarEvent, group: "My Work" },
    { label: "Misi Saya", href: "/missions", icon: TbTargetArrow, group: "My Work" },
    { label: "Riwayat Tugas", href: "/task-history", icon: TbClipboardList, group: "My Work" },
    { label: "Scan QR", href: "/scan", icon: TbQrcode, group: "Operations" },
    { label: "Logbook Lab", href: "/logbook", icon: TbBook2, group: "Operations" },
    { label: "Kunci Lab", href: "/keys", icon: TbKey, group: "Operations" },
    { label: "Ticketing", href: "/tickets", icon: TbTicket, group: "Operations" },
    { label: "Approval Peminjaman", href: "/lab-booking", icon: TbCalendarClock, group: "Operations" },
    { label: "Peta Lab", href: "/lab-map", icon: TbMap2, group: "Monitoring" },
    { label: "PC Monitoring", href: "/pc-monitoring", icon: TbDeviceDesktop, group: "Monitoring" },
    { label: "Inventory", href: "/inventory", icon: TbServer, group: "Monitoring" },
    { label: "Leaderboard", href: "/leaderboard", icon: TbTrophy, group: "Gamification" },
    { label: "AI Assistant", href: "/ai-assistant", icon: TbRobot, group: "Tools" },
    { label: "FAQ Bot", href: "/faq", icon: TbMessageCircle, group: "Tools" },
  ],
  MAHASISWA: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard, group: "Main" },
    { label: "Pengumuman", href: "/announcements", icon: TbSpeakerphone, group: "Main" },
    { label: "Jadwal Lab", href: "/schedules", icon: TbCalendarEvent, group: "Main" },
    { label: "Scan QR", href: "/scan", icon: TbQrcode, group: "Support" },
    { label: "Lapor Kerusakan", href: "/tickets/new", icon: TbAlertTriangle, group: "Support" },
    { label: "Riwayat Laporan", href: "/tickets/my", icon: TbClipboardList, group: "Support" },
    { label: "Peminjaman Lab", href: "/lab-booking", icon: TbCalendarClock, group: "Support" },
    { label: "FAQ Bot", href: "/faq", icon: TbMessageCircle, group: "Resources" },
    { label: "Panduan Lab", href: "/guide", icon: TbBookmarks, group: "Resources" },
  ],
};

const ketuaKelasExtraMenu: MenuItem[] = [
  { label: "Scan QR Kunci", href: "/scan", icon: TbQrcode, group: "Extra" },
  { label: "Validasi Kondisi", href: "/logbook/condition", icon: TbFileDescription, group: "Extra" },
  { label: "Request Jadwal", href: "/schedules", icon: TbArrowsExchange, group: "Extra" },
];

interface NeoSidebarProps {
  role: Role;
  isKetuaKelas?: boolean;
  userName: string;
}

const desktopSidebarVariants = {
  closed: { width: 72 },
  open: { width: 280 },
};

const mobileDrawerVariants = {
  closed: { x: "-100%" },
  open: { x: 0 },
};

const menuItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, type: "spring" as const, stiffness: 300, damping: 24 },
  }),
};

export function NeoSidebar({ role, isKetuaKelas = false, userName }: NeoSidebarProps) {
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isBottom, setIsBottom] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { isOpen: isMobileOpen, closeSidebar } = useSidebar();

  let menuItems = menuByRole[role] || menuByRole.MAHASISWA;
  if (isKetuaKelas) {
    const existingHrefs = new Set(menuItems.map((item) => item.href));
    const additiveKetuaMenu = ketuaKelasExtraMenu.filter((item) => !existingHrefs.has(item.href));
    menuItems = [...menuItems.slice(0, 2), ...additiveKetuaMenu, ...menuItems.slice(2)];
  }

  const groupedMenu = menuItems.reduce((acc, item) => {
    const group = item.group || "Lainnya";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const isExpanded = isMobile ? isMobileOpen : isDesktopOpen;

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight, scrollTop } = scrollRef.current;
        setIsScrolled(scrollTop > 0);
        setIsBottom(scrollHeight - scrollTop <= clientHeight + 10);
      }
    };

    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [isExpanded, menuItems]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    setIsScrolled(target.scrollTop > 0);
    setIsBottom(target.scrollHeight - target.scrollTop <= target.clientHeight + 10);
  };

  useEffect(() => {
    if (isMobile) closeSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 p-4 border-b-[3px] border-[#1a1a1a] bg-[#4b607f] relative z-10 pt-safe-top">
        <button
          onClick={isMobile ? closeSidebar : () => setIsDesktopOpen(!isDesktopOpen)}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#f3701e] neo-border-sm text-white font-heading font-bold text-lg neo-hover shadow-[2px_2px_0px_#1a1a1a] flex-shrink-0"
          aria-label={isMobile ? "Tutup menu" : "Toggle menu"}
        >
          {isMobile && isMobileOpen ? <TbX className="w-5 h-5" /> : "L"}
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-white font-heading font-bold text-xl whitespace-nowrap tracking-wide"
            >
              Labkom
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {isMobile && isMobileOpen && (
        <div className="flex justify-center py-2 bg-[#4b607f]">
          <div className="w-8 h-1 rounded-full bg-white/30" />
        </div>
      )}

      <div className="relative flex-1 overflow-hidden flex flex-col">
        <div
          className={`absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#4b607f] to-transparent z-10 transition-opacity duration-300 pointer-events-none ${
            isScrolled ? "opacity-100" : "opacity-0"
          }`}
        />

        <nav
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin scrollbar-thumb-[#1a1a1a] scrollbar-track-transparent overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {Object.entries(groupedMenu).map(([group, items], groupIndex) => (
            <div key={group} className="space-y-1 relative">
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8d8c9]/60">
                      {group}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isExpanded && groupIndex > 0 && (
                <div className="w-6 h-px bg-white/10 mx-auto my-3" />
              )}

              {items.map((item, i) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    custom={i}
                    variants={menuItemVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative group/item"
                  >
                    {isActive && !isExpanded && (
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#f3701e]" />
                    )}

                    {isActive && isExpanded && (
                      <div className="absolute -left-3 top-2 bottom-2 w-1 bg-[#f3701e] rounded-r" />
                    )}

                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg transition-all duration-150 relative
                        ${
                          isActive
                            ? "bg-[#f3701e] text-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a] font-bold"
                            : "text-white/80 hover:bg-[#3b4d66] hover:text-white active:bg-[#3b4d66]/80"
                        }
                      `}
                    >
                      <Icon
                        className="flex-shrink-0 w-5 h-5 relative z-10"
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="text-sm whitespace-nowrap overflow-hidden relative z-10"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>

                    {!isExpanded && !isMobile && (
                      <div className="absolute left-14 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#1a1a1a] text-white text-xs font-bold rounded neo-border-sm opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all z-50 whitespace-nowrap shadow-[2px_2px_0px_#f3701e]">
                        {item.label}
                        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#1a1a1a] border-l-2 border-b-2 border-[#1a1a1a] rotate-45"></div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          className={`absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#4b607f] to-transparent z-10 transition-opacity duration-300 pointer-events-none ${
            !isBottom ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div className="p-4 border-t-[3px] border-[#1a1a1a] bg-[#4b607f] relative z-10 pb-safe-bottom">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-[#e8d8c9] neo-border-sm flex items-center justify-center text-sm font-bold text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#22c55e] rounded-full border-2 border-[#1a1a1a]"></div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-white text-sm font-bold truncate max-w-[150px] leading-tight">
                  {userName}
                </p>
                <div className="inline-block px-1.5 py-0.5 mt-1 bg-[#1a1a1a] rounded text-[10px] font-bold text-[#f3701e] uppercase tracking-wider">
                  {role.replace("_", " ")}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );

  return (
    <>
      <motion.aside
        className="hidden lg:flex fixed left-0 top-0 h-full z-40 flex-col neo-border-sm bg-steel-blue overflow-hidden shadow-[4px_0px_0px_#1a1a1a]"
        style={{ backgroundColor: "#4b607f" }}
        variants={desktopSidebarVariants}
        animate={isDesktopOpen ? "open" : "closed"}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onMouseEnter={() => setIsDesktopOpen(true)}
        onMouseLeave={() => setIsDesktopOpen(false)}
      >
        {sidebarContent}
      </motion.aside>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[#1a1a1a]/50 backdrop-blur-sm z-30 lg:hidden touch-none"
              onClick={closeSidebar}
              aria-hidden="true"
            />

            <motion.aside
              key="mobile-drawer"
              className="fixed left-0 top-0 h-full z-40 flex flex-col neo-border-sm overflow-hidden shadow-[4px_0px_0px_#1a1a1a] w-[min(280px,85vw)] lg:hidden"
              style={{ backgroundColor: "#4b607f", willChange: "transform" }}
              variants={mobileDrawerVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
