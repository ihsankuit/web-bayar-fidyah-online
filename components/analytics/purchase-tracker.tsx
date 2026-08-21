"use client";

import { useEffect, useRef } from "react";

/**
 * Fires the conversion on the payment status page for a paid donation:
 *  - `gtag('set', 'user_data', ...)` with email/phone before the events below
 *    — Google's documented way to pass customer data for Enhanced
 *    Conversions: gtag.js hashes it (SHA-256) client-side before sending, so
 *    it never appears as a raw GA4 event parameter (Google's terms forbid
 *    PII there) while still reaching Google Ads Enhanced Conversions and,
 *    via the server container, a Facebook CAPI tag's User Data mapping.
 *  - Facebook Pixel "Purchase" (browser) with eventID = reference
 *  - GA4 gtag "purchase" (browser) with transaction_id = reference
 *  - Google Ads gtag "conversion" (browser), if a conversion id/label is set
 *  - a plain `purchase` dataLayer push for Google Tag Manager triggers,
 *    carrying `event_id: reference` too — a GTM Server-Side container's own
 *    Facebook CAPI tag needs this to match the browser Pixel's eventID,
 *    otherwise Meta counts the browser and server hits as two purchases.
 *    Also carries `name`/`email`/`phone`/`ip`/`negeri` (raw, unhashed) for
 *    GTM tags that need customer-matching or geo data — hashing, if the
 *    destination requires it, is the tag's job.
 *  - a POST to /api/track/purchase for our own built-in server-side CAPI +
 *    GA4 MP events, which already share the same `reference` id so they
 *    deduplicate against the Pixel event above.
 * Uses sessionStorage so a page refresh does not re-fire the browser events.
 */
export function PurchaseTracker({
  reference,
  donationId,
  value,
  currency = "MYR",
  googleAdsId,
  googleAdsConversionLabel,
  name,
  email,
  phone,
  ip,
  negeri,
}: {
  reference: string;
  /** The donation row's UUID (`id`), exposed to GTM as `donation_id`. */
  donationId?: string;
  value: number;
  currency?: string;
  googleAdsId?: string;
  googleAdsConversionLabel?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  ip?: string | null;
  negeri?: string | null;
}) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const key = `purchase-tracked:${reference}`;
    const alreadyTracked =
      typeof window !== "undefined" && sessionStorage.getItem(key);

    if (!alreadyTracked) {
      if (email || phone) {
        window.gtag?.("set", "user_data", {
          email: email || undefined,
          phone_number: phone || undefined,
        });
      }
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
        donation_id: donationId,
        value,
        currency,
        name,
        email,
        phone: phone || undefined,
        ip: ip || undefined,
        negeri: negeri || undefined,
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
  }, [
    reference,
    donationId,
    value,
    currency,
    googleAdsId,
    googleAdsConversionLabel,
    name,
    email,
    phone,
    ip,
    negeri,
  ]);

  return null;
}
