"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import {
  TbBrandWhatsapp,
  TbCalendar,
  TbRefresh,
  TbPlugConnected,
  TbPlugConnectedX,
  TbQrcode,
  TbSend,
  TbLoader2,
  TbSettings,
  TbChecklist,
} from "react-icons/tb";
import api from "@/services/api";

const AttendanceSettingsPage = lazy(
  () => import("@/app/(dashboard)/attendance/settings/page")
);

type SettingsTab = "integrasi" | "absensi";

interface WAStatus {
  status: "disconnected" | "connecting" | "connected" | "qr_ready";
  qrCode: string | null;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("integrasi");
  const [waStatus, setWaStatus] = useState<WAStatus>({ status: "disconnected", qrCode: null });
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState({ wa: false, calendar: false, sync: false, test: false });
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchWAStatus = async () => {
      try {
        const res = await api.get<{ data: WAStatus }>("/whatsapp/status");
        if (mounted) setWaStatus(res.data);
      } catch {}
    };

    const fetchCalendarStatus = async () => {
      try {
        const res = await api.get<{ data: { connected: boolean } }>("/calendar/status");
        if (mounted) setCalendarConnected(res.data.connected);
      } catch {}
    };

    fetchWAStatus();
    fetchCalendarStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const fetchWAStatus = async () => {
    try {
      const res = await api.get<{ data: WAStatus }>("/whatsapp/status");
      setWaStatus(res.data);
    } catch {}
  };

  const connectWA = async () => {
    setLoading((p) => ({ ...p, wa: true }));
    try {
      const res = await api.post<{ data: WAStatus }>("/whatsapp/connect", {});
      setWaStatus(res.data);
      setTimeout(fetchWAStatus, 3000);
    } catch {}
    setLoading((p) => ({ ...p, wa: false }));
  };

  const disconnectWA = async () => {
    setLoading((p) => ({ ...p, wa: true }));
    try {
      await api.post("/whatsapp/disconnect", {});
      setWaStatus({ status: "disconnected", qrCode: null });
    } catch {}
    setLoading((p) => ({ ...p, wa: false }));
  };

  const resetWA = async () => {
    setLoading((p) => ({ ...p, wa: true }));
    try {
      await api.post("/whatsapp/reset", {});
      setWaStatus({ status: "disconnected", qrCode: null });
    } catch {}
    setLoading((p) => ({ ...p, wa: false }));
  };

  const sendTestWA = async () => {
    if (!testPhone || !testMessage) return;
    setLoading((p) => ({ ...p, test: true }));
    try {
      await api.post("/whatsapp/send-test", { phone: testPhone, message: testMessage });
      setTestPhone("");
      setTestMessage("");
    } catch {}
    setLoading((p) => ({ ...p, test: false }));
  };

  const connectCalendar = async () => {
    setLoading((p) => ({ ...p, calendar: true }));
    try {
      const res = await api.get<{ data: { url: string } }>("/calendar/auth-url");
      window.open(res.data.url, "_blank");
    } catch {}
    setLoading((p) => ({ ...p, calendar: false }));
  };

  const disconnectCalendar = async () => {
    setLoading((p) => ({ ...p, calendar: true }));
    try {
      await api.post("/calendar/disconnect", {});
      setCalendarConnected(false);
    } catch {}
    setLoading((p) => ({ ...p, calendar: false }));
  };

  const syncCalendar = async () => {
    setLoading((p) => ({ ...p, sync: true }));
    setSyncResult(null);
    try {
      const res = await api.post<{ data: { synced: number }; message: string }>("/calendar/sync", {});
      setSyncResult(res.message);
    } catch {
      setSyncResult("Gagal sinkronisasi");
    }
    setLoading((p) => ({ ...p, sync: false }));
  };

