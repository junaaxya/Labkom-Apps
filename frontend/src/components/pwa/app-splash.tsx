"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const SPLASH_KEY = "labkom-splash-seen";
const SPLASH_DURATION_MS = 2600;
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
          {!reduceMotion && (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src="/labkom-splash.mp4"
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
            />
          )}
          <span className="sr-only">Memuat LabKom</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
