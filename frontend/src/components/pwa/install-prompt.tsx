"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TbDownload, TbX, TbDeviceMobile } from "react-icons/tb";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDeferredPrompt(null);
    } else {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/20"
            onClick={handleDismiss}
          />

          <motion.div
            key="sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] mx-auto max-w-lg"
            style={{
              background: "#f5ede6",
              border: "2px solid #1a1a1a",
              borderBottom: "none",
              borderRadius: "16px 16px 0 0",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Install LabKom"
          >
            <div className="flex items-start justify-between p-5 pb-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    background: "#4b607f",
                    border: "2px solid #1a1a1a",
                  }}
                >
                  <TbDeviceMobile size={24} className="text-[#f5ede6]" />
                </div>
                <div>
                  <p
                    className="font-heading text-base font-bold leading-tight"
                    style={{ color: "#1a1a1a" }}
                  >
                    Install LabKom
                  </p>
                  <p className="text-xs" style={{ color: "#5a5a5a" }}>
                    Akses lebih cepat dari layar utama
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="rounded-lg p-1.5 transition-colors hover:bg-black/10"
                aria-label="Tutup"
              >
                <TbX size={16} style={{ color: "#5a5a5a" }} />
              </button>
            </div>

            <div className="px-5 pb-2">
              <ul className="space-y-1.5 text-sm" style={{ color: "#5a5a5a" }}>
                {[
                  "Buka tanpa browser, langsung dari home screen",
                  "Tampilan penuh tanpa address bar",
                  "Notifikasi lebih responsif",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "#f3701e" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 p-5 pt-4">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-xl py-3 text-sm font-medium transition-colors hover:bg-black/5"
                style={{
                  border: "2px solid #1a1a1a",
                  color: "#1a1a1a",
                  background: "transparent",
                }}
              >
                Nanti saja
              </button>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity disabled:opacity-60"
                style={{
                  background: "#4b607f",
                  border: "2px solid #1a1a1a",
                  color: "#f5ede6",
                }}
              >
                <TbDownload size={16} />
                {installing ? "Menginstall..." : "Install Sekarang"}
              </button>
            </div>

            <div className="h-safe-area-inset-bottom" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
