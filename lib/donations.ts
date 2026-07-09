import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptEmail } from "@/lib/resend";
import type { Donation } from "@/lib/database.types";

/**
 * Settle a donation by its Billplz bill id. Marks it paid/failed, and — on the
 * first transition to `paid` — sends the receipt email exactly once.
 * Returns the updated donation, or null if not found.
 */
export async function settleDonationByBill(
  billId: string,
  paid: boolean,
  paidAt: string | null
): Promise<Donation | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("donations")
    .select("*")
    .eq("billplz_bill_id", billId)
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
