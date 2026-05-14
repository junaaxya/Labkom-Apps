"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  TbUserCode, TbLoader2, TbSearch,
} from "react-icons/tb";
import api from "@/services/api";

interface AslebUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AssistantsPage() {
  const router = useRouter();
  const [aslebs, setAslebs] = useState<AslebUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isAslebUser = (value: unknown): value is AslebUser => {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v.id === "string" &&
      typeof v.name === "string" &&
      typeof v.email === "string"
    );
  };

  const extractUsers = (data: unknown): AslebUser[] => {
    const rawItems: unknown = (() => {
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        const maybeItems = obj.items ?? obj.users;
        if (Array.isArray(maybeItems)) return maybeItems;
      }
      return [];
    })();

    return (rawItems as unknown[]).filter(isAslebUser);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: unknown }>("/users?role=ASISTEN_LAB&limit=50");
      setAslebs(extractUsers(res.data));
    } catch {
      // keep previous behavior: no toast, just stop loading
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, []);

  const filteredAslebs = aslebs.filter(
    (a) =>
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1a1a1a] mb-1">Daftar Asisten Lab</h1>
        <p className="text-[#5a5a5a] text-sm">Kelola dan lihat profil asisten laboratorium</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="neo-card p-5 neo-card-hover transition-all duration-200 hover:translate-y-[-2px]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full neo-border bg-[#e8d8c9] flex items-center justify-center">
              <TbUserCode className="w-6 h-6 text-[#1a1a1a]" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold font-heading text-[#4b607f] leading-none">{aslebs.length}</p>
              <p className="text-sm font-bold text-[#5a5a5a] mt-1">Total Asleb</p>
            </div>
          </div>
        </div>
        <div className="neo-card p-5 neo-card-hover transition-all duration-200 hover:translate-y-[-2px]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full neo-border bg-[#e8f5e9] flex items-center justify-center">
              <TbUserCode className="w-6 h-6 text-green-700" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold font-heading text-green-600 leading-none">{aslebs.filter((a) => a.isActive).length}</p>
              <p className="text-sm font-bold text-[#5a5a5a] mt-1">Aktif</p>
            </div>
          </div>
        </div>
        <div className="neo-card p-5 neo-card-hover transition-all duration-200 hover:translate-y-[-2px]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full neo-border bg-red-50 flex items-center justify-center">
              <TbUserCode className="w-6 h-6 text-red-600" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold font-heading text-red-600 leading-none">{aslebs.filter((a) => !a.isActive).length}</p>
              <p className="text-sm font-bold text-[#5a5a5a] mt-1">Nonaktif</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <TbSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5a5a5a]" strokeWidth={2.2} />
          <input
            type="text"
            placeholder="Cari nama atau email asleb..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="neo-input pl-12 py-3 w-full text-base bg-white focus:shadow-[4px_4px_0px_#4b607f] transition-all duration-200"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredAslebs.map((asleb, i) => (
          <motion.div
            key={asleb.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-5 rounded-lg neo-border-sm hover:shadow hover:-translate-y-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-200 bg-white"
            onClick={() => router.push(`/assistants/${asleb.id}`)}
          >
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-14 h-14 rounded-xl neo-border bg-[#e8d8c9] flex items-center justify-center text-[#1a1a1a] font-heading font-bold text-2xl shadow-[2px_2px_0px_#1a1a1a]">
                  {asleb.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className={`absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-white shadow-sm ${asleb.isActive ? 'bg-green-500' : 'bg-red-500'}`} title={asleb.isActive ? "Aktif" : "Nonaktif"} />
              </div>
              <div>
                <p className="font-bold font-heading text-lg text-[#1a1a1a]">{asleb.name}</p>
                <p className="text-sm font-medium text-[#5a5a5a] mt-0.5">{asleb.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 self-start sm:self-center">
              <span className="text-sm font-heading font-bold text-[#4b607f]">Lihat Detail →</span>
              {asleb.phone && (
                <span className="text-sm font-bold text-[#1a1a1a] bg-[#f5ede6] neo-border px-3 py-1.5 rounded-lg">
                  {asleb.phone}
                </span>
              )}
              <span
                className={`neo-badge px-3 py-1.5 text-xs font-bold neo-border ${
                  asleb.isActive
                    ? "bg-[#e8f5e9] text-green-800 border-[#1a1a1a]"
                    : "bg-red-50 text-red-800 border-[#1a1a1a]"
                }`}
              >
                {asleb.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>
          </motion.div>
        ))}
        {filteredAslebs.length === 0 && (
          <div className="neo-card p-10 text-center border-dashed bg-white/50">
            <TbUserCode className="w-12 h-12 text-[#4b607f]/40 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-lg font-bold text-[#1a1a1a] mb-1">Tidak ada asisten lab ditemukan</p>
            <p className="text-[#5a5a5a] text-sm">Coba gunakan kata kunci pencarian yang lain.</p>
          </div>
        )}
      </div>
    </div>
  );
}
