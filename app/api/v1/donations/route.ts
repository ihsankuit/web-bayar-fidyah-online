import { NextResponse, after } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiKeyFingerprint,
  isAuthorized,
  serializeDonation,
  unauthorized,
} from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createDonation } from "@/lib/create-donation";
import { emitDonationEvent } from "@/lib/webhooks";
import { SITE_URL } from "@/lib/site-url";
import { MAX_QADA_ROWS } from "@/lib/ramadan";
import type { Donation, DonationStatus } from "@/lib/database.types";

/**
 * GET /api/v1/donations
 * List donations for automations (e.g. n8n). Auth: API key.
 * Query params: status, utm_source, from, to (ISO, on created_at), offset,
 * limit. `limit` is optional and uncapped — omit it to return every matching
 * row (paged through internally).
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-donations:${clientIp(request)}`, 120, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as DonationStatus | null;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const utmSource = url.searchParams.get("utm_source");
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  // No cap: a provided `limit` is honoured as-is; omitting it returns all rows.
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : null;

  try {
    const supabase = createAdminClient();

    // Build a fresh filtered query each time — a PostgREST builder can't be
    // reused once it has been awaited.
    const buildQuery = () => {
      let q = supabase
        .from("donations")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (status && ["pending", "paid", "failed"].includes(status)) {
        q = q.eq("status", status);
      }
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (utmSource) q = q.eq("utm_source", utmSource);
      return q;
    };

    // PostgREST caps a single response at ~1000 rows, so page through in
    // chunks — this is what lets "no limit" return the entire set.
    const CHUNK = 1000;
    const rows: Donation[] = [];
    let total = 0;
    let start = offset;
    for (;;) {
      const want = limit === null ? CHUNK : Math.min(CHUNK, limit - rows.length);
      if (want <= 0) break;
      const { data, count, error } = await buildQuery().range(
        start,
        start + want - 1
      );
      if (error) throw error;
      total = count ?? total;
      const batch = (data as Donation[]) ?? [];
      rows.push(...batch);
      if (batch.length < want) break; // no more rows
      start += batch.length;
    }

    return NextResponse.json({
      data: rows.map(serializeDonation),
      count: total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[api/v1/donations]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** Marks a row as API-created. Not caller-settable, unlike utm_source. */
const API_USER_AGENT = "bayarfidyahonline-api/v1";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().default(""),
  negeri: z.string().trim().max(60).optional().default(""),
  category: z.string().trim().min(1),
  // Not needed for lewat_qada with `qada` rows: the amount is then worked out
  // from the years, and anything sent here is ignored.
  days: z.number().int().min(1).max(365).optional(),
  multiplier: z.number().int().min(1).max(20).optional().default(1),
  // Lewat qada': one entry per missed year (Hijri year of that Ramadan).
  qada: z
    .array(
      z.object({
        hijri_year: z.number().int(),
        days: z.number().int(),
      })
    )
    .min(1)
    .max(MAX_QADA_ROWS)
    .optional(),
  // Lewat qada' only: charge days x rate without the delay multiplier, for a
  // payer who says they cannot afford it.
  qada_basic_only: z.boolean().optional(),
  expected_amount_sen: z.number().int().optional(),
  message: z.string().trim().max(500).optional().default(""),
  method: z.enum(["chip", "manual"]).optional().default("chip"),
  // Attribution. Defaults to "api" so these rows can be told apart from
  // payers who came through the site; pass your own to be more specific.
  utm_source: z.string().trim().max(100).optional().default("api"),
  utm_medium: z.string().trim().max(100).optional().default(""),
  utm_campaign: z.string().trim().max(100).optional().default(""),
  utm_term: z.string().trim().max(100).optional().default(""),
  utm_content: z.string().trim().max(100).optional().default(""),
}).refine((v) => v.qada !== undefined || v.days !== undefined, {
  path: ["days"],
  message: "Required unless `qada` is given",
});

/**
 * POST /api/v1/donations
 * Create a fidyah donation and get back a payment link. Auth: API key.
 *
 * Built for chatbots and automations, which cannot use the browser
 * checkout: that endpoint is throttled per IP at 15 per 10 minutes, which
 * for a bot calling from one server means 15 donations across all of its
 * users. This one is throttled per API key instead.
 *
 * The donation starts `pending`. It becomes `paid` only when CHIP confirms
 * the payment — creating one here does not move any money, and the caller
 * should poll GET /api/v1/donations/{reference} or listen for the
 * `donation.paid` webhook rather than assume success.
 */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();

  if (
    !(await checkRateLimit(
      `api-v1-donations-create:${apiKeyFingerprint(request)}`,
      60,
      60
    ))
  ) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 60 donations per minute per key." },
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const result = await createDonation({
    name: input.name,
    email: input.email,
    phone: input.phone,
    negeri: input.negeri,
    category: input.category,
    days: input.days ?? 1,
    multiplier: input.multiplier,
    qada: input.qada?.map((r) => ({ hijriYear: r.hijri_year, days: r.days })),
    qadaBasicOnly: input.qada_basic_only,
    expectedFidyahSen: input.expected_amount_sen,
    message: input.message,
    method: input.method,
    // No upsell over the API: it is a prompt shown to a human mid-checkout,
    // and an automation accepting it on someone's behalf would be charging
    // them for something they were never asked about.
    upsellAccepted: false,
    utm: {
      source: input.utm_source,
      medium: input.utm_medium,
      campaign: input.utm_campaign,
      term: input.utm_term,
      content: input.utm_content,
    },
    ads: { gclid: "", gbraid: "", wbraid: "" },
    tracking: {
      // No browser, so no advertising cookies. The server-side conversion
      // still matches on the hashed email, phone and name.
      gaClientId: null,
      fbp: null,
      fbc: null,
      clientIp: clientIp(request),
      userAgent: API_USER_AGENT,
      landingUrl: null,
    },
    siteUrl: SITE_URL,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.details ?? {}) },
      { status: result.status }
    );
  }

  after(() => emitDonationEvent("donation.created", result.donation));

  return NextResponse.json(
    {
      data: {
        reference: result.reference,
        status: "pending",
        amount: result.amountSen / 100,
        amount_sen: result.amountSen,
        currency: "MYR",
        breakdown: result.breakdown ?? null,
        method: result.method,
        ...(result.method === "chip"
          ? { payment_url: result.checkoutUrl }
          : { bank: result.bank }),
        status_url: `${SITE_URL}/status?ref=${encodeURIComponent(
          result.reference
        )}`,
      },
    },
    { status: 201 }
  );
}
