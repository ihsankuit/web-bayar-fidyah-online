import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPurchase } from "@/lib/chip";
import { settleDonationByReference } from "@/lib/donations";
import { normalizeOrigin } from "@/lib/site-url";

/**
 * CHIP `success_redirect` / `failure_redirect` handler (browser GET after
 * payment). We control `ref` and `result` — they were set when the purchase
 * was created — but re-verify the actual status server-to-server against the
 * CHIP API before settling, as a fallback to the webhook callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref");
  const result = url.searchParams.get("result");

  const siteUrl = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ?? url.origin
  );
  const statusUrl = new URL("/status", siteUrl);

  if (!reference) {
    statusUrl.searchParams.set("status", "unknown");
    return NextResponse.redirect(statusUrl);
  }

  statusUrl.searchParams.set("ref", reference);

  let paid = result === "success";
  try {
    const supabase = createAdminClient();
    const { data: donation } = await supabase
      .from("donations")
      .select("chip_purchase_id")
      .eq("reference", reference)
      .maybeSingle<{ chip_purchase_id: string | null }>();

    if (donation?.chip_purchase_id) {
      const purchase = await getPurchase(donation.chip_purchase_id);
      paid = purchase.status === "paid";
      await settleDonationByReference(reference, paid, null);
    }
  } catch (err) {
    console.error("[chip/redirect] verify failed:", err);
  }

  statusUrl.searchParams.set("status", paid ? "paid" : "failed");
  return NextResponse.redirect(statusUrl);
}
