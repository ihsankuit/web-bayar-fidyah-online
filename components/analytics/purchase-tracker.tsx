"use client";

import { useEffect, useRef } from "react";

/**
 * Fires the conversion on the payment status page for a paid donation:
 *  - Facebook Pixel "Purchase" (browser) with eventID = reference
 *  - GA4 gtag "purchase" (browser) with transaction_id = reference
 *  - Google Ads gtag "conversion" (browser), if a conversion id/label is set
 *  - a plain `purchase` dataLayer push for Google Tag Manager triggers,
 *    carrying `event_id: reference` too — a GTM Server-Side container's own
 *    Facebook CAPI tag needs this to match the browser Pixel's eventID,
 *    otherwise Meta counts the browser and server hits as two purchases.
 *  - a POST to /api/track/purchase for our own built-in server-side CAPI +
 *    GA4 MP events, which already share the same `reference` id so they
 *    deduplicate against the Pixel event above.
 * Uses sessionStorage so a page refresh does not re-fire the browser events.
 */
export function PurchaseTracker({
  reference,
  value,
  currency = "MYR",
  googleAdsId,
  googleAdsConversionLabel,
}: {
  reference: string;
  value: number;
  currency?: string;
  googleAdsId?: string;
  googleAdsConversionLabel?: string;
}) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const key = `purchase-tracked:${reference}`;
    const alreadyTracked =
      typeof window !== "undefined" && sessionStorage.getItem(key);

    if (!alreadyTracked) {
      window.fbq?.("track", "Purchase", { value, currency }, { eventID: reference });
      window.gtag?.("event", "purchase", {
        transaction_id: reference,
        value,
        currency,
      });
      if (googleAdsId && googleAdsConversionLabel) {
        window.gtag?.("event", "conversion", {
          send_to: `${googleAdsId}/${googleAdsConversionLabel}`,
          transaction_id: reference,
          value,
          currency,
        });
      }
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "purchase",
        transaction_id: reference,
        event_id: reference,
        value,
        currency,
      });
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore storage errors
      }
    }

    // Server-side conversions (CAPI + GA4 MP). Safe to call again — the
    // platforms deduplicate on the shared event id / transaction id.
    fetch("/api/track/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
      keepalive: true,
    }).catch(() => {});
  }, [reference, value, currency, googleAdsId, googleAdsConversionLabel]);

  return null;
}
