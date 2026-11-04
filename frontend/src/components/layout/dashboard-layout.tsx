"use client";

import { NeoSidebar } from "./neo-sidebar";
import { NeoTopbar } from "./neo-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SidebarProvider } from "@/providers/sidebar-context";
import type { User } from "@/types";
import { CurrentUserProvider } from "@/providers/current-user-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <CurrentUserProvider user={user}>
      <SidebarProvider>
      <div className="min-h-screen bg-[#e8d8c9] neo-grain safe-area-inset">
        <NeoSidebar
          role={user.role}
          isKetuaKelas={user.isKetuaKelas}
          userName={user.name}
        />

        <div className="lg:pl-[72px] transition-[padding] duration-300 ease-in-out min-h-screen flex flex-col relative z-10">
          <NeoTopbar user={user} />

          <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full relative z-10 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-safe">
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>

        <MobileBottomNav role={user.role} />
      </div>
      </SidebarProvider>
    </CurrentUserProvider>
  );
}
