import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPurchase, getPurchase } from "@/lib/chip";
import { settleDonationByReference } from "@/lib/donations";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { Donation } from "@/lib/database.types";
import { normalizeOrigin } from "@/lib/site-url";

/**
 * GET /bayar/[reference] — "continue payment" link handed back to a payer
 * whose payment is still pending or failed (used by the {{pautan}} tag in
 * follow-up reminders).
 *
 * Redirects straight to a working CHIP checkout: the purchase originally
 * created for this donation is reused when it's still payable, otherwise a
 * fresh one is issued — an old checkout link goes stale, so re-sending the
 * original URL would just dead-end the payer.
 *
 * Like `/status?ref=…`, the reference itself is what grants access; this
 * exposes nothing beyond what that page already does.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const siteUrl = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  );
  const statusUrl = new URL("/status", siteUrl);

  if (!(await checkRateLimit(`resume:${clientIp(request)}`, 20, 600))) {
    statusUrl.searchParams.set("status", "unknown");
    return NextResponse.redirect(statusUrl);
  }

  if (!reference) {
    statusUrl.searchParams.set("status", "unknown");
    return NextResponse.redirect(statusUrl);
  }
  statusUrl.searchParams.set("ref", reference);

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    statusUrl.searchParams.set("status", "unknown");
    return NextResponse.redirect(statusUrl);
  }

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("reference", reference)
    .maybeSingle<Donation>();

  if (!donation) {
    statusUrl.searchParams.set("status", "unknown");
    return NextResponse.redirect(statusUrl);
  }

  // Already settled, or a manual bank transfer (no CHIP checkout to send them
  // to — the status page carries the bank details and proof upload).
  if (donation.status === "paid" || donation.payment_method === "manual") {
    statusUrl.searchParams.set(
      "status",
      donation.status === "paid" ? "paid" : "pending"
    );
    return NextResponse.redirect(statusUrl);
  }

  // Reuse the existing purchase when it's still payable — avoids piling up
  // abandoned purchases at CHIP each time the payer opens the link.
  if (donation.chip_purchase_id) {
    try {
      const existing = await getPurchase(donation.chip_purchase_id);
      if (existing.status === "paid") {
        await settleDonationByReference(reference, true, null);
        statusUrl.searchParams.set("status", "paid");
        return NextResponse.redirect(statusUrl);
      }
      if (existing.checkout_url && existing.status !== "expired") {
        return NextResponse.redirect(existing.checkout_url);
      }
    } catch (err) {
      console.error("[bayar] could not reuse existing purchase:", err);
    }
  }

  // Otherwise issue a fresh checkout for the same amounts. `amount_sen` is the
  // total including any accepted upsell, which CHIP took as a separate line.
  const upsellSen = donation.upsell_accepted ? donation.upsell_amount_sen : 0;
  const fidyahSen = donation.amount_sen - upsellSen;
  const encodedRef = encodeURIComponent(reference);

  try {
    const purchase = await createPurchase({
      email: donation.payer_email,
      name: donation.payer_name,
      phone: donation.payer_phone ?? undefined,
      amountSen: fidyahSen,
      description: `Fidyah ${donation.days} hari — ${reference}`,
      extraLineItem:
        upsellSen > 0
          ? {
              description: donation.upsell_title || "Kempen Tambahan",
              amountSen: upsellSen,
            }
          : undefined,
      successCallbackUrl: `${siteUrl}/api/chip/callback`,
      successRedirectUrl: `${siteUrl}/api/chip/redirect?ref=${encodedRef}&result=success`,
      failureRedirectUrl: `${siteUrl}/api/chip/redirect?ref=${encodedRef}&result=failure`,
      reference,
    });

    // The payer is actively paying again, so a previously failed/expired
    // donation goes back to pending until the callback settles it.
    await supabase
      .from("donations")
      .update({ chip_purchase_id: purchase.id, status: "pending" })
      .eq("id", donation.id);

    return NextResponse.redirect(purchase.checkout_url);
  } catch (err) {
    console.error("[bayar] failed to issue a fresh checkout:", err);
    statusUrl.searchParams.set("status", "failed");
    return NextResponse.redirect(statusUrl);
  }
}
