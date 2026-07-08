import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/billplz";
import { settleDonationByBill } from "@/lib/donations";

/**
 * Billplz redirect_url handler (browser GET after payment). Params arrive as
 * `billplz[id]`, `billplz[paid]`, `billplz[paid_at]`, `billplz[x_signature]`.
 * We verify, settle as a fallback to the webhook, then send the user to the
 * status page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("billplz[id]");
  const paidRaw = url.searchParams.get("billplz[paid]");
  const paidAt = url.searchParams.get("billplz[paid_at]");
  const signature = url.searchParams.get("billplz[x_signature]");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const statusUrl = new URL("/status", siteUrl);

  if (!id) {
    statusUrl.searchParams.set("status", "unknown");
    return NextResponse.redirect(statusUrl);
  }

  const params: Record<string, string> = {
    id,
    paid: paidRaw ?? "",
    paid_at: paidAt ?? "",
  };

  const valid = verifySignature(params, signature, "billplz");
  const paid = paidRaw === "true";

  if (valid) {
    await settleDonationByBill(id, paid, paidAt);
  }

  statusUrl.searchParams.set("status", paid ? "paid" : "failed");
  statusUrl.searchParams.set("bill", id);
  return NextResponse.redirect(statusUrl);
}
