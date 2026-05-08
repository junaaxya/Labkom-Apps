"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  TbChevronDown, 
  TbSearch, 
  TbMaximize, 
  TbSun, 
  TbLogout, 
  TbSettings, 
  TbUser,
  TbMenu2,
} from "react-icons/tb";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { useSidebar } from "@/providers/sidebar-context";
import type { User } from "@/types";

interface NeoTopbarProps {
  user: User;
}

export function NeoTopbar({ user }: NeoTopbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  
  const segments = pathname.split('/').filter(Boolean);
  
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-[#e8d8c9]/80 backdrop-blur-md neo-border-sm border-t-0 border-x-0 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 font-medium text-sm">
            <span className="text-[#5a5a5a]">Home</span>
            {segments.map((segment, index) => (
              <span key={index} className="flex items-center gap-2">
                <span className="text-[#5a5a5a]">/</span>
                <span className={index === segments.length - 1 ? "font-bold text-[#1a1a1a] capitalize" : "text-[#5a5a5a] capitalize"}>
                  {segment}
                </span>
              </span>
            ))}
          </div>
          
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
              aria-label="Buka menu"
            >
              <TbMenu2 className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <h2 className="font-heading font-bold text-lg text-[#1a1a1a]">
              Labkom
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden lg:flex items-center relative">
            <TbSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a5a]" />
            <input 
              type="text" 
              placeholder="Cari sesuatu..." 
              className="pl-9 pr-4 py-2 w-64 bg-white neo-border-sm rounded-lg text-sm focus:shadow-[2px_2px_0px_#4b607f] transition-shadow outline-none"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 mr-2">
            <button onClick={handleFullscreen} className="w-11 h-11 flex items-center justify-center rounded-lg bg-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
              <TbMaximize className="w-5 h-5 text-[#1a1a1a]" />
            </button>
            <button className="w-11 h-11 flex items-center justify-center rounded-lg bg-white neo-border-sm shadow-[2px_2px_0px_#1a1a1a] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">
              <TbSun className="w-5 h-5 text-[#1a1a1a]" />
            </button>
          </div>

          <NotificationPanel />

          <div className="relative">
            <motion.button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white neo-border-sm transition-shadow ${isDropdownOpen ? 'shadow-[2px_2px_0px_#f3701e]' : 'shadow-[2px_2px_0px_#1a1a1a] hover:shadow-[4px_4px_0px_#1a1a1a]'}`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#4b607f] flex items-center justify-center text-white font-bold text-sm border border-[#1a1a1a]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold text-[#1a1a1a] truncate max-w-[120px]">
                  {user.name}
                </p>
                <p className="text-xs text-[#5a5a5a] font-medium tracking-tight">
                  {user.role.replace("_", " ")}
                </p>
              </div>
              <TbChevronDown className={`w-4 h-4 text-[#5a5a5a] hidden sm:block transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white neo-border-sm shadow-[4px_4px_0px_#1a1a1a] rounded-lg overflow-hidden z-20"
                  >
                    <div className="p-4 border-b-2 border-[#e8d8c9] bg-[#f5ede6]">
                      <p className="font-bold text-[#1a1a1a] truncate">{user.name}</p>
                      <p className="text-xs text-[#5a5a5a] truncate mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <Link href="/profile" onClick={() => setIsDropdownOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#1a1a1a] rounded-md hover:bg-[#e8d8c9] transition-colors">
                        <TbUser className="w-4 h-4" /> Profil Saya
                      </Link>
                      <Link href="/settings" onClick={() => setIsDropdownOpen(false)} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#1a1a1a] rounded-md hover:bg-[#e8d8c9] transition-colors">
                        <TbSettings className="w-4 h-4" /> Pengaturan
                      </Link>
                    </div>
                    <div className="p-2 border-t-2 border-[#e8d8c9]">
                      <button
                        onClick={() => {
                          localStorage.removeItem("token");
                          localStorage.removeItem("user");
                          router.push("/login");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-[#ef4444] rounded-md hover:bg-[#ef4444]/10 transition-colors"
                      >
                        <TbLogout className="w-4 h-4" /> Keluar
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
