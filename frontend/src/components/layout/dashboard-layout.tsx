"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { NeoSidebar } from "./neo-sidebar";
import { NeoTopbar } from "./neo-topbar";
import { SidebarProvider } from "@/providers/sidebar-context";
import type { User } from "@/types";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-[#e8d8c9] neo-grain safe-area-inset">
        <NeoSidebar
          role={user.role}
          isKetuaKelas={user.isKetuaKelas}
          userName={user.name}
        />

        <div className="lg:pl-[72px] transition-[padding] duration-300 ease-in-out min-h-screen flex flex-col relative z-10">
          <NeoTopbar user={user} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full relative z-10 pb-safe">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
