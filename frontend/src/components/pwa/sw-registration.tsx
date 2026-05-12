"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    const promptSkipWaiting = (reg: ServiceWorkerRegistration) => {
      const waiting = reg.waiting;
      if (waiting) {
        waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (reg.waiting) {
          promptSkipWaiting(reg);
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              promptSkipWaiting(reg);
            }
          });
        });

        const checkUpdate = () => reg.update().catch(() => {});
        const interval = setInterval(checkUpdate, 60 * 60 * 1000);
        window.addEventListener("focus", checkUpdate);

        return () => {
          clearInterval(interval);
          window.removeEventListener("focus", checkUpdate);
        };
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
