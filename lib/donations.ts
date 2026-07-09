import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptEmail } from "@/lib/resend";
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

  // Send the receipt only on the first successful settlement.
  if (paid && !alreadyPaid) {
    await sendReceiptEmail(donation);
  }

  return donation;
}

/**
 * Manually confirm a donation as paid (admin action) — used for the QR /
 * bank-transfer flow, which has no gateway webhook. Idempotent: a no-op if
 * already paid. Sends the receipt on the first confirmation.
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
  await sendReceiptEmail(donation);
  return donation;
}
