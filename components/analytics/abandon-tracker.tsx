"use client";

import { useEffect, useRef } from "react";

/**
 * Fires an `abandon_checkout` dataLayer event on the status page when a payer
 * returns without a completed payment (status = failed). Lets GTM build
 * retargeting audiences / trigger tags for abandoned checkouts. Deduped per
 * reference via sessionStorage so a refresh does not re-fire it.
 */
export function AbandonTracker({
  reference,
  value,
  currency = "MYR",
}: {
  reference: string;
  value: number;
  currency?: string;
}) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const key = `abandon-tracked:${reference}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // ignore storage errors
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "abandon_checkout",
      transaction_id: reference,
      event_id: reference,
      value,
      currency,
    });
  }, [reference, value, currency]);

  return null;
}
