import { NextResponse } from "next/server";
import { getPublicKey, verifySignature } from "@/lib/chip";
import { settleDonationByReference } from "@/lib/donations";

/**
 * CHIP `success_callback` webhook (server-to-server). CHIP POSTs a
 * JSON-encoded Purchase (plus `event_type`) whenever the purchase's state
 * changes, signed with `X-Signature` (base64 RSA-SHA256 over the raw body).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  let publicKey: string;
  try {
    publicKey = await getPublicKey();
  } catch (err) {
    console.error("[chip/callback] failed to fetch public key:", err);
    return NextResponse.json({ error: "Unable to verify" }, { status: 503 });
  }

  let valid = verifySignature(rawBody, signature, publicKey);
  if (!valid) {
    // The cached key may be stale after a rotation — refetch once and retry.
    try {
      publicKey = await getPublicKey(true);
      valid = verifySignature(rawBody, signature, publicKey);
    } catch {
      // fall through — still invalid
    }
  }

  if (!valid) {
    console.warn("[chip/callback] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: { reference?: string; status?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = payload.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const paid = payload.status === "paid";
  await settleDonationByReference(reference, paid, null);

  return NextResponse.json({ ok: true });
}
