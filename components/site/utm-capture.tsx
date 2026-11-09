"use client";

import { useEffect } from "react";
import { captureUtmParams, captureClickIds } from "@/lib/utm";

/**
 * Mounted once in the site layout: captures utm_* and Google Ads click ids
 * (gclid/gbraid/wbraid) from the query string on every page load.
 */
export function UtmCapture() {
  useEffect(() => {
    captureUtmParams();
    captureClickIds();
  }, []);
  return null;
}
