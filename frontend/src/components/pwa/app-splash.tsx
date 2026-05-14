"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const SPLASH_KEY = "labkom-splash-seen";
const SPLASH_DURATION_MS = 1200;
const REDUCED_DURATION_MS = 400;

export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) return;

    sessionStorage.setItem(SPLASH_KEY, "true");
    queueMicrotask(() => {
      setVisible(true);
    });

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
          className="fixed inset-0 z-[10000] flex min-h-dvh items-center justify-center overflow-hidden bg-[#4b607f] safe-area-inset"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.32, ease: "easeOut" }}
          aria-label="Memuat LabKom"
          role="status"
        >
          <motion.div
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
            <Image
              src="/icons/icon-maskable-512.png"
              alt="Logo LabKom"
              width={144}
              height={144}
              priority
              className="h-28 w-28 object-contain drop-shadow-[0_6px_0_#1a1a1a] sm:h-36 sm:w-36"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
