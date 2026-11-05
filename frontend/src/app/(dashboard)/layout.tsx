"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RoleGuard } from "@/components/auth/role-guard";
import type { User } from "@/types";
import api from "@/services/api";
import { initializeNativeNotifications } from "@/services/native-notifications";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const syncUser = (event: Event) => setUser((event as CustomEvent<User>).detail);
    window.addEventListener("labkom:user-updated", syncUser);

    queueMicrotask(() => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

      if (!token || !userData) {
        router.push("/login");
        return;
      }

      try {
        const parsedUser = JSON.parse(userData) as User;
        void api.post("/files/session", {}).catch(() => undefined).finally(async () => {
          let currentUser = parsedUser;
          if (parsedUser.registrationSource === "EXTERNAL_SELF_REGISTRATION") {
            const status = await api.get<{ data: { required: boolean } }>("/access-requests/academic-profile").catch(() => null);
            if (status) currentUser = { ...parsedUser, academicProfileRequired: status.data.required };
          }
          localStorage.setItem("user", JSON.stringify(currentUser));
          setUser(currentUser);
          void initializeNativeNotifications();
        });
      } catch {
        router.push("/login");
      }
    });

    return () => window.removeEventListener("labkom:user-updated", syncUser);
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

  if (user.academicProfileRequired) {
    return <main className="min-h-screen bg-[#e8d8c9] p-4 sm:p-8"><RoleGuard>{children}</RoleGuard></main>;
  }

  return (
    <DashboardLayout user={user}>
      <RoleGuard>
        {children}
      </RoleGuard>
    </DashboardLayout>
  );
}
