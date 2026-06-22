"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TbBell,
  TbCheck,
  TbChecks,
  TbInfoCircle,
  TbLoader2,
  TbSettings,
  TbTrash,
  TbCalendarEvent,
  TbKey,
  TbClock,
  TbTicket,
  TbTargetArrow,
  TbBook2,
  TbCertificate
} from "react-icons/tb";
import type { IconType } from "react-icons";
import api from "@/services/api";
import {
  getCurrentPushSubscription,
  getPushPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/services/push-notifications";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TYPE_ICONS: Record<string, IconType> = {
  SCHEDULE_REMINDER: TbCalendarEvent,
  KEY_NOT_RETURNED: TbKey,
  ATTENDANCE_REMINDER: TbClock,
  TICKET_ASSIGNED: TbTicket,
  TICKET_RESOLVED: TbTicket,
  MISSION_AVAILABLE: TbTargetArrow,
  MISSION_VERIFIED: TbTargetArrow,
  LOGBOOK_VERIFIED: TbBook2,
  CERTIFICATE_ISSUED: TbCertificate,
  SYSTEM: TbInfoCircle,
};

const TYPE_COLORS: Record<string, string> = {
  SCHEDULE_REMINDER: "bg-blue-100 text-blue-600",
  KEY_NOT_RETURNED: "bg-red-100 text-red-600",
  ATTENDANCE_REMINDER: "bg-yellow-100 text-yellow-700",
  TICKET_ASSIGNED: "bg-orange-100 text-orange-600",
  TICKET_RESOLVED: "bg-green-100 text-green-600",
  MISSION_AVAILABLE: "bg-purple-100 text-purple-600",
  MISSION_VERIFIED: "bg-green-100 text-green-600",
  LOGBOOK_VERIFIED: "bg-blue-100 text-blue-600",
  CERTIFICATE_ISSUED: "bg-yellow-100 text-yellow-700",
  SYSTEM: "bg-gray-100 text-gray-600",
};

