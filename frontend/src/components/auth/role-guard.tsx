"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Role } from "@/types";
import { TbShieldX } from "react-icons/tb";

const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  "/dashboard": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/profile": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/notifications": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/faq": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],

  "/labs": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/schedules": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/schedule-changes": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/users": ["KOORDINATOR_LAB"],
  "/assistants": ["KOORDINATOR_LAB"],
  "/settings": ["KOORDINATOR_LAB"],

  "/logbook": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/logbook/condition": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/keys": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/tickets": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/attendance": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/attendance/shifts": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/attendance/settings": ["KOORDINATOR_LAB"],
  "/attendance/monitoring": ["KOORDINATOR_LAB"],
  "/shifts": ["KOORDINATOR_LAB"],
  "/task-history": ["KOORDINATOR_LAB", "ASISTEN_LAB"],

  "/missions": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/leaderboard": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/certificates": ["KOORDINATOR_LAB"],

  "/lab-map": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/reports": ["KOORDINATOR_LAB"],
  "/pc-monitoring": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/inventory": ["KOORDINATOR_LAB", "ASISTEN_LAB"],

  "/ai-assistant": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/predictive": ["KOORDINATOR_LAB", "ASISTEN_LAB"],
  "/smart-scheduling": ["KOORDINATOR_LAB"],

  "/lab-booking": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/guide": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
  "/scan": ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"],
};

function hasAccess(pathname: string, role: Role): boolean {
  const segments = pathname.split("/").filter(Boolean);

  for (let i = segments.length; i >= 1; i--) {
    const path = `/${segments.slice(0, i).join("/")}`;
    const allowedRoles = ROUTE_PERMISSIONS[path];
    if (allowedRoles) return allowedRoles.includes(role);
  }

  return true;
}

interface RoleGuardProps {
  children: React.ReactNode;
}

export function RoleGuard({ children }: RoleGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const userData = localStorage.getItem("user");
      if (!userData) {
        router.push("/login");
        return;
      }

      try {
        const user: unknown = JSON.parse(userData);
        const role =
          user && typeof user === "object" && "role" in user
            ? (user as { role?: Role }).role
            : undefined;
        const mustChangePassword =
          user && typeof user === "object" && "mustChangePassword" in user
            ? Boolean((user as { mustChangePassword?: boolean }).mustChangePassword)
            : false;

        if (!role) {
          router.push("/login");
          return;
        }

        if (mustChangePassword && pathname !== "/profile") {
          router.push("/profile");
          return;
        }

        const allowed = hasAccess(pathname, role);
        setAuthorized(allowed);
      } catch {
        router.push("/login");
      }
    });
  }, [pathname, router]);

  if (authorized === null) {
    return null;
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="neo-card p-8 max-w-md">
          <TbShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-2">
            Akses Ditolak
          </h2>
          <p className="text-gray-600 mb-4">
            Anda tidak memiliki izin untuk mengakses halaman ini.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="neo-btn bg-[#4b607f] text-white px-6 py-2"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
