/**
 * Server-side GA4 purchase event via the Measurement Protocol. Complements the
 * client-side gtag purchase (GA4 deduplicates by transaction_id). Fails soft.
 *
 * The hit normally goes to Google directly, but when `endpointBase` is set it
 * is sent to a server-side GTM container's `/mp/collect` instead, so sGTM fans
 * the event out to GA4/Meta/Ads. In that case `match` carries the identifiers a
 * downstream Meta/Ads tag needs (event_id for dedup, fbp/fbc, hashed email/
 * phone, ip_override) as event params + user_data.
 */
import crypto from "crypto";
import { getTrackingSettings } from "@/lib/tracking/settings";

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export interface Ga4PurchaseInput {
  transactionId: string;
  value: number; // Ringgit float
  currency?: string;
  clientId: string; // from the _ga cookie, or a fallback
  /** Base URL of a server-side GTM container. Omit to hit Google directly. */
  endpointBase?: string;
  /** Extra identifiers forwarded so an sGTM Meta/Ads tag can match & dedup. */
  match?: {
    eventId?: string;
    email?: string | null;
    phone?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
  };
}

export async function sendGa4Purchase(
  input: Ga4PurchaseInput
): Promise<boolean> {
  const { gaId: measurementId, gaApiSecret: apiSecret } =
    await getTrackingSettings();
  if (!measurementId || !apiSecret) return false;

  const m = input.match;
  const params: Record<string, unknown> = {
    transaction_id: input.transactionId,
    currency: input.currency ?? "MYR",
    value: input.value,
  };
  // Meta/Ads matching data — only meaningful when routed through sGTM, but
  // harmless otherwise (GA4 ignores unknown params).
  if (m?.eventId) params.event_id = m.eventId;
  if (m?.fbp) params.fbp = m.fbp;
  if (m?.fbc) params.fbc = m.fbc;
  if (m?.userAgent) params.user_agent = m.userAgent;

  const userData: Record<string, string> = {};
  if (m?.email) userData.sha256_email_address = sha256(m.email);
  if (m?.phone)
    userData.sha256_phone_number = sha256(m.phone.replace(/[^0-9]/g, ""));

  const body: Record<string, unknown> = {
    client_id: input.clientId,
    events: [{ name: "purchase", params }],
  };
  if (m?.clientIp) body.ip_override = m.clientIp;
  if (Object.keys(userData).length > 0) body.user_data = userData;

  const base = (input.endpointBase || "https://www.google-analytics.com").replace(
    /\/$/,
    ""
  );

  try {
    const res = await fetch(
      `${base}/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[ga4-mp] Measurement Protocol request failed:", err);
    return false;
  }
}

/** Parse the GA client id (e.g. "1234567890.1234567890") from a _ga cookie. */
export function parseGaClientId(gaCookie: string | undefined): string | null {
  if (!gaCookie) return null;
  // Format: GA1.1.<clientId1>.<clientId2>
  const parts = gaCookie.split(".");
  if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
  return null;
}
