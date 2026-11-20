import { NextResponse, after } from "next/server";
import { z } from "zod";

import { createDonation } from "@/lib/create-donation";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { emitDonationEvent } from "@/lib/webhooks";
import { parseCookieHeader } from "@/lib/tracking/cookies";
import { parseGaClientId } from "@/lib/tracking/google";
import { normalizeOrigin } from "@/lib/site-url";
import { MAX_QADA_ROWS } from "@/lib/ramadan";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().default(""),
  negeri: z.string().trim().max(60).optional().default(""),
  category: z.string().trim().min(1),
  // Lewat qada' across several years is flattened to one figure by the form:
  // each year's days times the Ramadans that have passed since, summed. That
  // can run well past a year's worth of days for someone owing many years.
  days: z.number().int().min(1).max(10_000),
  multiplier: z.number().int().min(1).max(20),
  message: z.string().trim().max(500).optional().default(""),
  // Lewat qada': the years chosen. When present the server works the amount
  // out itself and ignores days/multiplier above.
  qada: z
    .array(
      z.object({
        hijriYear: z.number().int(),
        days: z.number().int(),
      })
    )
    .max(MAX_QADA_ROWS)
    .optional(),
  qadaBasicOnly: z.boolean().optional(),
  expectedFidyahSen: z.number().int().optional(),
  method: z.enum(["chip", "manual"]).optional().default("chip"),
  upsellAccepted: z.boolean().optional().default(false),
  upsellAmountSen: z.number().int().min(100).max(100_000_00).optional(),
  utm_source: z.string().trim().max(100).optional().default(""),
  utm_medium: z.string().trim().max(100).optional().default(""),
  utm_campaign: z.string().trim().max(100).optional().default(""),
  utm_term: z.string().trim().max(100).optional().default(""),
  utm_content: z.string().trim().max(100).optional().default(""),
  // Google Ads click ids (auto-tagging) — enable offline conversion import.
  gclid: z.string().trim().max(300).optional().default(""),
  gbraid: z.string().trim().max(300).optional().default(""),
  wbraid: z.string().trim().max(300).optional().default(""),
});

/**
 * The payer's own checkout request, from the form on the landing page.
 *
 * The creation itself lives in lib/create-donation so this and the REST API
 * cannot drift on the rate, the minimum or how the upsell is charged. What
 * stays here is what only a browser request has: the IP rate limit and the
 * tracking cookies.
 */
export async function POST(request: Request) {
  const allowed = await checkRateLimit(
    `fidyah-create:${clientIp(request)}`,
    // 15 attempts per 10 minutes — generous enough that many payers sharing
    // one IP (mosque/office wifi during a Ramadan rush) don't get falsely
    // throttled, while still bounding abuse from a single source.
    15,
    600
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi." },
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak sah." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Sila lengkapkan semua maklumat yang diperlukan." },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Capture conversion attribution from the payer's own browser now, while
  // it's actually here — a manual bank transfer is only confirmed later by
  // an admin, with no browser around to fire the pixel at that point.
  const cookies = parseCookieHeader(request.headers.get("cookie"));

  const result = await createDonation({
    name: input.name,
    email: input.email,
    phone: input.phone,
    negeri: input.negeri,
    category: input.category,
    days: input.days,
    multiplier: input.multiplier,
    qada: input.qada,
    qadaBasicOnly: input.qadaBasicOnly,
    expectedFidyahSen: input.expectedFidyahSen,
    message: input.message,
    method: input.method,
    upsellAccepted: input.upsellAccepted,
    upsellAmountSen: input.upsellAmountSen,
    utm: {
      source: input.utm_source,
      medium: input.utm_medium,
      campaign: input.utm_campaign,
      term: input.utm_term,
      content: input.utm_content,
    },
    ads: { gclid: input.gclid, gbraid: input.gbraid, wbraid: input.wbraid },
    tracking: {
      gaClientId: parseGaClientId(cookies["_ga"]),
      fbp: cookies["_fbp"] || null,
      fbc: cookies["_fbc"] || null,
      clientIp: clientIp(request),
      userAgent: request.headers.get("user-agent") || null,
      landingUrl: request.headers.get("referer") || null,
    },
    siteUrl: normalizeOrigin(
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
    ),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.details ?? {}) },
      { status: result.status }
    );
  }

  // Notify automations that a new (pending) donation was created. Runs after
  // the response is sent — a slow/unconfigured webhook receiver should never
  // add latency to the payer's checkout request.
  after(() => emitDonationEvent("donation.created", result.donation));

  if (result.method === "manual") {
    return NextResponse.json({
      method: "manual",
      reference: result.reference,
      amountSen: result.amountSen,
      bank: result.bank,
    });
  }

  return NextResponse.json({
    method: "chip",
    url: result.checkoutUrl,
    reference: result.reference,
  });
}
