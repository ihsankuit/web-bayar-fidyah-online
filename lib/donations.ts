import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptEmail } from "@/lib/resend";
import { sendPaymentSuccessWhatsApp } from "@/lib/notifications";
import { emitDonationEvent } from "@/lib/webhooks";
import { sendServerConversion } from "@/lib/tracking/conversions";
import type { Donation } from "@/lib/database.types";

/**
 * Settle a donation by its (self-assigned) reference. Marks it paid/failed,
 * and — on the first transition to `paid` — sends the receipt email exactly
 * once. Returns the updated donation, or null if not found.
 */
export async function settleDonationByReference(
  reference: string,
  paid: boolean,
  paidAt: string | null
): Promise<Donation | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("donations")
    .select("*")
    .eq("reference", reference)
    .maybeSingle<Donation>();

  if (!existing) return null;

  const alreadyPaid = existing.status === "paid";

  // A confirmed payment must never be regressed back to failed by a later
  // (possibly stale or replayed) callback/redirect.
  if (alreadyPaid && !paid) {
    return existing;
  }

  const nextStatus = paid ? "paid" : "failed";

  const { data: updated } = await supabase
    .from("donations")
    .update({
      status: nextStatus,
      paid_at: paid ? paidAt ?? new Date().toISOString() : null,
    })
    .eq("id", existing.id)
    .select()
    .single<Donation>();

  const donation = updated ?? existing;

  // Send the receipt only on the first successful settlement. Deferred via
  // after() so CHIP's callback (and the payer's redirect) get a fast
  // response instead of waiting on Resend/the webhook receiver.
  if (paid && !alreadyPaid) {
    after(() => sendReceiptEmail(donation));
    after(() => sendPaymentSuccessWhatsApp(donation));
    // Fire the server-side conversion here too, not only from the /status
    // page — a payer who closes the tab before the redirect (or pays via a
    // channel that never returns) still settles through this callback, and
    // the conversion must not depend on a browser arriving. Idempotent, so
    // it won't double-count against the /status fire.
    after(() => sendServerConversion(donation));
    after(() => emitDonationEvent("donation.paid", donation));
  }

  return donation;
}

/**
 * Manually confirm a donation as paid (admin action) — used for the manual
 * bank transfer flow, which has no gateway webhook. Idempotent: a no-op if
 * already paid. Sends the receipt, fires the GA4/Facebook server-side
 * conversion (using attribution captured from the payer's browser at
 * submission time — there's no browser present now, since this fires
 * whenever an admin gets around to reviewing the proof, possibly days
 * later), and emits the webhook, all on the first confirmation.
 */
export async function confirmDonationPaid(
  donationId: string
): Promise<{ donation: Donation | null; confirmed: boolean }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("donations")
    .select("*")
    .eq("id", donationId)
    .maybeSingle<Donation>();

  if (!existing) return { donation: null, confirmed: false };
  if (existing.status === "paid") return { donation: existing, confirmed: false };

  // The update itself is the guard. Reading the status above and writing it
  // here is a gap two admins (or a double-click) can both slip through, and
  // each would then send a receipt and count the payment. Conditioning the
  // write on "not already paid" makes exactly one caller win; the loser gets
  // zero rows back and does nothing but return the record.
  //
  // A payment the sender reported paying at a specific time (recorded over
  // the REST API) keeps that time; anything else is paid as of now.
  const { data: won } = await supabase
    .from("donations")
    .update({
      status: "paid",
      paid_at: existing.claimed_paid_at ?? new Date().toISOString(),
    })
    .eq("id", donationId)
    .neq("status", "paid")
    .select();

  const updated = (won as Donation[] | null)?.[0];
  if (!updated) {
    // Someone else confirmed it between our read and our write.
    const { data: current } = await supabase
      .from("donations")
      .select("*")
      .eq("id", donationId)
      .maybeSingle<Donation>();
    return { donation: current ?? existing, confirmed: false };
  }

  const donation = updated;
  after(() => sendReceiptEmail(donation));
  after(() => sendPaymentSuccessWhatsApp(donation));
  after(() => sendServerConversion(donation));
  after(() => emitDonationEvent("donation.paid", donation));
  return { donation, confirmed: true };
}

/**
 * Confirm a donation as paid. Returns the record either way; use
 * `confirmDonationPaid` when the caller needs to know whether THIS call was the
 * one that confirmed it (to log it once, for instance).
 */
export async function markDonationPaid(
  donationId: string
): Promise<Donation | null> {
  return (await confirmDonationPaid(donationId)).donation;
}

/**
 * Permanently delete a donation record (admin action). Also removes its
 * uploaded proof-of-payment file, if any, so nothing is left orphaned in
 * storage. Returns the deleted donation, or null if it didn't exist.
 */
export async function deleteDonation(
  donationId: string
): Promise<Donation | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("donations")
    .select("*")
    .eq("id", donationId)
    .maybeSingle<Donation>();

  if (!existing) return null;

  if (existing.proof_of_payment_path) {
    await supabase.storage
      .from("payment-proofs")
      .remove([existing.proof_of_payment_path]);
  }

  await supabase.from("donations").delete().eq("id", donationId);

  return existing;
}
