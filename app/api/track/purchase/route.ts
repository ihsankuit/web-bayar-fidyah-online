import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendServerConversion } from "@/lib/tracking/conversions";
import { checkRateLimit, clientIp as getClientIp } from "@/lib/rate-limit";
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
  if (!(await checkRateLimit(`track-purchase:${getClientIp(request)}`, 20, 60))) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

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

  // Route through the shared, idempotent sender. If the CHIP callback or an
  // admin confirmation already fired the conversion for this donation, this
  // is a no-op — no double counting. Uses attribution stored at submission.
  await sendServerConversion(donation);

  return NextResponse.json({ ok: true });
}
