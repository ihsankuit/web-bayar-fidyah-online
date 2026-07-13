"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Fires a page_view (GA4) and PageView (Facebook) on client-side route changes.
 * The base scripts already fire the first PageView on load, so the initial
 * render is skipped to avoid double counting.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const url =
      pathname + (searchParams.toString() ? `?${searchParams}` : "");

    window.gtag?.("event", "page_view", { page_path: url });
    window.fbq?.("track", "PageView");
  }, [pathname, searchParams]);

  return null;
}
