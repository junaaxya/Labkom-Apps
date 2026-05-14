"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  TbCheck,
  TbClock,
  TbDeviceFloppy,
  TbEdit,
  TbLoader2,
  TbMapPin,
  TbPlus,
  TbSettings,
  TbTrash,
  TbUserCheck,
  TbX,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { MobileCard } from "@/components/ui/mobile-card";
import {
  AttendanceCorrectionRequest,
  AttendanceLocation,
  AttendanceSettings,
  CorrectionRequestStatus,
  TaskCategoryConfig,
} from "@/types/index";

type TabKey = "general" | "locations" | "categories" | "corrections";

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

type CategoryPayload = {
  name: string;
  description: string;
  defaultPoints: number;
  isEvidenceRequired: boolean;
  isActive: boolean;
};

type ReviewStatus = Extract<CorrectionRequestStatus, "APPROVED" | "REJECTED">;

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

function ModalContainer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-2xl neo-card bg-[#f5ede6] p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl sm:text-2xl font-bold text-[#1a1a1a] truncate">{title}</h3>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg neo-btn bg-white hover:bg-[#e8d8c9] text-[#1a1a1a] flex-shrink-0"
            type="button"
          >
            <TbX size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function AttendanceSettingsPage() {
  const globalToast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  const [settingsForm, setSettingsForm] = useState<AttendanceSettings | null>(null);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [categories, setCategories] = useState<TaskCategoryConfig[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);

  const [isLoading, setIsLoading] = useState({
    initial: true,
    savingSettings: false,
    savingLocation: false,
    deletingLocationId: "",
    savingCategory: false,
    deletingCategoryId: "",
    reviewingCorrection: false,
  });



  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AttendanceLocation | null>(null);
  const [locationForm, setLocationForm] = useState<LocationPayload>({
    name: "",
    latitude: 0,
    longitude: 0,
    radiusMeter: 50,
    isActive: true,
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TaskCategoryConfig | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryPayload>({
    name: "",
    description: "",
    defaultPoints: 0,
    isEvidenceRequired: false,
    isActive: true,
  });

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingCorrection, setReviewingCorrection] =
    useState<AttendanceCorrectionRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("APPROVED");
  const [reviewNote, setReviewNote] = useState("");

  const tabItems = useMemo(
    () => [
      { key: "general" as const, label: "Pengaturan Umum", icon: TbSettings },
      { key: "locations" as const, label: "Lokasi Geofencing", icon: TbMapPin },
      { key: "categories" as const, label: "Kategori Task", icon: TbClock },
      { key: "corrections" as const, label: "Koreksi Absensi", icon: TbUserCheck },
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

  const loadCategories = useCallback(async () => {
    const response = await api.get<TaskCategoryConfig[] | ApiWrapped<TaskCategoryConfig[]>>(
      "/attendance/task-categories"
    );
    setCategories(extractResponseData(response));
  }, []);

  const loadCorrections = useCallback(async () => {
    const response = await api.get<
      AttendanceCorrectionRequest[] | ApiWrapped<AttendanceCorrectionRequest[]>
    >("/attendance/corrections/pending");
    setCorrections(extractResponseData(response));
  }, []);

  const initializeData = useCallback(async () => {
    setIsLoading((prev) => ({ ...prev, initial: true }));
    try {
      await Promise.all([loadSettings(), loadLocations(), loadCategories(), loadCorrections()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal memuat data pengaturan";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, initial: false }));
    }
  }, [loadCategories, loadCorrections, loadLocations, loadSettings, globalToast]);

  useEffect(() => {
    queueMicrotask(() => {
      void initializeData();
    });
  }, [initializeData]);

  const resetLocationForm = () => {
    setLocationForm({
      name: "",
      latitude: 0,
      longitude: 0,
      radiusMeter: 50,
      isActive: true,
    });
    setEditingLocation(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      description: "",
      defaultPoints: 0,
      isEvidenceRequired: false,
      isActive: true,
    });
    setEditingCategory(null);
  };

  const openCreateLocationModal = () => {
    resetLocationForm();
    setIsLocationModalOpen(true);
  };

  const openEditLocationModal = (location: AttendanceLocation) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeter: location.radiusMeter,
      isActive: location.isActive,
    });
    setIsLocationModalOpen(true);
  };

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category: TaskCategoryConfig) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      defaultPoints: category.defaultPoints,
      isEvidenceRequired: category.isEvidenceRequired,
      isActive: category.isActive,
    });
    setIsCategoryModalOpen(true);
  };

  const openReviewModal = (correction: AttendanceCorrectionRequest, status: ReviewStatus) => {
    setReviewingCorrection(correction);
    setReviewStatus(status);
    setReviewNote("");
    setIsReviewModalOpen(true);
  };

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

  const handleSaveLocation = async () => {
    setIsLoading((prev) => ({ ...prev, savingLocation: true }));
    try {
      if (editingLocation) {
        await api.patch<ApiWrapped<AttendanceLocation> | AttendanceLocation>(
          `/attendance/locations/${editingLocation.id}`,
          locationForm
        );
        globalToast.success("Lokasi geofencing berhasil diperbarui");
      } else {
        await api.post<ApiWrapped<AttendanceLocation> | AttendanceLocation>(
          "/attendance/locations",
          locationForm
        );
        globalToast.success("Lokasi geofencing berhasil ditambahkan");
      }

      setIsLocationModalOpen(false);
      resetLocationForm();
      await loadLocations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan lokasi";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, savingLocation: false }));
    }
  };

  const handleDeleteLocation = async (location: AttendanceLocation) => {
    const confirmed = window.confirm(`Hapus lokasi ${location.name}?`);
    if (!confirmed) return;

    setIsLoading((prev) => ({ ...prev, deletingLocationId: location.id }));
    try {
      await api.delete(`/attendance/locations/${location.id}`);
      globalToast.success("Lokasi geofencing berhasil dihapus");
      await loadLocations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus lokasi";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, deletingLocationId: "" }));
    }
  };

  const handleSaveCategory = async () => {
    setIsLoading((prev) => ({ ...prev, savingCategory: true }));
    try {
      if (editingCategory) {
        await api.patch<ApiWrapped<TaskCategoryConfig> | TaskCategoryConfig>(
          `/attendance/task-categories/${editingCategory.id}`,
          categoryForm
        );
        globalToast.success("Kategori task berhasil diperbarui");
      } else {
        await api.post<ApiWrapped<TaskCategoryConfig> | TaskCategoryConfig>(
          "/attendance/task-categories",
          categoryForm
        );
        globalToast.success("Kategori task berhasil ditambahkan");
      }

      setIsCategoryModalOpen(false);
      resetCategoryForm();
      await loadCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan kategori";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, savingCategory: false }));
    }
  };

  const handleDeleteCategory = async (category: TaskCategoryConfig) => {
    const confirmed = window.confirm(`Hapus kategori ${category.name}?`);
    if (!confirmed) return;

    setIsLoading((prev) => ({ ...prev, deletingCategoryId: category.id }));
    try {
      await api.delete(`/attendance/task-categories/${category.id}`);
      globalToast.success("Kategori task berhasil dihapus");
      await loadCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menghapus kategori";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, deletingCategoryId: "" }));
    }
  };

  const handleReviewCorrection = async () => {
    if (!reviewingCorrection) return;

    setIsLoading((prev) => ({ ...prev, reviewingCorrection: true }));
    try {
      await api.patch(
        `/attendance/corrections/${reviewingCorrection.id}/review`,
        {
          status: reviewStatus,
          reviewNote,
        }
      );
      globalToast.success("Koreksi absensi berhasil direview");
      setIsReviewModalOpen(false);
      setReviewingCorrection(null);
      setReviewNote("");
      await loadCorrections();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal review koreksi absensi";
      globalToast.error(message);
    } finally {
      setIsLoading((prev) => ({ ...prev, reviewingCorrection: false }));
    }
  };

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
    return (
      <div className="neo-card p-4 sm:p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] pb-4">
          <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Lokasi Geofencing</h2>
          <button
            type="button"
            onClick={openCreateLocationModal}
            className="neo-btn bg-[#f3701e] text-white hover:bg-[#d95f10] flex items-center gap-2"
          >
            <TbPlus size={18} />
            Tambah Lokasi
          </button>
        </div>

        <div className="space-y-3 md:hidden">
          {locations.map((location) => (
            <MobileCard
              key={location.id}
              title={location.name}
              badge={
                <span className={`neo-badge px-3 py-1 text-xs font-bold ${location.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                  {location.isActive ? "Active" : "Inactive"}
                </span>
              }
              fields={[
                { label: "Latitude", value: String(location.latitude) },
                { label: "Longitude", value: String(location.longitude) },
                { label: "Radius (m)", value: String(location.radiusMeter), fullWidth: false },
              ]}
              actions={[
                {
                  label: "Edit",
                  icon: <TbEdit size={16} />,
                  onClick: () => openEditLocationModal(location),
                  variant: "secondary",
                },
                {
                  label: "Hapus",
                  icon: isLoading.deletingLocationId === location.id ? <TbLoader2 className="animate-spin" size={16} /> : <TbTrash size={16} />,
                  onClick: () => handleDeleteLocation(location),
                  variant: "danger",
                  disabled: isLoading.deletingLocationId === location.id,
                },
              ]}
            />
          ))}
          {locations.length === 0 && (
            <div className="neo-card p-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
              Belum ada lokasi geofencing.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto neo-border">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#e8d8c9]">
              <tr className="text-left text-[#1a1a1a]">
                <th className="px-4 py-3 font-bold">Nama</th>
                <th className="px-4 py-3 font-bold">Latitude</th>
                <th className="px-4 py-3 font-bold">Longitude</th>
                <th className="px-4 py-3 font-bold">Radius (m)</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="border-t-2 border-[#1a1a1a] bg-[#f5ede6]">
                  <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{location.name}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{location.latitude}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{location.longitude}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{location.radiusMeter}</td>
                  <td className="px-4 py-3">
                    <span className={`neo-badge px-3 py-1 text-xs font-bold ${location.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                      {location.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="neo-btn bg-white hover:bg-[#e8d8c9]" onClick={() => openEditLocationModal(location)}>
                        <TbEdit size={18} />
                      </button>
                      <button
                        type="button"
                        className="neo-btn bg-white hover:bg-red-100 text-red-600"
                        onClick={() => handleDeleteLocation(location)}
                        disabled={isLoading.deletingLocationId === location.id}
                      >
                        {isLoading.deletingLocationId === location.id ? (
                          <TbLoader2 className="animate-spin" size={18} />
                        ) : (
                          <TbTrash size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
                    Belum ada lokasi geofencing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCategoriesTab = () => {
    return (
      <div className="neo-card p-4 sm:p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] pb-4">
          <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Kategori Task</h2>
          <button
            type="button"
            onClick={openCreateCategoryModal}
            className="neo-btn bg-[#f3701e] text-white hover:bg-[#d95f10] flex items-center gap-2"
          >
            <TbPlus size={18} />
            Tambah Kategori
          </button>
        </div>

        <div className="space-y-3 md:hidden">
          {categories.map((category) => (
            <MobileCard
              key={category.id}
              title={category.name}
              subtitle={category.description || undefined}
              badge={
                <span className={`neo-badge px-3 py-1 text-xs font-bold ${category.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                  {category.isActive ? "Active" : "Inactive"}
                </span>
              }
              fields={[
                { label: "Default Points", value: String(category.defaultPoints) },
                {
                  label: "Evidence Required",
                  value: (
                    <span className={`neo-badge px-2 py-0.5 text-xs font-bold ${category.isEvidenceRequired ? "bg-[#4b607f] text-white" : "bg-gray-200 text-gray-700"}`}>
                      {category.isEvidenceRequired ? "Ya" : "Tidak"}
                    </span>
                  ),
                },
              ]}
              actions={[
                {
                  label: "Edit",
                  icon: <TbEdit size={16} />,
                  onClick: () => openEditCategoryModal(category),
                  variant: "secondary",
                },
                {
                  label: "Hapus",
                  icon: isLoading.deletingCategoryId === category.id ? <TbLoader2 className="animate-spin" size={16} /> : <TbTrash size={16} />,
                  onClick: () => handleDeleteCategory(category),
                  variant: "danger",
                  disabled: isLoading.deletingCategoryId === category.id,
                },
              ]}
            />
          ))}
          {categories.length === 0 && (
            <div className="neo-card p-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
              Belum ada kategori task.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto neo-border">
          <table className="w-full min-w-[980px]">
            <thead className="bg-[#e8d8c9]">
              <tr className="text-left text-[#1a1a1a]">
                <th className="px-4 py-3 font-bold">Nama</th>
                <th className="px-4 py-3 font-bold">Deskripsi</th>
                <th className="px-4 py-3 font-bold">Default Points</th>
                <th className="px-4 py-3 font-bold">Evidence Required</th>
                <th className="px-4 py-3 font-bold">Active</th>
                <th className="px-4 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t-2 border-[#1a1a1a] bg-[#f5ede6]">
                  <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{category.name}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{category.description || "-"}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{category.defaultPoints}</td>
                  <td className="px-4 py-3">
                    <span className={`neo-badge px-3 py-1 text-xs font-bold ${category.isEvidenceRequired ? "bg-[#4b607f] text-white" : "bg-gray-200 text-gray-700"}`}>
                      {category.isEvidenceRequired ? "Ya" : "Tidak"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`neo-badge px-3 py-1 text-xs font-bold ${category.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="neo-btn bg-white hover:bg-[#e8d8c9]" onClick={() => openEditCategoryModal(category)}>
                        <TbEdit size={18} />
                      </button>
                      <button
                        type="button"
                        className="neo-btn bg-white hover:bg-red-100 text-red-600"
                        onClick={() => handleDeleteCategory(category)}
                        disabled={isLoading.deletingCategoryId === category.id}
                      >
                        {isLoading.deletingCategoryId === category.id ? (
                          <TbLoader2 className="animate-spin" size={18} />
                        ) : (
                          <TbTrash size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
                    Belum ada kategori task.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCorrectionsTab = () => {
    return (
      <div className="neo-card p-4 sm:p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] pb-4">
          <h2 className="font-heading text-2xl font-bold text-[#1a1a1a]">Koreksi Absensi Pending</h2>
        </div>

        <div className="space-y-3 md:hidden">
          {corrections.map((correction) => (
            <MobileCard
              key={correction.id}
              title={correction.user?.name || "-"}
              subtitle={correction.requestType}
              fields={[
                { label: "Old Value", value: correction.oldValue || "-" },
                { label: "New Value", value: correction.newValue || "-" },
                { label: "Reason", value: correction.reason, fullWidth: true },
                { label: "Date", value: new Date(correction.createdAt).toLocaleString("id-ID") },
              ]}
              actions={[
                {
                  label: "Approve",
                  icon: <TbCheck size={16} />,
                  onClick: () => openReviewModal(correction, "APPROVED"),
                  variant: "success",
                },
                {
                  label: "Reject",
                  icon: <TbX size={16} />,
                  onClick: () => openReviewModal(correction, "REJECTED"),
                  variant: "danger",
                },
              ]}
            />
          ))}
          {corrections.length === 0 && (
            <div className="neo-card p-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
              Tidak ada permintaan koreksi pending.
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto neo-border">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-[#e8d8c9]">
              <tr className="text-left text-[#1a1a1a]">
                <th className="px-4 py-3 font-bold">Aslab Name</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Old Value</th>
                <th className="px-4 py-3 font-bold">New Value</th>
                <th className="px-4 py-3 font-bold">Reason</th>
                <th className="px-4 py-3 font-bold">Date</th>
                <th className="px-4 py-3 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((correction) => (
                <tr key={correction.id} className="border-t-2 border-[#1a1a1a] bg-[#f5ede6]">
                  <td className="px-4 py-3 font-semibold text-[#1a1a1a]">{correction.user?.name || "-"}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{correction.requestType}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{correction.oldValue || "-"}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{correction.newValue || "-"}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{correction.reason}</td>
                  <td className="px-4 py-3 text-[#5a5a5a]">{new Date(correction.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" className="neo-btn bg-green-100 hover:bg-green-200 text-green-700" onClick={() => openReviewModal(correction, "APPROVED")}>
                        <TbCheck size={18} />
                      </button>
                      <button type="button" className="neo-btn bg-red-100 hover:bg-red-200 text-red-700" onClick={() => openReviewModal(correction, "REJECTED")}>
                        <TbX size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {corrections.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5a5a5a] font-semibold bg-[#f5ede6]">
                    Tidak ada permintaan koreksi pending.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              Kelola konfigurasi geofencing, task harian, dan review koreksi absensi.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
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
            {activeTab === "categories" && renderCategoriesTab()}
            {activeTab === "corrections" && renderCorrectionsTab()}
          </motion.div>
        </AnimatePresence>
      )}



      <AnimatePresence>
        {isLocationModalOpen && (
          <ModalContainer
            title={editingLocation ? "Edit Lokasi Geofencing" : "Tambah Lokasi Geofencing"}
            onClose={() => {
              setIsLocationModalOpen(false);
              resetLocationForm();
            }}
          >
            <div className="space-y-4">
              <input
                type="text"
                className="neo-input bg-white min-h-[44px] w-full"
                value={locationForm.name}
                onChange={(event) =>
                  setLocationForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nama lokasi"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="number"
                  step="any"
                  className="neo-input bg-white min-h-[44px] w-full"
                  value={locationForm.latitude}
                  onChange={(event) =>
                    setLocationForm((prev) => ({
                      ...prev,
                      latitude: Number(event.target.value),
                    }))
                  }
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="any"
                  className="neo-input bg-white min-h-[44px] w-full"
                  value={locationForm.longitude}
                  onChange={(event) =>
                    setLocationForm((prev) => ({
                      ...prev,
                      longitude: Number(event.target.value),
                    }))
                  }
                  placeholder="Longitude"
                />
              </div>
              <input
                type="number"
                min={1}
                className="neo-input bg-white min-h-[44px] w-full"
                value={locationForm.radiusMeter}
                onChange={(event) =>
                  setLocationForm((prev) => ({
                    ...prev,
                    radiusMeter: Number(event.target.value),
                  }))
                }
                placeholder="Radius dalam meter"
              />
              <div className="neo-border bg-[#e8d8c9] p-3 flex items-center justify-between">
                <p className="font-bold text-[#1a1a1a]">Lokasi Aktif</p>
                <ToggleSwitch
                  checked={locationForm.isActive}
                  onToggle={() =>
                    setLocationForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLocationModalOpen(false);
                    resetLocationForm();
                  }}
                  className="neo-btn bg-white hover:bg-[#e8d8c9]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  disabled={isLoading.savingLocation}
                  className="neo-btn bg-[#4b607f] text-white hover:bg-[#3d5069] flex items-center gap-2"
                >
                  {isLoading.savingLocation ? (
                    <TbLoader2 className="animate-spin" size={18} />
                  ) : (
                    <TbDeviceFloppy size={18} />
                  )}
                  Simpan
                </button>
              </div>
            </div>
          </ModalContainer>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCategoryModalOpen && (
          <ModalContainer
            title={editingCategory ? "Edit Kategori Task" : "Tambah Kategori Task"}
            onClose={() => {
              setIsCategoryModalOpen(false);
              resetCategoryForm();
            }}
          >
            <div className="space-y-4">
              <input
                type="text"
                className="neo-input bg-white min-h-[44px] w-full"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nama kategori"
              />
              <textarea
                className="neo-input bg-white min-h-[96px] w-full"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Deskripsi"
              />
              <input
                type="number"
                min={0}
                className="neo-input bg-white min-h-[44px] w-full"
                value={categoryForm.defaultPoints}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    defaultPoints: Number(event.target.value),
                  }))
                }
                placeholder="Default points"
              />
              <div className="neo-border bg-[#e8d8c9] p-3 flex items-center justify-between">
                <p className="font-bold text-[#1a1a1a]">Evidence Wajib</p>
                <ToggleSwitch
                  checked={categoryForm.isEvidenceRequired}
                  onToggle={() =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      isEvidenceRequired: !prev.isEvidenceRequired,
                    }))
                  }
                />
              </div>
              <div className="neo-border bg-[#e8d8c9] p-3 flex items-center justify-between">
                <p className="font-bold text-[#1a1a1a]">Kategori Aktif</p>
                <ToggleSwitch
                  checked={categoryForm.isActive}
                  onToggle={() =>
                    setCategoryForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    resetCategoryForm();
                  }}
                  className="neo-btn bg-white hover:bg-[#e8d8c9]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  disabled={isLoading.savingCategory}
                  className="neo-btn bg-[#4b607f] text-white hover:bg-[#3d5069] flex items-center gap-2"
                >
                  {isLoading.savingCategory ? (
                    <TbLoader2 className="animate-spin" size={18} />
                  ) : (
                    <TbDeviceFloppy size={18} />
                  )}
                  Simpan
                </button>
              </div>
            </div>
          </ModalContainer>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReviewModalOpen && reviewingCorrection && (
          <ModalContainer
            title="Review Koreksi Absensi"
            onClose={() => {
              setIsReviewModalOpen(false);
              setReviewingCorrection(null);
              setReviewNote("");
            }}
          >
            <div className="space-y-4">
              <div className="neo-border bg-[#f5ede6] p-4 space-y-1 text-sm text-[#1a1a1a] font-semibold">
                <p>Aslab: {reviewingCorrection.user?.name || "-"}</p>
                <p>Type: {reviewingCorrection.requestType}</p>
                <p>Old Value: {reviewingCorrection.oldValue || "-"}</p>
                <p>New Value: {reviewingCorrection.newValue || "-"}</p>
              </div>

              <div className="neo-border bg-[#e8d8c9] p-3 flex items-center justify-between">
                <p className="font-bold text-[#1a1a1a]">Status Review</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("APPROVED")}
                    className={`neo-btn ${
                      reviewStatus === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : "bg-white text-[#1a1a1a]"
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus("REJECTED")}
                    className={`neo-btn ${
                      reviewStatus === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-white text-[#1a1a1a]"
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <textarea
                className="neo-input bg-white min-h-[96px] w-full"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Catatan review"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setReviewingCorrection(null);
                    setReviewNote("");
                  }}
                  className="neo-btn bg-white hover:bg-[#e8d8c9]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReviewCorrection}
                  disabled={isLoading.reviewingCorrection}
                  className="neo-btn bg-[#4b607f] text-white hover:bg-[#3d5069] flex items-center gap-2"
                >
                  {isLoading.reviewingCorrection ? (
                    <TbLoader2 className="animate-spin" size={18} />
                  ) : (
                    <TbCheck size={18} />
                  )}
                  Simpan Review
                </button>
              </div>
            </div>
          </ModalContainer>
        )}
      </AnimatePresence>
    </div>
  );
}
