"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  TbLayoutDashboard,
  TbCalendarEvent,
  TbQrcode,
  TbAlertTriangle,
  TbRobot,
  TbChecklist,
  TbBook2,
  TbTicket,
  TbDeviceDesktop,
  TbMenu2,
  TbBuildingWarehouse,
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
}

const navByRole: Record<Role, NavItem[]> = {
  KOORDINATOR_LAB: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Lab", href: "/labs", icon: TbBuildingWarehouse },
    { label: "Tiket", href: "/tickets", icon: TbTicket, match: (p) => p.startsWith("/tickets") },
    { label: "PC", href: "/pc-monitoring", icon: TbDeviceDesktop },
  ],
  ASISTEN_LAB: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Absensi", href: "/attendance", icon: TbChecklist, match: (p) => p.startsWith("/attendance") },
    { label: "Logbook", href: "/logbook", icon: TbBook2, match: (p) => p.startsWith("/logbook") },
    { label: "Tiket", href: "/tickets", icon: TbTicket, match: (p) => p.startsWith("/tickets") },
  ],
  MAHASISWA: [
    { label: "Dashboard", href: "/dashboard", icon: TbLayoutDashboard },
    { label: "Jadwal", href: "/schedules", icon: TbCalendarEvent },
    { label: "Scan QR", href: "/scan", icon: TbQrcode, match: (p) => p.startsWith("/scan") },
    { label: "Lapor", href: "/tickets/new", icon: TbAlertTriangle, match: (p) => p === "/tickets/new" },
    { label: "AI", href: "/ai-assistant", icon: TbRobot },
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
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#e8d8c9]/95 backdrop-blur-md neo-border-sm border-x-0 border-b-0 pb-safe-bottom"
    >
      <ul className="grid grid-cols-5 items-stretch">
        {items.slice(0, 4).map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[60px] px-1 text-[10px] font-bold transition-colors ${
                  active ? "text-[#1a1a1a]" : "text-[#5a5a5a]"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                    active ? "bg-[#f3701e] text-white shadow-[2px_2px_0px_#1a1a1a]" : "bg-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.2} />
                </span>
                <span className="leading-tight tracking-wide uppercase">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            onClick={openSidebar}
            aria-label="Buka menu lengkap"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[60px] px-1 text-[10px] font-bold text-[#5a5a5a]"
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-transparent">
              <TbMenu2 className="w-5 h-5" strokeWidth={2.2} />
            </span>
            <span className="leading-tight tracking-wide uppercase">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
