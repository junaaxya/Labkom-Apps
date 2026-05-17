"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbBell,
  TbCheck,
  TbChecks,
  TbCalendarEvent,
  TbKey,
  TbClock,
  TbTicket,
  TbTargetArrow,
  TbBook2,
  TbCertificate,
  TbInfoCircle,
  TbTrash,
  TbX,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import api from "@/services/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  return `${days}h lalu`;
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ data: { count: number } }>("/notifications/unread-count");
      setUnreadCount(res.data.count);
    } catch {
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { notifications: Notification[] } }>("/notifications?limit=15");
      setNotifications(res.data.notifications);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchUnreadCount();
    });

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
    const es = new EventSource(`${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`);

    es.addEventListener("notification", (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [data, ...prev].slice(0, 15));
      setUnreadCount((prev) => prev + 1);
    });

    es.onerror = () => {
      es.close();
    };

    eventSourceRef.current = es;
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      void fetchNotifications();
    });
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    await api.patch<unknown>(`/notifications/${id}/read`, {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.patch<unknown>("/notifications/read-all", {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    await api.delete<unknown>(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div ref={panelRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Buka notifikasi"
        className="relative w-10 h-10 flex items-center justify-center rounded-lg bg-white neo-border-sm neo-shadow-sm neo-hover"
      >
        <TbBell className="w-5 h-5 text-[#1a1a1a]" strokeWidth={2.2} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-[#f3701e] neo-border-sm rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>


      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setIsOpen(false)}
                className="md:hidden fixed inset-0 z-[60]"
                aria-hidden="true"
              />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring" as const, stiffness: 320, damping: 26 }}
                role="dialog"
                aria-label="Notifikasi"
                className="md:hidden fixed left-3 right-3 z-[70] bg-white neo-border rounded-2xl shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
                style={{
                  top: "calc(env(safe-area-inset-top, 0px) + 64px)",
                  maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 96px - env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#1a1a1a] bg-[#f5ede6]">
                  <div className="flex items-center gap-2 min-w-0">
                    <TbBell className="w-4 h-4 text-[#f3701e] shrink-0" strokeWidth={2.5} />
                    <h3 className="font-heading font-bold text-sm text-[#1a1a1a] truncate">Notifikasi</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-[#f3701e] text-white">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] font-bold text-[#4b607f] active:text-[#f3701e] active:bg-white/60 px-2 py-1 rounded-md flex items-center gap-1"
                        aria-label="Tandai semua dibaca"
                      >
                        <TbChecks className="w-3.5 h-3.5" />
                        Baca semua
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      aria-label="Tutup notifikasi"
                      className="w-9 h-9 rounded-lg flex items-center justify-center active:bg-white/60"
                    >
                      <TbX className="w-4 h-4 text-[#5a5a5a]" />
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto overscroll-contain flex-1">
                  {loading && notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#5a5a5a]">Memuat...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <TbBell className="w-9 h-9 mx-auto text-[#ccc] mb-2" strokeWidth={1.6} />
                      <p className="text-xs text-[#5a5a5a]">Belum ada notifikasi</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const Icon = TYPE_ICONS[notif.type] || TbInfoCircle;
                      const colorClass = TYPE_COLORS[notif.type] || "bg-gray-100 text-gray-600";
                      return (
                        <div
                          key={notif.id}
                          className={`flex items-start gap-3 px-3 py-3 border-b border-[#e8d8c9] last:border-0 active:bg-[#f9f3ed] transition-colors ${
                            !notif.isRead ? "bg-[#fef9f4]" : ""
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] leading-tight ${!notif.isRead ? "font-bold" : "font-semibold"} text-[#1a1a1a]`}>
                              {notif.title}
                            </p>
                            <p className="text-[11px] text-[#5a5a5a] mt-0.5 line-clamp-2 leading-snug">{notif.message}</p>
                            <p className="text-[10px] text-[#999] mt-1">{timeAgo(notif.createdAt)}</p>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            {!notif.isRead && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="w-8 h-8 rounded-md flex items-center justify-center active:bg-[#e8d8c9]"
                                aria-label="Tandai dibaca"
                              >
                                <TbCheck className="w-4 h-4 text-[#4b607f]" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notif.id)}
                              className="w-8 h-8 rounded-md flex items-center justify-center active:bg-red-50"
                              aria-label="Hapus notifikasi"
                            >
                              <TbTrash className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <a
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="block text-center text-xs font-bold text-[#4b607f] active:text-[#f3701e] py-2.5 border-t-2 border-[#1a1a1a] bg-[#f9f3ed]"
                >
                  Lihat Semua Notifikasi →
                </a>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
              className="hidden md:block absolute right-0 top-12 w-[min(380px,calc(100vw-2rem))] max-h-[480px] bg-white neo-border rounded-xl neo-shadow overflow-hidden z-50"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#1a1a1a]">
                <h3 className="font-heading font-bold text-[#1a1a1a]">Notifikasi</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-medium text-[#4b607f] hover:text-[#f3701e] flex items-center gap-1"
                    >
                      <TbChecks className="w-4 h-4" />
                      Baca semua
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} aria-label="Tutup notifikasi">
                    <TbX className="w-4 h-4 text-[#5a5a5a]" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[400px]">
                {loading && notifications.length === 0 ? (
                  <div className="p-8 text-center text-[#5a5a5a]">Memuat...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <TbBell className="w-10 h-10 mx-auto text-[#ccc] mb-2" />
                    <p className="text-sm text-[#5a5a5a]">Belum ada notifikasi</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const Icon = TYPE_ICONS[notif.type] || TbInfoCircle;
                    const colorClass = TYPE_COLORS[notif.type] || "bg-gray-100 text-gray-600";

                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 border-b border-[#e8d8c9] hover:bg-[#f9f3ed] transition-colors ${
                          !notif.isRead ? "bg-[#fef9f4]" : ""
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${!notif.isRead ? "font-bold" : "font-medium"} text-[#1a1a1a]`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-[#5a5a5a] mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-[#999] mt-1">{timeAgo(notif.createdAt)}</p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {!notif.isRead && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[#e8d8c9]"
                              title="Tandai dibaca"
                            >
                              <TbCheck className="w-3.5 h-3.5 text-[#4b607f]" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notif.id)}
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50"
                            title="Hapus"
                          >
                            <TbTrash className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-2 border-t-2 border-[#1a1a1a] bg-[#f9f3ed]">
                <a
                  href="/notifications"
                  className="text-xs font-bold text-[#4b607f] hover:text-[#f3701e] block text-center"
                >
                  Lihat Semua Notifikasi →
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
