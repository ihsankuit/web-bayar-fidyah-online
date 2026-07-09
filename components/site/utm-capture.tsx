"use client";

import { useEffect } from "react";
import { captureUtmParams } from "@/lib/utm";

/** Mounted once at the root layout: captures utm_* query params on every page load. */
export function UtmCapture() {
  useEffect(() => {
    captureUtmParams();
  }, []);
  return null;
}
