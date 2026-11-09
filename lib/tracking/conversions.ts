import { createAdminClient } from "@/lib/supabase/admin";
import { sendFacebookPurchase } from "@/lib/tracking/facebook";
import { sendGa4Purchase } from "@/lib/tracking/google";
import { getTrackingSettings } from "@/lib/tracking/settings";
import type { Donation } from "@/lib/database.types";

/**
 * Fire GA4 (Measurement Protocol) + Facebook (Conversions API) purchase
 * events for a paid donation, using attribution captured from the payer's
 * browser at submission time (ga_client_id/fbp/fbc/client_ip/user_agent).
 *
 * This is the reliable path for donations that go pending -> paid with nobody's
 * browser around to fire the client-side pixel/gtag — a CHIP payment settled by
 * the server-to-server callback (payer may have closed the tab), or a manual
 * bank transfer confirmed by an admin hours/days later.
 *
 * Idempotent: the first caller to claim `conversion_sent_at` sends; every other
 * path (CHIP callback, admin confirm, the /status page) then no-ops. The
 * browser Pixel/gtag still fires and deduplicates against this by event_id.
 * Both network calls fail soft — a tracking hiccup never affects the donation.
 */
export async function sendServerConversion(donation: Donation): Promise<void> {
  // Atomic claim: a conditional UPDATE that only matches while the flag is
  // still null. If it updates no row, another path already sent — stop here.
  const supabase = createAdminClient();
  const { data: claimed } = await supabase
    .from("donations")
    .update({ conversion_sent_at: new Date().toISOString() })
    .eq("id", donation.id)
    .is("conversion_sent_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const value = donation.amount_sen / 100;
  const clientId =
    donation.ga_client_id ??
    `${Date.now()}.${Math.floor(Math.random() * 1e9)}`;

  const { sgtmUrl } = await getTrackingSettings();

  // When a server-side GTM container is configured, send ONE GA4 Measurement
  // Protocol hit to it and let sGTM fan out to GA4 + Meta CAPI + Ads (with the
  // matching data forwarded). Sending the Facebook CAPI event directly too
  // would double-count Meta, so it's skipped in this path.
  if (sgtmUrl) {
    await sendGa4Purchase({
      transactionId: donation.reference,
      value,
      currency: "MYR",
      clientId,
      endpointBase: sgtmUrl,
      match: {
        eventId: donation.reference,
        email: donation.payer_email,
        phone: donation.payer_phone,
        fbp: donation.fbp,
        fbc: donation.fbc,
        clientIp: donation.client_ip,
        userAgent: donation.user_agent,
      },
    });
    return;
  }

  // No sGTM — post directly to Google (GA4 MP) and Meta (CAPI).
  await Promise.allSettled([
    sendFacebookPurchase({
      eventId: donation.reference,
      eventSourceUrl: donation.landing_url ?? undefined,
      email: donation.payer_email,
      phone: donation.payer_phone,
      value,
      currency: "MYR",
      clientIp: donation.client_ip,
      userAgent: donation.user_agent,
      fbp: donation.fbp,
      fbc: donation.fbc,
    }),
    sendGa4Purchase({
      transactionId: donation.reference,
      value,
      currency: "MYR",
      clientId,
    }),
  ]);
}