const TYPE_LABELS: Record<string, string> = {
  SCHEDULE_REMINDER: "Jadwal",
  KEY_NOT_RETURNED: "Kunci",
  ATTENDANCE_REMINDER: "Absensi",
  TICKET_ASSIGNED: "Ticket",
  TICKET_RESOLVED: "Ticket",
  MISSION_AVAILABLE: "Misi",
  MISSION_VERIFIED: "Misi",
  LOGBOOK_VERIFIED: "Logbook",
  CERTIFICATE_ISSUED: "Sertifikat",
  SYSTEM: "Sistem",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(() =>
    isPushSupported() ? Notification.permission : "unsupported"
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const unreadParam = filter === "unread" ? "&unreadOnly=true" : "";
      const res = await api.get<{ data: { notifications: Notification[]; pagination: PaginationData } }>(
        `/notifications?page=${page}&limit=20${unreadParam}`
      );
      setNotifications(res.data.notifications);
      setPagination(res.data.pagination);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchNotifications();
    });
  }, [fetchNotifications]);

  const refreshPushStatus = useCallback(async () => {
    const permission = await getPushPermission();
    setPushPermission(permission);
    if (permission === "unsupported") {
      setPushSubscribed(false);
      return;
    }
    const subscription = await getCurrentPushSubscription();
    setPushSubscribed(Boolean(subscription));
  }, []);

  useEffect(() => {
    if (!isPushSupported()) return;
    queueMicrotask(() => {
      void refreshPushStatus();
    });
  }, [refreshPushStatus]);

  const markAsRead = async (id: string) => {
    await api.patch<unknown>(`/notifications/${id}/read`, {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = async () => {
    await api.patch<unknown>("/notifications/read-all", {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const deleteNotification = async (id: string) => {
    await api.delete<unknown>(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const togglePush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushMessage("Push perangkat dimatikan.");
      } else {
        await subscribeToPush();
        setPushMessage("Push perangkat aktif. Notifikasi bisa muncul di bar HP.");
      }
      await refreshPushStatus();
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : "Gagal mengubah push notification");
      await refreshPushStatus();
    } finally {
      setPushBusy(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b-2 border-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] text-[#1a1a1a] flex items-center justify-center neo-border-sm shrink-0">
            <TbBell size={28} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">Notifikasi</h1>
            <p className="text-sm text-[#4b607f] font-medium mt-1">
              {pagination ? `${pagination.total} notifikasi total` : "Memuat..."}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-white neo-border-sm rounded-xl p-1.5 shadow-[2px_2px_0px_#1a1a1a] w-full sm:w-auto">
            <button
              onClick={() => { setFilter("all"); setPage(1); }}
              className={`flex-1 sm:flex-initial px-4 min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                filter === "all" ? "bg-[#4b607f] text-white" : "text-[#1a1a1a] hover:bg-[#e8d8c9]"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => { setFilter("unread"); setPage(1); }}
              className={`flex-1 sm:flex-initial px-4 min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                filter === "unread" ? "bg-[#4b607f] text-white" : "text-[#1a1a1a] hover:bg-[#e8d8c9]"
              }`}
            >
              Belum Dibaca {unreadCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-[#f3701e] text-white text-[10px] rounded-md">{unreadCount}</span>}
            </button>
          </div>

          {unreadCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={markAllRead}
              className="flex items-center justify-center gap-2 px-4 min-h-[44px] bg-white neo-border-sm rounded-xl text-sm font-bold text-[#1a1a1a] hover:bg-[#e8d8c9] transition-colors shadow-[2px_2px_0px_#1a1a1a] w-full sm:w-auto"
            >
              <TbChecks size={18} strokeWidth={2.2} className="text-[#4b607f]" />
              Baca Semua
            </motion.button>
          )}
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="bg-white neo-border rounded-2xl p-5 sm:p-6 shadow-[4px_4px_0px_#1a1a1a]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#f3701e] text-white neo-border-sm flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#1a1a1a]">
                <TbSettings size={24} strokeWidth={2.2} />
              </div>
              <div>
                <p className="font-heading text-lg sm:text-xl font-bold text-[#1a1a1a]">Push Notification Perangkat</p>
                <p className="text-sm text-[#4b607f] font-medium mt-1 leading-relaxed">
                  Aktifkan supaya pengingat penting muncul di bar HP walau LabKom tidak sedang dibuka.
                  Di iPhone/iPad, pasang LabKom ke Home Screen dulu.
                </p>
                <p className="text-xs text-[#5a5a5a] font-bold mt-2">
                  Status: {pushPermission === "unsupported" ? "Tidak didukung browser" : pushPermission === "denied" ? "Izin diblokir" : pushSubscribed ? "Aktif di perangkat ini" : "Belum aktif"}
                </p>
                {pushMessage && <p className="text-xs font-bold text-[#4b607f] mt-2">{pushMessage}</p>}
              </div>
            </div>

            <button
              type="button"
              onClick={togglePush}
              disabled={pushBusy || pushPermission === "unsupported" || pushPermission === "denied"}
              className={`neo-btn min-h-[44px] px-5 font-bold whitespace-nowrap ${
                pushSubscribed ? "bg-white text-[#1a1a1a]" : "bg-[#f3701e] text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pushBusy ? "Memproses..." : pushSubscribed ? "Nonaktifkan Push" : "Aktifkan Push"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white neo-border rounded-xl p-12 text-center shadow-[4px_4px_0px_#1a1a1a]">
            <TbLoader2 className="w-10 h-10 animate-spin text-[#f3701e] mx-auto" strokeWidth={2.2} />
            <p className="font-bold text-[#1a1a1a] mt-4">Memuat notifikasi...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-[#fcf8f4] neo-border-sm border-dashed border-2 rounded-xl p-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-white neo-border flex items-center justify-center mb-6 shadow-[4px_4px_0px_#1a1a1a]">
              <TbBell size={40} className="text-[#4b607f]/50" strokeWidth={2.2} />
            </div>
            <p className="font-heading text-xl font-bold text-[#1a1a1a]">Tidak ada notifikasi</p>
            <p className="text-[#4b607f] font-medium mt-2">
              {filter === "unread" ? "Semua notifikasi sudah dibaca" : "Belum ada notifikasi masuk"}
            </p>
          </div>
        ) : (
          notifications.map((notif, index) => {
            const Icon = TYPE_ICONS[notif.type] || TbInfoCircle;
            const colorClass = TYPE_COLORS[notif.type] || "bg-gray-100 text-gray-600";
            const label = TYPE_LABELS[notif.type] || "Lainnya";

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`flex flex-col sm:flex-row sm:items-start gap-4 p-5 bg-white neo-border-sm rounded-xl transition-all hover:bg-[#f5ede6] ${
                  !notif.isRead ? "border-l-[6px] border-l-[#f3701e] shadow-[4px_4px_0px_#1a1a1a]" : "shadow-[2px_2px_0px_#1a1a1a]"
                }`}
              >
                <div className="flex items-center sm:items-start gap-4 w-full">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass} neo-border-sm`}>
                    <Icon size={24} strokeWidth={2.2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border-2 border-current ${colorClass}`}>
                        {label}
                      </span>
                      {!notif.isRead && (
                        <span className="neo-badge px-2 py-0.5 bg-[#f3701e] text-white text-[10px] font-bold border-none shadow-none">
                          BARU
                        </span>
                      )}
                      <span className="text-xs text-[#4b607f] font-medium ml-auto sm:ml-0 bg-[#e8d8c9] px-2 py-1 rounded-md">
                        {formatDate(notif.createdAt)}
                      </span>
                    </div>
                    <p className={`text-base sm:text-lg ${!notif.isRead ? "font-bold font-heading" : "font-bold"} text-[#1a1a1a] mt-1`}>
                      {notif.title}
                    </p>
                    <p className="text-sm text-[#4b607f] font-medium mt-1 leading-relaxed">{notif.message}</p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-4">
                    {!notif.isRead && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => markAsRead(notif.id)}
                        className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-colors neo-border-sm shadow-[2px_2px_0px_#1a1a1a] text-[#4b607f]"
                        title="Tandai dibaca"
                      >
                        <TbCheck size={20} strokeWidth={2.2} />
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deleteNotification(notif.id)}
                      className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors neo-border-sm shadow-[2px_2px_0px_#1a1a1a] text-red-500"
                      title="Hapus"
                    >
                      <TbTrash size={20} strokeWidth={2.2} />
                    </motion.button>
                  </div>
                </div>
                
                <div className="flex sm:hidden items-center gap-2 mt-2 pt-4 border-t-2 border-[#1a1a1a]/10 w-full justify-end">
                  {!notif.isRead && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="neo-btn flex-1 py-2 bg-white text-[#1a1a1a] flex items-center justify-center gap-2 text-sm font-bold"
                    >
                      <TbCheck size={18} strokeWidth={2.2} className="text-[#25D366]" /> Dibaca
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    className="neo-btn flex-1 py-2 bg-white text-red-600 flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <TbTrash size={18} strokeWidth={2.2} /> Hapus
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 bg-white neo-border-sm rounded-lg text-xs font-bold disabled:opacity-50 neo-hover"
          >
            ← Prev
          </button>
          <span className="text-sm font-medium text-[#5a5a5a]">
            {page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-3 py-2 bg-white neo-border-sm rounded-lg text-xs font-bold disabled:opacity-50 neo-hover"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
