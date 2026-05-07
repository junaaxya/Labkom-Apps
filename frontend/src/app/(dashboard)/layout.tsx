"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RoleGuard } from "@/components/auth/role-guard";
import type { User } from "@/types";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      router.push("/login");
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch {
      router.push("/login");
    }
  }, [router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#e8d8c9] flex items-center justify-center">
        <div className="neo-card p-8 animate-pulse">
          <p className="font-heading font-bold text-[#4b607f]">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <RoleGuard>
        {children}
      </RoleGuard>
    </DashboardLayout>
  );
}
