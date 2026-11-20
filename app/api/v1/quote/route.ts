import { NextResponse } from "next/server";
import { z } from "zod";

import { apiKeyFingerprint, isAuthorized, unauthorized } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { quoteDonation } from "@/lib/create-donation";
import { MAX_QADA_ROWS } from "@/lib/ramadan";

const schema = z
  .object({
    category: z.string().trim().min(1),
    days: z.number().int().min(1).max(365).optional(),
    multiplier: z.number().int().min(1).max(20).optional().default(1),
    qada: z
      .array(z.object({ hijri_year: z.number().int(), days: z.number().int() }))
      .min(1)
      .max(MAX_QADA_ROWS)
      .optional(),
  })
  .refine((v) => v.qada !== undefined || v.days !== undefined, {
    path: ["days"],
    message: "Required unless `qada` is given",
  });

/**
 * POST /api/v1/quote
 * What an order would cost right now, with the per-year working for lewat
 * qada'. Creates nothing. Uses the same pricing code as POST
 * /api/v1/donations, so the quote is the charge. Auth: API key.
 */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-quote:${apiKeyFingerprint(request)}`, 120, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
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

  const result = await quoteDonation({
    category: input.category,
    days: input.days ?? 1,
    multiplier: input.multiplier,
    qada: input.qada?.map((r) => ({ hijriYear: r.hijri_year, days: r.days })),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    data: {
      amount: result.amountSen / 100,
      amount_sen: result.amountSen,
      currency: "MYR",
      chargeable_days: result.days * result.multiplier,
      rate_sen: result.rateSen,
      breakdown: result.breakdown,
    },
  });
}
