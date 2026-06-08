"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TbDeviceFloppy,
  TbLoader2,
  TbMapPin,
  TbSettings,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () => import("@/components/ui/location-picker").then((mod) => mod.LocationPicker),
  { ssr: false, loading: () => <div className="h-[280px] rounded-xl bg-[#e8d8c9] animate-pulse" /> }
);
import {
  AttendanceLocation,
  AttendanceSettings,
} from "@/types/index";

type TabKey = "general" | "locations";

type ApiWrapped<T> = {
  data: T;
  message?: string;
  success?: boolean;
};

type LocationPayload = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeter: number;
  isActive: boolean;
};

function isWrappedResponse<T>(value: unknown): value is ApiWrapped<T> {
  return typeof value === "object" && value !== null && "data" in value;
}

function extractResponseData<T>(value: T | ApiWrapped<T>): T {
  return isWrappedResponse<T>(value) ? value.data : value;
}

function ToggleSwitch({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors border-2 border-[#1a1a1a] ${
        checked ? "bg-[#4b607f]" : "bg-gray-300"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <div
        className={`h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </div>
  );
}

export default function AttendanceSettingsPage() {
  const globalToast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  const [settingsForm, setSettingsForm] = useState<AttendanceSettings | null>(null);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);

  const [isLoading, setIsLoading] = useState({
    initial: true,
    savingSettings: false,
    savingLocation: false,
  });



  const [locationForm, setLocationForm] = useState<LocationPayload>({
    name: "",
    latitude: 0,
    longitude: 0,
    radiusMeter: 50,
    isActive: true,
  });
  const [locationFormSyncKey, setLocationFormSyncKey] = useState<string>("initial");

  const tabItems = useMemo(
    () => [
      { key: "general" as const, label: "Pengaturan Umum", icon: TbSettings },
      { key: "locations" as const, label: "Lokasi Geofencing", icon: TbMapPin },
    ],
    []
  );



  const loadSettings = useCallback(async () => {
    const response = await api.get<AttendanceSettings | ApiWrapped<AttendanceSettings>>(
      "/attendance/settings"
    );
    setSettingsForm(extractResponseData(response));
  }, []);

  const loadLocations = useCallback(async () => {
    const response = await api.get<AttendanceLocation[] | ApiWrapped<AttendanceLocation[]>>(
      "/attendance/locations"
    );
    setLocations(extractResponseData(response));
  }, []);

  const initializeData = useCallback(async () => {
    setIsLoading((prev) => ({ ...prev, initial: true }));
    try {
      await Promise.all([loadSettings(), loadLocations()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat data pengaturan";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, initial: false }));
    }
  }, [loadLocations, loadSettings, globalToast]);

  useEffect(() => {
    queueMicrotask(() => {
      void initializeData();
    });
  }, [initializeData]);

  const handleSaveSettings = async () => {
    if (!settingsForm) return;

    setIsLoading((prev) => ({ ...prev, savingSettings: true }));
    try {
      await api.patch<ApiWrapped<AttendanceSettings> | AttendanceSettings>(
        "/attendance/settings",
        {
          isGeofencingEnabled: settingsForm.isGeofencingEnabled,
          defaultRadiusMeter: settingsForm.defaultRadiusMeter,
          lateToleranceMinutes: settingsForm.lateToleranceMinutes,
          checkoutGraceMinutes: settingsForm.checkoutGraceMinutes,
          forgotCheckoutAfterMinutes: settingsForm.forgotCheckoutAfterMinutes,
          isTaskRequired: settingsForm.isTaskRequired,
          isVerificationRequired: settingsForm.isVerificationRequired,
        }
      );
      globalToast.success("Pengaturan umum berhasil disimpan");
      await loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan pengaturan";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, savingSettings: false }));
    }
  };

  const campusLocation = locations[0] || null;
  const hasCampusLocation = campusLocation !== null;

  useEffect(() => {
    let cancelled = false;

    if (!hasCampusLocation) {
      if (locationFormSyncKey !== "default") {
        queueMicrotask(() => {
          if (cancelled) return;
          setLocationForm({
            name: "Kampus",
            latitude: 0,
            longitude: 0,
            radiusMeter: 50,
            isActive: true,
          });
          setLocationFormSyncKey("default");
        });
      }
      return () => {
        cancelled = true;
      };
    }

    const syncKey = `${campusLocation.id}:${campusLocation.updatedAt}`;
    if (locationFormSyncKey === syncKey) {
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLocationForm({
        name: campusLocation.name,
        latitude: campusLocation.latitude,
        longitude: campusLocation.longitude,
        radiusMeter: campusLocation.radiusMeter,
        isActive: campusLocation.isActive,
      });
      setLocationFormSyncKey(syncKey);
    });

    return () => {
      cancelled = true;
    };
  }, [campusLocation, hasCampusLocation, locationFormSyncKey]);

  const renderGeneralTab = () => {
    if (!settingsForm) return null;

    return (
      <div className="neo-card p-4 sm:p-6 bg-white space-y-6">
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] pb-4">
          <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Pengaturan Umum Absensi</h2>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isLoading.savingSettings}
            className="neo-btn bg-[#4b607f] text-white hover:bg-[#3d5069] flex items-center gap-2"
          >
            {isLoading.savingSettings ? (
              <TbLoader2 className="animate-spin" size={18} />
            ) : (
              <TbDeviceFloppy size={18} />
            )}
            Simpan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="neo-border bg-[#f5ede6] p-4 space-y-2">
            <p className="font-bold text-[#1a1a1a]">Aktifkan Geofencing</p>
            <p className="text-sm text-[#5a5a5a]">Wajib validasi lokasi saat check-in dan check-out.</p>
            <ToggleSwitch
              checked={settingsForm.isGeofencingEnabled}
              onToggle={() =>
                setSettingsForm((prev) =>
                  prev ? { ...prev, isGeofencingEnabled: !prev.isGeofencingEnabled } : prev
                )
              }
            />
          </div>

          <div className="neo-border bg-[#f5ede6] p-4 space-y-2">
            <p className="font-bold text-[#1a1a1a]">Radius Default (meter)</p>
            <input
              className="neo-input bg-white min-h-[44px] w-full"
              type="number"
              min={1}
              value={settingsForm.defaultRadiusMeter}
              onChange={(event) =>
                setSettingsForm((prev) =>
                  prev
                    ? { ...prev, defaultRadiusMeter: Number(event.target.value) }
                    : prev
                )
              }
            />
          </div>

          <div className="neo-border bg-[#f5ede6] p-4 space-y-2">
            <p className="font-bold text-[#1a1a1a]">Toleransi Terlambat (menit)</p>
            <input
              className="neo-input bg-white min-h-[44px] w-full"
              type="number"
              min={0}
              value={settingsForm.lateToleranceMinutes}
              onChange={(event) =>
                setSettingsForm((prev) =>
                  prev
                    ? { ...prev, lateToleranceMinutes: Number(event.target.value) }
                    : prev
                )
              }
            />
          </div>

          <div className="neo-border bg-[#f5ede6] p-4 space-y-2">
            <p className="font-bold text-[#1a1a1a]">Checkout Grace (menit)</p>
            <input
              className="neo-input bg-white min-h-[44px] w-full"
              type="number"
              min={0}
              value={settingsForm.checkoutGraceMinutes}
              onChange={(event) =>
                setSettingsForm((prev) =>
                  prev
                    ? { ...prev, checkoutGraceMinutes: Number(event.target.value) }
                    : prev
                )
              }
            />
          </div>

          <div className="neo-border bg-[#f5ede6] p-4 space-y-2">
            <p className="font-bold text-[#1a1a1a]">Lupa Checkout Setelah (menit)</p>
            <input
              className="neo-input bg-white min-h-[44px] w-full"
              type="number"
              min={1}
              value={settingsForm.forgotCheckoutAfterMinutes}
              onChange={(event) =>
                setSettingsForm((prev) =>
                  prev
                    ? { ...prev, forgotCheckoutAfterMinutes: Number(event.target.value) }
                    : prev
                )
              }
            />
          </div>

          <div className="neo-border bg-[#f5ede6] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1a1a1a]">Task Harian Wajib</p>
              <ToggleSwitch
                checked={settingsForm.isTaskRequired}
                onToggle={() =>
                  setSettingsForm((prev) =>
                    prev ? { ...prev, isTaskRequired: !prev.isTaskRequired } : prev
                  )
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1a1a1a]">Verifikasi Koordinator Wajib</p>
              <ToggleSwitch
                checked={settingsForm.isVerificationRequired}
                onToggle={() =>
                  setSettingsForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          isVerificationRequired: !prev.isVerificationRequired,
                        }
                      : prev
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLocationsTab = () => {
    const hasLocation = hasCampusLocation;

    const handleSaveCampusLocation = async () => {
      setIsLoading((prev) => ({ ...prev, savingLocation: true }));
      try {
        if (hasLocation) {
          await api.patch(`/attendance/locations/${campusLocation.id}`, locationForm);
          globalToast.success("Lokasi kampus berhasil diperbarui");
        } else {
          await api.post("/attendance/locations", locationForm);
          globalToast.success("Lokasi kampus berhasil disimpan");
        }
        await loadLocations();
      } catch (error) {
        globalToast.error(error instanceof Error ? error.message : "Gagal menyimpan lokasi");
      } finally {
        setIsLoading((prev) => ({ ...prev, savingLocation: false }));
      }
    };

    return (
      <div className="neo-card p-3 sm:p-5 bg-white space-y-4">
        <div className="border-b-2 border-[#1a1a1a]/10 pb-3">
          <h2 className="font-heading text-lg sm:text-xl font-bold text-[#1a1a1a]">Lokasi Absensi Kampus</h2>
          <p className="text-xs sm:text-sm text-[#5a5a5a] mt-1">
            Set titik lokasi kampus untuk validasi GPS saat check-in/check-out aslab.
          </p>
        </div>

        {hasLocation && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
            <TbMapPin className="w-5 h-5 text-green-700 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-green-800">{campusLocation.name}</p>
              <p className="text-xs text-green-700 font-mono">
                {campusLocation.latitude.toFixed(6)}, {campusLocation.longitude.toFixed(6)} · {campusLocation.radiusMeter}m
              </p>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-green-100 text-green-700">
              {campusLocation.isActive ? "Aktif" : "Nonaktif"}
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Nama Lokasi</label>
            <input
              type="text"
              className="neo-input bg-white min-h-[44px] w-full mt-1"
              value={locationForm.name}
              onChange={(e) => setLocationForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Contoh: Kampus FMIPA"
            />
          </div>

          <LocationPicker
            latitude={locationForm.latitude}
            longitude={locationForm.longitude}
            radiusMeter={locationForm.radiusMeter}
            onLocationChange={(lat, lng) =>
              setLocationForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Latitude</label>
              <input
                type="number"
                step="any"
                className="neo-input bg-white min-h-[44px] w-full text-sm font-mono mt-1"
                value={locationForm.latitude}
                onChange={(e) => setLocationForm((prev) => ({ ...prev, latitude: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Longitude</label>
              <input
                type="number"
                step="any"
                className="neo-input bg-white min-h-[44px] w-full text-sm font-mono mt-1"
                value={locationForm.longitude}
                onChange={(e) => setLocationForm((prev) => ({ ...prev, longitude: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-[#5a5a5a]">Radius Absensi (meter)</label>
            <p className="text-[10px] text-[#5a5a5a] mb-1">Jarak maksimal dari titik lokasi yang masih dianggap valid untuk absen.</p>
            <input
              type="number"
              min={10}
              className="neo-input bg-white min-h-[44px] w-full mt-1"
              value={locationForm.radiusMeter}
              onChange={(e) => setLocationForm((prev) => ({ ...prev, radiusMeter: Number(e.target.value) }))}
              placeholder="50"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveCampusLocation}
          disabled={isLoading.savingLocation || locationForm.latitude === 0}
          className="neo-btn min-h-[48px] w-full bg-[#4b607f] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading.savingLocation ? (
            <TbLoader2 className="animate-spin w-5 h-5" />
          ) : (
            <TbDeviceFloppy className="w-5 h-5" />
          )}
          {hasLocation ? "Update Lokasi Kampus" : "Simpan Lokasi Kampus"}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5ede6] p-6 md:p-8 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="neo-card p-4 sm:p-6 bg-white"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">
              Pengaturan Absensi Koordinator
            </h1>
            <p className="text-[#5a5a5a] font-semibold mt-2">
              Kelola konfigurasi geofencing dan lokasi absensi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void initializeData()}
            className="neo-btn bg-[#4b607f] text-white hover:bg-[#3d5069]"
          >
            Muat Ulang Data
          </button>
        </div>
      </motion.div>

      <div className="neo-card p-3 bg-white">
        <div className="grid grid-cols-2 gap-2">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`neo-btn flex items-center justify-center gap-2 font-bold text-sm md:text-base ${
                  isActive
                    ? "bg-[#4b607f] text-white"
                    : "bg-[#f5ede6] text-[#1a1a1a] hover:bg-[#e8d8c9]"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading.initial ? (
        <div className="neo-card bg-white p-12 flex items-center justify-center gap-3 text-[#1a1a1a] font-bold">
          <TbLoader2 className="animate-spin" size={22} />
          Memuat pengaturan absensi...
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "general" && renderGeneralTab()}
            {activeTab === "locations" && renderLocationsTab()}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
