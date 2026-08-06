"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const SPLASH_KEY = "labkom-splash-seen";
const SPLASH_DURATION_MS = 900;
const REDUCED_DURATION_MS = 700;

export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) {
      queueMicrotask(() => {
        setVisible(false);
      });
      return;
    }

    sessionStorage.setItem(SPLASH_KEY, "true");

    const timeout = window.setTimeout(
      () => setVisible(false),
      reduceMotion ? REDUCED_DURATION_MS : SPLASH_DURATION_MS
    );

    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[10000] min-h-dvh overflow-hidden bg-[#f5ede6] safe-area-inset"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
          aria-label="Memuat LabKom"
          role="status"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#f3701e22,_transparent_45%),linear-gradient(135deg,_#f5ede6_0%,_#e8d8c9_100%)]" aria-hidden="true" />
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(45deg, #1a1a1a 1px, transparent 1px)", backgroundSize: "18px 18px" }} aria-hidden="true" />
          <div className="relative flex min-h-dvh items-center justify-center p-6">
            <div className="neo-border rounded-2xl bg-white px-6 py-5 text-center shadow-[8px_8px_0px_#1a1a1a]">
              <p className="font-heading text-2xl font-black text-[#1a1a1a] sm:text-3xl">LabKom Management</p>
              <p className="mt-2 text-sm font-bold text-[#5a5a5a]">Memuat aplikasi...</p>
            </div>
          </div>
          <span className="sr-only">Memuat LabKom</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
