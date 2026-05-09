"use client";

import { useState, useEffect } from "react";
import {
  TbBolt,
  TbBulb,
  TbCurrencyDollar,
  TbDeviceDesktop,
  TbLeaf,
  TbLoader2,
  TbRefresh,
  TbTrendingDown,
  TbTrendingUp,
} from "react-icons/tb";
import api from "@/services/api";

interface LabEnergy {
  labName: string;
  totalPCs: number;
  onlinePCs: number;
  totalWatt: number;
  activeWatt: number;
  dailyKwh: number;
  monthlyKwh: number;
  monthlyCost: number;
}

interface EnergyData {
  labs: Record<string, LabEnergy>;
  total: {
    totalPCs: number;
    onlinePCs: number;
    totalActiveWatt: number;
    totalMonthlyKwh: number;
    totalMonthlyCost: number;
    costPerKwh: number;
  };
  recommendations: string[];
}

export default function EnergyPage() {
  const [data, setData] = useState<EnergyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnergy();
  }, []);

  async function fetchEnergy() {
    try {
      setLoading(true);
      const res = await api.get<{ data: EnergyData }>("/pcs/energy");
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="neo-card p-12 text-center">
        <TbBolt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Gagal memuat data energi</p>
        <button onClick={fetchEnergy} className="neo-btn mt-4">
          <TbRefresh className="w-4 h-4 inline mr-1" /> Coba Lagi
        </button>
      </div>
    );
  }

  const labs = Object.values(data.labs);
  const usagePercent = data.total.totalPCs > 0
    ? Math.round((data.total.onlinePCs / data.total.totalPCs) * 100)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">
            Energy Dashboard
          </h1>
          <p className="text-[#5a5a5a] mt-1 text-sm sm:text-base font-medium leading-relaxed">Estimasi konsumsi listrik & rekomendasi hemat energi</p>
        </div>
        <button onClick={fetchEnergy} className="neo-btn px-6 py-3 bg-white text-[#1a1a1a] flex items-center justify-center gap-2 font-bold hover:bg-[#f5ede6] transition-colors">
          <TbRefresh className="w-5 h-5" /> Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 sm:gap-5">
        <div className="neo-card-hover p-5 flex items-center gap-4 cursor-default">
          <div className="w-14 h-14 rounded-full bg-[#eab308] neo-border-sm flex items-center justify-center shrink-0">
            <TbBolt className="w-7 h-7 text-[#1a1a1a]" />
          </div>
          <div>
            <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-none">{data.total.totalActiveWatt}W</p>
            <p className="text-xs font-bold text-[#5a5a5a] mt-2 uppercase tracking-wider">Daya Aktif</p>
          </div>
        </div>
        
        <div className="neo-card-hover p-5 flex items-center gap-4 cursor-default">
          <div className="w-14 h-14 rounded-full bg-[#4b607f] neo-border-sm flex items-center justify-center shrink-0">
            <TbBulb className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-none">{data.total.totalMonthlyKwh} <span className="text-base sm:text-lg">kWh</span></p>
            <p className="text-xs font-bold text-[#5a5a5a] mt-2 uppercase tracking-wider">Est. Bulanan</p>
          </div>
        </div>
        
        <div className="neo-card-hover p-5 flex items-center gap-4 cursor-default">
          <div className="w-14 h-14 rounded-full bg-[#22c55e] neo-border-sm flex items-center justify-center shrink-0">
            <TbCurrencyDollar className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-none">Rp {data.total.totalMonthlyCost.toLocaleString()}</p>
            <p className="text-xs font-bold text-[#5a5a5a] mt-2 uppercase tracking-wider">Est. Biaya/Bulan</p>
          </div>
        </div>
        
        <div className="neo-card-hover p-5 flex items-center gap-4 cursor-default">
          <div className="w-14 h-14 rounded-full bg-[#f3701e] neo-border-sm flex items-center justify-center shrink-0">
            <TbDeviceDesktop className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-end gap-1">
              <p className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] leading-none">{usagePercent}</p>
              <span className="font-heading text-lg sm:text-xl font-bold text-[#1a1a1a] leading-none mb-0.5">%</span>
            </div>
            <p className="text-xs font-bold text-[#5a5a5a] mt-2 uppercase tracking-wider">Utilisasi PC</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-heading text-xl font-bold text-[#1a1a1a] flex items-center gap-2">
            <span className="w-8 h-8 bg-[#4b607f] text-white rounded-full flex items-center justify-center neo-border-sm">
              <TbDeviceDesktop className="w-5 h-5" />
            </span>
            Konsumsi per Lab
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {labs.map((lab, idx) => {
              const labUsage = lab.totalPCs > 0 ? (lab.onlinePCs / lab.totalPCs) * 100 : 0;
              return (
                <div key={idx} className="neo-card p-5 bg-white relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#f5ede6] rounded-full neo-border-sm opacity-50 group-hover:scale-150 transition-transform duration-500" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-heading font-bold text-lg text-[#1a1a1a]">{lab.labName}</h3>
                        <span className="text-sm font-medium text-[#4b607f]">
                          {lab.onlinePCs} / {lab.totalPCs} PC aktif
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 mb-5">
                      <div className="flex justify-between items-center border-b-2 border-[#f5ede6] pb-2">
                        <p className="text-[#5a5a5a] text-sm font-medium">Daya Aktif</p>
                        <p className="font-bold text-[#1a1a1a]">{lab.activeWatt}W</p>
                      </div>
                      <div className="flex justify-between items-center border-b-2 border-[#f5ede6] pb-2">
                        <p className="text-[#5a5a5a] text-sm font-medium">Est. Bulanan</p>
                        <p className="font-bold text-[#1a1a1a]">{lab.monthlyKwh.toFixed(1)} kWh</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[#5a5a5a] text-sm font-medium">Est. Biaya</p>
                        <p className="font-bold text-[#f3701e] text-lg">Rp {lab.monthlyCost.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs font-bold text-[#1a1a1a] mb-1.5 uppercase tracking-wide">
                        <span>Utilisasi</span>
                        <span>{labUsage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-[#e8d8c9] rounded-full h-3 neo-border-sm overflow-hidden">
                        <div
                          className={`h-full border-r-2 border-[#1a1a1a] transition-all duration-1000 ${
                            labUsage > 80 ? "bg-[#ef4444]" : labUsage > 50 ? "bg-[#eab308]" : "bg-[#22c55e]"
                          }`}
                          style={{ width: `${labUsage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="neo-card p-6 bg-[#f5ede6]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#22c55e] rounded-full flex items-center justify-center neo-border-sm shadow-[2px_2px_0px_#1a1a1a]">
                <TbLeaf className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold font-heading text-[#1a1a1a]">
                Tips Hemat Energi
              </h2>
            </div>
            <div className="space-y-3">
              {data.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-xl neo-border-sm hover:shadow-[4px_4px_0px_#1a1a1a] transition-shadow">
                  <div className="mt-0.5 w-6 h-6 bg-[#22c55e] rounded-full neo-border-sm flex items-center justify-center shrink-0">
                    <TbTrendingDown className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-medium text-[#1a1a1a] leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="neo-card p-5 bg-white border-dashed">
            <h3 className="font-heading font-bold text-[#1a1a1a] flex items-center gap-2 mb-2">
              <span className="text-xl">ℹ️</span> Informasi Estimasi
            </h3>
            <p className="text-sm text-[#5a5a5a] leading-relaxed">
              Kalkulasi ini berdasarkan tarif dasar <strong className="text-[#1a1a1a]">{data.total.costPerKwh ? `Rp ${data.total.costPerKwh}/kWh` : "standar"}</strong> dengan 
              asumsi operasional <strong className="text-[#1a1a1a]">10 jam/hari</strong>, selama <strong className="text-[#1a1a1a]">22 hari kerja/bulan</strong>. 
              <br /><br />
              Data aktual yang lebih akurat akan tersedia setelah integrasi IoT agent selesai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
