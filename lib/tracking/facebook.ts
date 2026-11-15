import crypto from "crypto";
import { getTrackingSettings } from "@/lib/tracking/settings";
import {
  externalIdFor,
  MATCH_COUNTRY,
  normalizePhoneForMatching,
  normalizeRegionForMatching,
  splitNameForMatching,
} from "@/lib/tracking/identity";

const API_VERSION = "v19.0";

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export interface CapiPurchaseInput {
  eventId: string;
  eventSourceUrl?: string;
  email?: string | null;
  phone?: string | null;
  /** Payer's full name, split into fn/ln for matching. */
  name?: string | null;
  /** Malaysian state, sent as the `st` region parameter. */
  state?: string | null;
  value: number; // in Ringgit (float)
  currency?: string;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

/**
 * Send a server-side "Purchase" event to the Facebook Conversions API.
 * The event_id matches the browser Pixel event so Facebook deduplicates them.
 * Fails soft — logs and returns false rather than throwing.
 */
export async function sendFacebookPurchase(
  input: CapiPurchaseInput
): Promise<boolean> {
  const { pixelId, capiToken: token, testEventCode } =
    await getTrackingSettings();
  if (!pixelId || !token) return false;

  // Every parameter here is one more thing Meta can match on, and the Event
  // Match Quality score is driven by how many of them land. fbp/fbc and the
  // IP/user-agent pair are the strong signals; the hashed personal details
  // are what lifts the score for payers who arrived without a click id.
  const userData: Record<string, unknown> = {};
  if (input.email) userData.em = [sha256(input.email)];

  const phone = normalizePhoneForMatching(input.phone);
  if (phone) userData.ph = [sha256(phone)];

  const { first, last } = splitNameForMatching(input.name);
  if (first) userData.fn = [sha256(first)];
  if (last) userData.ln = [sha256(last)];

  const region = normalizeRegionForMatching(input.state);
  if (region) userData.st = [sha256(region)];

  // The country is a constant for this site — every payer is settling a
  // Malaysian fidyah — but only worth asserting when something else about
  // the payer is known, so it never stands alone as the sole "match".
  if (userData.em || userData.ph) userData.country = [sha256(MATCH_COUNTRY)];

  const externalId = externalIdFor(input.phone, input.email);
  if (externalId) userData.external_id = [sha256(externalId)];

  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: input.currency ?? "MYR",
          value: input.value,
        },
      },
    ],
  };

  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error("[capi] Facebook CAPI error:", await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[capi] Facebook CAPI request failed:", err);
    return false;
  }
}
