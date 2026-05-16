"use client";

import type { Role } from "@/types";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#e8d8c9]/60 rounded-lg ${className ?? ""}`} />
  );
}

function StatCardSkeleton() {
  return (
    <div className="neo-card p-3 sm:p-5 bg-white border-l-4 border-[#e8d8c9] min-h-[88px] sm:min-h-[120px]">
      <div className="flex items-start justify-between gap-2 h-full">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-2.5 w-16" />
          <SkeletonBlock className="h-8 w-10" />
        </div>
        <SkeletonBlock className="w-8 h-8 sm:w-12 sm:h-12 rounded-full shrink-0" />
      </div>
    </div>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="neo-card bg-white flex flex-col overflow-hidden">
      <div className="px-3 sm:px-5 py-2 sm:py-3 border-b-2 border-[#1a1a1a] bg-[#f5ede6] flex items-center justify-between gap-3">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-4 w-12" />
      </div>
      <div className="p-3 sm:p-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 min-h-[56px] border-b border-[#e8d8c9] last:border-0 pb-3 last:pb-0">
            <SkeletonBlock className="w-9 h-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3 w-3/4" />
              <SkeletonBlock className="h-2.5 w-1/2" />
            </div>
            <SkeletonBlock className="h-5 w-14 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton({ role }: { role: Role }) {
  const statCount = role === "MAHASISWA" ? 3 : 4;

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className={`grid gap-2 sm:gap-4 ${role === "MAHASISWA" ? "grid-cols-3" : "grid-cols-2 xl:grid-cols-4"}`}>
        {Array.from({ length: statCount }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
        <SectionSkeleton rows={3} />
        <SectionSkeleton rows={3} />
      </div>
    </div>
  );
}
