import { sendFacebookPurchase } from "@/lib/tracking/facebook";
import { sendGa4Purchase } from "@/lib/tracking/google";
import type { Donation } from "@/lib/database.types";

/**
 * Fire GA4 (Measurement Protocol) + Facebook (Conversions API) purchase
 * events for a paid donation, using attribution captured from the payer's
 * browser at submission time (ga_client_id/fbp/fbc/client_ip/user_agent).
 *
 * This is the reliable path for donations that go from pending -> paid with
 * nobody's browser around to fire the client-side pixel/gtag — e.g. a manual
 * bank transfer confirmed by an admin, possibly hours or days after the payer
 * left the site. Both calls fail soft; a tracking hiccup must never affect
 * the donation itself.
 */
export async function sendServerConversion(donation: Donation): Promise<void> {
  const value = donation.amount_sen / 100;

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
      clientId:
        donation.ga_client_id ??
        `${Date.now()}.${Math.floor(Math.random() * 1e9)}`,
    }),
  ]);
}
