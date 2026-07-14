import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendFacebookPurchase } from "@/lib/tracking/facebook";
import { sendGa4Purchase, parseGaClientId } from "@/lib/tracking/google";
import { parseCookieHeader } from "@/lib/tracking/cookies";
import type { Donation } from "@/lib/database.types";

const schema = z.object({ reference: z.string().trim().min(1).max(40) });

/**
 * Fire server-side conversion events (Facebook CAPI + GA4 Measurement Protocol)
 * for a paid donation. Called by the status page after a successful payment.
 * The value is taken from the database (never the client) and the event only
 * fires for donations that are actually `paid`. The event_id is the donation
 * reference so it deduplicates against the browser Pixel/gtag event.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  let donation: Donation | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("donations")
      .select("*")
      .eq("reference", parsed.data.reference)
      .maybeSingle<Donation>();
    donation = data ?? null;
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  // Only track genuinely paid donations.
  if (!donation || donation.status !== "paid") {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const value = donation.amount_sen / 100;
  const cookies = parseCookieHeader(request.headers.get("cookie"));

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer") ?? undefined;

  await Promise.allSettled([
    sendFacebookPurchase({
      eventId: donation.reference,
      eventSourceUrl: referer,
      email: donation.payer_email,
      phone: donation.payer_phone,
      value,
      currency: "MYR",
      clientIp,
      userAgent,
      fbp: cookies["_fbp"] ?? null,
      fbc: cookies["_fbc"] ?? null,
    }),
    sendGa4Purchase({
      transactionId: donation.reference,
      value,
      currency: "MYR",
      clientId: parseGaClientId(cookies["_ga"]) ?? `${Date.now()}.${Math.floor(Math.random() * 1e9)}`,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
