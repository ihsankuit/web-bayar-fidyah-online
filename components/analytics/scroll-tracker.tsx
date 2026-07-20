"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const THRESHOLDS = [25, 50, 75, 90];

/**
 * Pushes a `scroll` dataLayer event once per depth threshold (25/50/75/90%
 * of the scrollable page height), per page view — matching GA4 Enhanced
 * Measurement's `percent_scrolled` convention. Resets on route change.
 */
export function ScrollTracker() {
  const pathname = usePathname();
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    fired.current = new Set();

    function onScroll() {
      const doc = document.documentElement;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      if (scrollHeight <= 0) return;

      const percent = Math.round((window.scrollY / scrollHeight) * 100);

      for (const threshold of THRESHOLDS) {
        if (percent >= threshold && !fired.current.has(threshold)) {
          fired.current.add(threshold);
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: "scroll",
            percent_scrolled: threshold,
          });
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return null;
}
