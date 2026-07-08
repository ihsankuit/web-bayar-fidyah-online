import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/billplz";
import { settleDonationByBill } from "@/lib/donations";

/**
 * Billplz X-Signature callback (server-to-server webhook).
 * Sent as application/x-www-form-urlencoded with flat top-level params.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = typeof value === "string" ? value : "";
  }

  const signature = params["x_signature"];
  delete params["x_signature"];

  if (!verifySignature(params, signature, "")) {
    console.warn("[billplz/callback] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const billId = params["id"];
  const paid = params["paid"] === "true";
  const paidAt = params["paid_at"] || null;

  if (!billId) {
    return NextResponse.json({ error: "Missing bill id" }, { status: 400 });
  }

  await settleDonationByBill(billId, paid, paidAt);

  return NextResponse.json({ ok: true });
}
