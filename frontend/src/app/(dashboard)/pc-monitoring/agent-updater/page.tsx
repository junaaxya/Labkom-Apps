"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TbArrowLeft, TbRocket } from "react-icons/tb";
import { AgentUpdaterPanel } from "@/components/pc/agent-updater-panel";
import api from "@/services/api";

type Lab = { id: string; name: string };

export default function AgentUpdaterPage() {
  const searchParams = useSearchParams();
  const [labs, setLabs] = useState<Lab[]>([]);
  const selectedPcIds = searchParams.get("pcs")?.split(",").filter(Boolean) || [];

  useEffect(() => {
    void api.get<{ data: Lab[] }>("/labs")
      .then((response) => setLabs(response.data || []))
      .catch(() => setLabs([]));
  }, []);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <section className="neo-card min-w-0 overflow-hidden bg-[#f5ede6] p-4 sm:p-6">
        <Link href="/pc-monitoring" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-black text-[#4b607f]">
          <TbArrowLeft className="h-5 w-5" /> Kembali ke PC Monitoring
        </Link>
        <div className="mt-3 flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#f3701e]">
            <TbRocket className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">PC Agent Operations</p>
            <h1 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">Agent Updater</h1>
            <p className="mt-1 max-w-2xl text-xs font-semibold text-[#5a5a5a] sm:text-sm">Kelola paket agent bertanda tangan dan rollout bertahap tanpa memenuhi halaman monitoring perangkat.</p>
          </div>
        </div>
      </section>

      <AgentUpdaterPanel labs={labs} selectedPcIds={selectedPcIds} />
    </div>
  );
}