  const statusColor: Record<string, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    qr_ready: "bg-blue-500",
    disconnected: "bg-gray-400",
  };

  const statusLabel: Record<string, string> = {
    connected: "Terhubung",
    connecting: "Menghubungkan...",
    qr_ready: "Scan QR Code",
    disconnected: "Terputus",
  };

  const tabs: Array<{ key: SettingsTab; label: string; icon: typeof TbSettings }> = [
    { key: "integrasi", label: "Integrasi", icon: TbPlugConnected },
    { key: "absensi", label: "Absensi", icon: TbChecklist },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] text-[#1a1a1a] flex items-center justify-center neo-border-sm shrink-0">
          <TbSettings size={28} strokeWidth={2.2} />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#1a1a1a]">Pengaturan</h1>
          <p className="text-[#4b607f] font-medium mt-1">Kelola integrasi dan konfigurasi sistem</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`neo-btn flex items-center gap-2 px-5 py-2.5 font-bold text-sm transition-all duration-200 whitespace-nowrap ${
              activeTab === t.key
                ? "bg-[#4b607f] text-white"
                : "bg-white text-[#1a1a1a] hover:bg-[#e8d8c9] hover:shadow-[2px_2px_0px_#1a1a1a]"
            }`}
          >
            <t.icon className="w-5 h-5" strokeWidth={2.2} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "integrasi" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WhatsApp Bot Section */}
          <div className="neo-card p-6 sm:p-8 space-y-6 bg-white neo-card-hover transition-all duration-200 flex flex-col shadow-[4px_4px_0px_#1a1a1a]">
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#1a1a1a] pb-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl neo-border flex items-center justify-center bg-[#fcf8f4] text-[#25D366] shadow-[4px_4px_0px_#1a1a1a] shrink-0">
                  <TbBrandWhatsapp size={36} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">WhatsApp Bot</h2>
                  <p className="text-sm text-[#4b607f] font-bold mt-1">Kirim notifikasi & terima perintah via WhatsApp</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-3 h-3 rounded-full ${statusColor[waStatus.status] || "bg-gray-400"}`} />
                <span className="text-sm font-bold text-[#1a1a1a]">{statusLabel[waStatus.status] || "Unknown"}</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              {waStatus.status === "qr_ready" && waStatus.qrCode && (
                <div className="mb-6 p-4 neo-border rounded-xl bg-white flex flex-col items-center gap-3">
                  <TbQrcode size={24} className="text-[#4b607f]" strokeWidth={2.2} />
                  <p className="text-sm font-bold text-[#1a1a1a]">Scan QR Code dengan WhatsApp:</p>
                  <img src={`data:image/png;base64,${waStatus.qrCode}`} alt="QR Code" className="w-48 h-48 neo-border rounded-lg" />
                </div>
              )}

              {waStatus.status === "connected" && (
                <div className="mb-6 p-5 neo-border rounded-xl bg-[#fcf8f4] space-y-4">
                  <h3 className="font-heading font-bold text-lg text-[#1a1a1a]">Kirim Pesan Test</h3>
                  <input
                    type="text"
                    placeholder="Nomor (628xxx)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="neo-input w-full bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Pesan test"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="neo-input w-full bg-white"
                  />
                  <button onClick={sendTestWA} disabled={loading.test} className="neo-btn bg-[#25D366] hover:bg-[#1da851] transition-colors duration-200 text-white w-full flex items-center justify-center gap-2 font-bold">
                    {loading.test ? <TbLoader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} /> : <TbSend className="w-5 h-5" strokeWidth={2.2} />}
                    Kirim Test
                  </button>
                </div>
              )}

              <div className="mt-auto pt-6 border-t-2 border-[#1a1a1a] flex flex-wrap gap-3">
                {waStatus.status === "disconnected" && (
                  <button onClick={connectWA} disabled={loading.wa} className="neo-btn bg-[#25D366] hover:bg-[#1da851] transition-colors duration-200 text-white flex-1 flex items-center justify-center gap-2 font-bold">
                    {loading.wa ? <TbLoader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} /> : <TbPlugConnected className="w-5 h-5" strokeWidth={2.2} />}
                    Hubungkan WhatsApp
                  </button>
                )}
                {waStatus.status === "connected" && (
                  <>
                    <button onClick={disconnectWA} disabled={loading.wa} className="neo-btn bg-white hover:bg-red-50 text-red-600 transition-colors duration-200 flex-1 flex items-center justify-center gap-2 font-bold">
                      <TbPlugConnectedX className="w-5 h-5" strokeWidth={2.2} /> Putuskan
                    </button>
                    <button onClick={resetWA} disabled={loading.wa} className="neo-btn bg-white hover:bg-[#e8d8c9] text-[#1a1a1a] transition-colors duration-200 flex items-center justify-center gap-2 font-bold">
                      <TbRefresh className="w-5 h-5" strokeWidth={2.2} /> Reset
                    </button>
                  </>
                )}
                {waStatus.status === "qr_ready" && (
                  <button onClick={fetchWAStatus} className="neo-btn bg-[#4b607f] hover:bg-[#3a4a63] transition-colors duration-200 text-white flex-1 flex items-center justify-center gap-2 font-bold">
                    <TbRefresh className="w-5 h-5" strokeWidth={2.2} /> Refresh Status
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Google Calendar Section */}
          <div className="neo-card p-6 sm:p-8 space-y-6 bg-white neo-card-hover transition-all duration-200 flex flex-col shadow-[4px_4px_0px_#1a1a1a]">
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#1a1a1a] pb-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl neo-border flex items-center justify-center bg-[#fcf8f4] text-[#4285F4] shadow-[4px_4px_0px_#1a1a1a] shrink-0">
                  <TbCalendar size={36} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Google Calendar</h2>
                  <p className="text-sm text-[#4b607f] font-bold mt-1">Sinkronisasi jadwal lab ke Google Calendar</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-3 h-3 rounded-full ${calendarConnected ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="text-sm font-bold text-[#1a1a1a]">{calendarConnected ? "Terhubung" : "Terputus"}</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="p-5 bg-[#fcf8f4] neo-border-sm rounded-xl space-y-3 mb-6">
                <h3 className="font-heading font-bold text-lg text-[#1a1a1a]">Cara kerja sinkronisasi:</h3>
                <ul className="space-y-2 text-sm font-medium text-[#4b607f]">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f3701e] mt-1.5 shrink-0" />
                    Hubungkan dengan akun Google Anda
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f3701e] mt-1.5 shrink-0" />
                    Jadwal lab yang melibatkan Anda akan otomatis ditambahkan
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f3701e] mt-1.5 shrink-0" />
                    Mendapat reminder 30 & 10 menit sebelum jadwal
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f3701e] mt-1.5 shrink-0" />
                    Otomatis berulang mingguan (16 minggu/semester)
                  </li>
                </ul>
              </div>

              {syncResult && (
                <div className="mb-6 p-4 neo-border rounded-xl bg-green-50 text-sm text-green-700 font-bold flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                  {syncResult}
                </div>
              )}

              <div className="mt-auto pt-6 border-t-2 border-[#1a1a1a] flex flex-wrap gap-3">
                {!calendarConnected ? (
                  <button onClick={connectCalendar} disabled={loading.calendar} className="neo-btn bg-[#4285F4] hover:bg-[#3367d6] transition-colors duration-200 text-white flex-1 flex items-center justify-center gap-2 font-bold">
                    {loading.calendar ? <TbLoader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} /> : <TbPlugConnected className="w-5 h-5" strokeWidth={2.2} />}
                    Hubungkan dengan Google
                  </button>
                ) : (
                  <>
                    <button onClick={syncCalendar} disabled={loading.sync} className="neo-btn bg-[#4b607f] hover:bg-[#3a4a63] transition-colors duration-200 text-white flex-1 flex items-center justify-center gap-2 font-bold">
                      {loading.sync ? <TbLoader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} /> : <TbRefresh className="w-5 h-5" strokeWidth={2.2} />}
                      Sinkronkan Jadwal
                    </button>
                    <button onClick={disconnectCalendar} disabled={loading.calendar} className="neo-btn bg-white hover:bg-red-50 text-red-600 transition-colors duration-200 w-full sm:w-auto flex items-center justify-center gap-2 font-bold">
                      <TbPlugConnectedX className="w-5 h-5" strokeWidth={2.2} /> Putuskan
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "absensi" && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[40vh]">
              <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
            </div>
          }
        >
          <AttendanceSettingsPage />
        </Suspense>
      )}
    </div>
  );
}
