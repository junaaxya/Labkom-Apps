"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // px to trigger refresh (default 80)
  resistance?: number; // pull resistance factor (default 2.5)
}

interface UsePullToRefreshResult {
  pullDistance: number;
  isRefreshing: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start tracking when at the very top of the page
    if (window.scrollY !== 0) return;
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startYRef.current === null) return;
      if (isRefreshingRef.current) return;
      // If user has scrolled away from top, abort
      if (window.scrollY !== 0) {
        startYRef.current = null;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const delta = currentY - startYRef.current;

      if (delta <= 0) {
        // Pulling up — not our concern
        setPullDistance(0);
        isPullingRef.current = false;
        return;
      }

      // We are pulling down from the top
      isPullingRef.current = true;
      const dampened = delta / resistance;
      setPullDistance(dampened);

      // Only preventDefault when actively pulling down to prevent page scroll
      // This is intentional: we only block scroll when we've confirmed a downward pull at top
      if (delta > 8) {
        e.preventDefault();
      }
    },
    [resistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || isRefreshingRef.current) {
      startYRef.current = null;
      setPullDistance(0);
      return;
    }

    const currentDistance = pullDistance;
    startYRef.current = null;
    isPullingRef.current = false;

    if (currentDistance >= threshold / resistance) {
      // Triggered
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      setPullDistance(threshold / resistance); // hold at threshold position

      try {
        await onRefresh();
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, resistance, onRefresh]);

  useEffect(() => {
    // passive: false required to allow preventDefault in touchmove
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pullDistance, isRefreshing };
}
