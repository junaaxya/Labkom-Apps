"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TbWifiOff, TbWifi, TbX } from "react-icons/tb";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setIsOnline(navigator.onLine);
    });

    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const showOfflineBanner = !isOnline && !dismissed;
  const showOnlineBanner = isOnline && showReconnected;

  return (
    <AnimatePresence>
      {showOfflineBanner && (
        <motion.div
          key="offline"
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 pb-3 pt-safe-top"
          style={{
            background: "#1a1a1a",
            borderBottom: "2px solid #f3701e",
          }}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[#f5ede6]">
            <TbWifiOff size={16} className="text-[#f3701e] shrink-0" />
            <span>
              Tidak ada koneksi internet. Beberapa fitur mungkin tidak tersedia.
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[#f5ede6] transition-colors hover:bg-white/10"
            aria-label="Tutup notifikasi offline"
          >
            <TbX size={20} />
          </button>
        </motion.div>
      )}

      {showOnlineBanner && (
        <motion.div
          key="online"
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center gap-2 px-4 pb-3 pt-safe-top"
          style={{
            background: "#2d5a27",
            borderBottom: "2px solid #4ade80",
          }}
          role="status"
          aria-live="polite"
        >
          <TbWifi size={16} className="text-[#4ade80] shrink-0" />
          <span className="text-sm font-medium text-[#f5ede6]">
            Koneksi pulih. Kamu kembali online.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
