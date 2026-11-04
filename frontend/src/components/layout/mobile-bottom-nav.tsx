"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  TbLayoutDashboard,
  TbCalendarEvent,
  TbQrcode,
  TbRobot,
  TbChecklist,
  TbTicket,
  TbMenu2,
  TbBuildingWarehouse,
  TbKey,
  TbSchool,
} from "react-icons/tb";
import { useSidebar } from "@/providers/sidebar-context";
import type { Role } from "@/types";

interface MobileBottomNavProps {
  role: Role;
}

interface NavItem {
  label: string;
  href: string;
  icon: IconType;
  match?: (pathname: string) => boolean;
  highlight?: boolean;
}

const navByRole: Record<Role, NavItem[]> = {
  KOORDINATOR_LAB: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Lab", href: "/labs", icon: TbBuildingWarehouse },
    { label: "Tiket", href: "/tickets", icon: TbTicket, match: (p) => p.startsWith("/tickets") },
    { label: "Akademik", href: "/academic", icon: TbSchool, match: (p) => p.startsWith("/academic") },
  ],
  ASISTEN_LAB: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Absensi", href: "/attendance", icon: TbChecklist, match: (p) => p.startsWith("/attendance") },
    { label: "Akademik", href: "/academic", icon: TbSchool, match: (p) => p.startsWith("/academic") },
    { label: "Tiket", href: "/tickets", icon: TbTicket, match: (p) => p.startsWith("/tickets") },
  ],
  MAHASISWA: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Jadwal", href: "/schedules", icon: TbCalendarEvent },
    { label: "Scan QR", href: "/scan", icon: TbQrcode, match: (p) => p.startsWith("/scan"), highlight: true },
    { label: "Akademik", href: "/academic", icon: TbSchool, match: (p) => p.startsWith("/academic") },
  ],
  MAGANG: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Jadwal", href: "/schedules", icon: TbCalendarEvent, match: (p) => p.startsWith("/schedules") },
    { label: "Absensi", href: "/attendance", icon: TbChecklist, match: (p) => p.startsWith("/attendance") },
    { label: "Kunci", href: "/keys", icon: TbKey, match: (p) => p.startsWith("/keys") },
    { label: "AI", href: "/ai-assistant", icon: TbRobot, match: (p) => p.startsWith("/ai-assistant") },
  ],
  DOSEN: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Akademik", href: "/academic", icon: TbSchool, match: (p) => p.startsWith("/academic") },
    { label: "Pengumuman", href: "/announcements", icon: TbCalendarEvent },
    { label: "Profil", href: "/profile", icon: TbKey },
  ],
};

const FALLBACK: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match) return item.match(pathname);
  if (pathname === item.href) return true;
  return pathname.startsWith(`${item.href}/`);
}

export function MobileBottomNav({ role }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { openSidebar } = useSidebar();
  const items = navByRole[role] ?? FALLBACK;

  return (
    <nav
      aria-label="Navigasi utama"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t-2 border-[#1a1a1a] bg-[#e8d8c9] pb-safe-bottom"
    >
      <ul className="grid grid-cols-5 items-stretch">
        {items.slice(0, 4).map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const isHighlight = item.highlight;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[64px] px-1 text-xs font-semibold transition-colors ${
                  active ? "text-[#1a1a1a]" : "text-[#5a5a5a]"
                }`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                    isHighlight
                      ? "border border-[#1a1a1a] bg-[#f3701e] text-[#1a1a1a]"
                      : active
                        ? "bg-[#f3701e] text-[#1a1a1a]"
                        : "bg-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isHighlight ? 2.4 : 2.2} />
                </span>
                <span className={`leading-tight ${isHighlight ? "font-bold text-[#1a1a1a]" : ""}`}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Buka menu lengkap"
            className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold text-[#5a5a5a]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-transparent">
              <TbMenu2 className="w-5 h-5" strokeWidth={2.2} />
            </span>
            <span className="leading-tight">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
