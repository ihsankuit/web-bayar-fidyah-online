import { NextResponse, after } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiActor,
  apiKeyFingerprint,
  isAuthorized,
  unauthorized,
} from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { createManualPayment, parseManualPaymentBody } from "@/lib/manual-payment";
import { apiStatus } from "@/lib/payment-methods";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getLandingContent } from "@/lib/settings";
import { emitDonationEvent } from "@/lib/webhooks";

/**
 * POST /api/v1/donations/manual
 *
 * Record a payment that was ALREADY made by DuitNow QR or bank transfer — the
 * WhatsApp chatbot handles these outside the site, so until now they left no
 * record, no receipt and no report. Auth: API key.
 *
 * The record always starts as `review` (Perlu Semak). This endpoint cannot
 * make a payment `paid`: staff match it against the bank statement in
 * Admin → Sumbangan and confirm it there, which is what sends the receipt and
 * the Purchase analytics event. Creating one here sends neither, creates no
 * gateway link, and fires only the `donation.created` webhook.
 *
 * Idempotent on `idempotency_key`: repeating a key returns the existing record
 * (200) rather than creating a duplicate (201).
 */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();

  if (
    !(await checkRateLimit(
      `api-v1-manual-create:${apiKeyFingerprint(request)}`,
      60,
      60
    ))
  ) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Max 60 requests per minute per key.",
        code: "RATE_LIMITED",
      },
      { status: 429 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const parsed = parseManualPaymentBody(payload);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Validation failed", code: "VALIDATION_FAILED", issues: parsed.issues },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Pangkalan data belum dikonfigurasi.", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const { fidyah_rate_sen } = await getLandingContent();
  const ip = clientIp(request);

  const result = await createManualPayment(parsed.data, {
    supabase,
    rateSen: fidyah_rate_sen,
    clientIp: ip,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, ...(result.details ?? {}) },
      { status: result.status }
    );
  }

  const d = result.donation;

  // Only a newly created record is announced and logged. A replay is the
  // caller asking again about something that already happened.
  if (result.created) {
    after(() => emitDonationEvent("donation.created", d));
    after(() =>
      logActivity(
        "donation.api_manual_create",
        {
          reference: d.reference,
          method: d.payment_method,
          amount_sen: d.amount_sen,
          category: d.category,
          source: d.utm_source ?? "-",
          idempotency_key: parsed.data.idempotency_key,
          ip,
        },
        apiActor(request)
      )
    );
  }

  return NextResponse.json(
    {
      data: {
        reference: d.reference,
        status: apiStatus(d), // "review"
        status_label: "Perlu Semak",
        amount: d.amount_sen / 100,
        amount_sen: d.amount_sen,
        currency: "MYR",
        method: d.payment_method,
        created_at: d.created_at,
        // true at RM5,000 and over: a larger sum deserves a closer look.
        requires_staff_review: result.requiresStaffReview,
        ...(result.created ? {} : { idempotent_replay: true }),
      },
    },
    {
      status: result.created ? 201 : 200,
      ...(result.created ? {} : { headers: { "Idempotent-Replayed": "true" } }),
    }
  );
}
