import crypto from "crypto";

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
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  const token = process.env.FB_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return false;

  const userData: Record<string, unknown> = {};
  if (input.email) userData.em = [sha256(input.email)];
  if (input.phone) userData.ph = [sha256(input.phone.replace(/[^0-9]/g, ""))];
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

  if (process.env.FB_TEST_EVENT_CODE) {
    body.test_event_code = process.env.FB_TEST_EVENT_CODE;
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
