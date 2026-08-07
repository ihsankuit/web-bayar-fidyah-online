import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptEmail } from "@/lib/resend";
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
    after(() => emitDonationEvent("donation.paid", donation));
  } else if (!paid && existing.status !== "failed") {
    // Only emit on the first transition into "failed" — CHIP can post more
    // than one terminal-failure callback for the same purchase.
    after(() => emitDonationEvent("donation.failed", donation));
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
export async function markDonationPaid(
  donationId: string
): Promise<Donation | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("donations")
    .select("*")
    .eq("id", donationId)
    .maybeSingle<Donation>();

  if (!existing) return null;
  if (existing.status === "paid") return existing;

  const { data: updated } = await supabase
    .from("donations")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", donationId)
    .select()
    .single<Donation>();

  const donation = updated ?? existing;
  after(() => sendReceiptEmail(donation));
  after(() => sendServerConversion(donation));
  after(() => emitDonationEvent("donation.paid", donation));
  return donation;
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
