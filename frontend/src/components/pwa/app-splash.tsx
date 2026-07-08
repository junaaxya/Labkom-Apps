"use client";

import Image from "next/image";
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
          className="fixed inset-0 z-[10000] flex min-h-dvh items-center justify-center overflow-hidden bg-[#f5ede6] safe-area-inset"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
          aria-label="Memuat LabKom"
          role="status"
        >
          {!reduceMotion && (
            <video
              className="absolute inset-0 h-full w-full object-cover opacity-95"
              src="/labkom-splash.mp4"
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#f5ede6]/55 via-[#f5ede6]/20 to-[#4b607f]/25" />
          <motion.div
            className="relative flex flex-col items-center gap-5 px-6 text-center"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{
              duration: reduceMotion ? 0.2 : 0.55,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="rounded-[32px] border-[4px] border-[#1a1a1a] bg-white/90 p-3 shadow-[8px_8px_0_#1a1a1a] backdrop-blur-sm sm:rounded-[40px] sm:p-4 sm:shadow-[10px_10px_0_#1a1a1a]">
              <Image
                src="/icons/labkom-logo-1024.png"
                alt="Logo LabKom"
                width={184}
                height={184}
                priority
                className="h-32 w-32 rounded-[22px] object-contain sm:h-44 sm:w-44 sm:rounded-[30px]"
              />
            </div>
            <div className="rounded-full border-[3px] border-[#1a1a1a] bg-[#f3701e] px-5 py-2 font-heading text-sm font-black uppercase tracking-[0.22em] text-white shadow-[4px_4px_0_#1a1a1a] sm:text-base">
              LabKom
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
