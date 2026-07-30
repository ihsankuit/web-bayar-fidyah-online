"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Fires a page_view (GA4), PageView (Facebook), and a plain `page_view`
 * dataLayer push (for GTM Custom Event triggers — gtag's own dataLayer
 * pushes use its internal arguments-array shape, which a GTM Custom Event
 * trigger listening for `{ event: "page_view" }` won't match) on
 * client-side route changes. The base scripts already fire the first
 * PageView on load, so the initial render is skipped to avoid double
 * counting.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRun = useRef(true);
  // The previous in-app URL, used as page_referrer for the next client-side
  // navigation — mirrors what GA4's own history tracking does in an SPA
  // (document.referrer stays frozen at the original external referrer).
  const previousUrl = useRef("");

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      previousUrl.current =
        typeof window !== "undefined" ? window.location.href : "";
      return;
    }
    const url =
      pathname + (searchParams.toString() ? `?${searchParams}` : "");
    const fullUrl =
      typeof window !== "undefined" ? window.location.origin + url : url;
    const referrer = previousUrl.current || undefined;

    window.gtag?.("event", "page_view", { page_path: url });
    window.fbq?.("track", "PageView");

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_path: url,
      page_title: typeof document !== "undefined" ? document.title : undefined,
      page_location: fullUrl,
      page_referrer: referrer,
    });

    previousUrl.current = fullUrl;
  }, [pathname, searchParams]);

  return null;
}
