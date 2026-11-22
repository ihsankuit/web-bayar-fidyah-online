import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { makeReference, priceOrder } from "@/lib/create-donation";
import { isMissingColumnError } from "@/lib/db-errors";
import { CHATBOT_SOURCE } from "@/lib/payment-methods";
import {
  MAX_QADA_ROWS,
  MAX_RAMADAN_DAYS,
  QADA_CATEGORY_ID,
  QADA_REVIEW_THRESHOLD_SEN,
} from "@/lib/ramadan";
import type { Donation } from "@/lib/database.types";

/**
 * A payment that was already made outside the site — DuitNow QR or a bank
 * transfer, typically handled by the WhatsApp chatbot — recorded over the REST
 * API so it exists in the system and a person can confirm it.
 *
 * What this will never do, by construction rather than by convention:
 *  - set a donation to `paid`. The row is always inserted `pending`; only
 *    staff, matching a bank statement, move it on.
 *  - send a receipt, create a gateway link, or fire a Purchase analytics event.
 *    Those belong to confirmation, and live in markDonationPaid.
 */

/** Stamped on API-created rows; not caller-settable, unlike utm_source. */
export const API_USER_AGENT = "bayarfidyahonline-api/v1";

/** A key shorter than this is too easy to collide with an unrelated payment. */
const MIN_KEY_LENGTH = 8;

/** Largest a "paid at" may sit in the future (clock skew), and how far back. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;

export const manualPaymentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().default(""),
  negeri: z.string().trim().max(60).optional().default(""),
  // A note, or "Bagi pihak arwah NAMA".
  message: z.string().trim().max(500).optional().default(""),
  category: z.string().trim().min(1),
  // For every category except lewat_qada.
  days: z.number().int().min(1).max(365).optional(),
  // For lewat_qada: one entry per missed Ramadan. Days are 1..30 a year.
  qada: z
    .array(
      z.object({
        hijri_year: z.number().int(),
        days: z.number().int().min(1).max(MAX_RAMADAN_DAYS),
      })
    )
    .min(1)
    .max(MAX_QADA_ROWS)
    .optional(),
  // What the sender believes was paid. Never trusted: the server recomputes.
  amount_sen: z.number().int().min(100),
  method: z.enum(["qr", "bank_transfer"]),
  paid_at: z.iso.datetime({ offset: true }).optional(),
  utm_source: z.string().trim().min(1).max(100).optional().default(CHATBOT_SOURCE),
  idempotency_key: z
    .string()
    .regex(
      new RegExp(`^[\\x21-\\x7E]{${MIN_KEY_LENGTH},200}$`),
      `Mesti ${MIN_KEY_LENGTH}-200 aksara boleh cetak tanpa ruang.`
    ),
});

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;

export type ParseResult =
  | { ok: true; data: ManualPaymentInput }
  | { ok: false; issues: { field: string; message: string }[] };

/**
 * Validate a request body. Beyond the schema, three rules that a schema cannot
 * express: no `status` may be sent (the caller does not get a say in it),
 * lewat_qada needs `qada` and everything else needs `days`, and `paid_at` must
 * be a believable moment.
 */
export function parseManualPaymentBody(
  payload: unknown,
  now: Date = new Date()
): ParseResult {
  const issues: { field: string; message: string }[] = [];

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      ok: false,
      issues: [{ field: "", message: "Badan permintaan mesti objek JSON." }],
    };
  }

  if ("status" in payload) {
    issues.push({
      field: "status",
      message:
        "Status tidak boleh ditetapkan melalui API. Rekod sentiasa bermula sebagai Perlu Semak dan hanya staf boleh mengesahkannya.",
    });
  }

  const parsed = manualPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      issues.push({ field: i.path.join("."), message: i.message });
    }
    return { ok: false, issues };
  }
  const data = parsed.data;

  if (data.category === QADA_CATEGORY_ID) {
    if (!data.qada) {
      issues.push({
        field: "qada",
        message: "Diperlukan untuk kategori lewat_qada: [{hijri_year, days}].",
      });
    }
  } else if (data.days === undefined) {
    issues.push({ field: "days", message: "Diperlukan untuk kategori ini." });
  }

  if (data.paid_at) {
    const at = new Date(data.paid_at).getTime();
    if (at > now.getTime() + FUTURE_SKEW_MS) {
      issues.push({ field: "paid_at", message: "Tarikh bayaran tidak boleh pada masa depan." });
    } else if (at < now.getTime() - MAX_AGE_MS) {
      issues.push({ field: "paid_at", message: "Tarikh bayaran terlalu lama (lebih setahun)." });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, data };
}

export type ManualPaymentResult =
  | {
      ok: true;
      /** False when an existing record was returned for a repeated key. */
      created: boolean;
      donation: Donation;
      requiresStaffReview: boolean;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      details?: Record<string, unknown>;
    };

export interface ManualPaymentDeps {
  supabase: SupabaseClient;
  /** Fidyah rate per day, in sen. */
  rateSen: number;
  now?: Date;
  clientIp?: string | null;
}

const MIGRATION_MESSAGE =
  "Pangkalan data belum dikemas kini. Jalankan supabase/add-manual-payments.sql.";

const migrationRequired = (): ManualPaymentResult => ({
  ok: false,
  status: 503,
  code: "MIGRATION_REQUIRED",
  error: MIGRATION_MESSAGE,
});

/** Postgres: unique violation / check violation. */
const isUniqueViolation = (e: { code?: string } | null) => e?.code === "23505";
const isCheckViolation = (e: { code?: string } | null) => e?.code === "23514";

/** Whether the schema lacks what this endpoint stores. */
function schemaIsBehind(
  e: { code?: string; message?: string } | null | undefined
): boolean {
  return (
    isMissingColumnError(e, "idempotency_key") ||
    isMissingColumnError(e, "claimed_paid_at") ||
    // payment_method 'qr' / 'bank_transfer' refused by the old constraint.
    (isCheckViolation(e ?? null) &&
      (e?.message ?? "").includes("donations_payment_method_check"))
  );
}

export async function createManualPayment(
  input: ManualPaymentInput,
  deps: ManualPaymentDeps
): Promise<ManualPaymentResult> {
  const { supabase } = deps;
  const now = deps.now ?? new Date();

  const findByKey = () =>
    supabase
      .from("donations")
      .select("*")
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle<Donation>();

  // A repeated key returns what the first call made. Checked before any
  // pricing, so a retry after the rate changes still gets the original record.
  {
    const { data: existing, error } = await findByKey();
    if (error) {
      if (schemaIsBehind(error)) return migrationRequired();
      console.error("[manual-payment] idempotency lookup failed:", error);
      return {
        ok: false,
        status: 500,
        code: "LOOKUP_FAILED",
        error: "Gagal menyemak kunci idempotensi.",
      };
    }
    if (existing) {
      return {
        ok: true,
        created: false,
        donation: existing,
        requiresStaffReview: existing.amount_sen >= QADA_REVIEW_THRESHOLD_SEN,
      };
    }
  }

  // The server works out what was owed. The caller's figure is only compared
  // against it, never used.
  const priced = priceOrder(
    {
      category: input.category,
      days: input.days ?? 1,
      multiplier: 1,
      // Passed through for any category: priceOrder refuses a year breakdown on
      // anything but lewat qada', which is the right answer to send back.
      qada: input.qada?.map((r) => ({ hijriYear: r.hijri_year, days: r.days })),
    },
    deps.rateSen,
    now
  );
  if (!priced.ok) {
    return {
      ok: false,
      status: priced.status,
      code: "INVALID_ORDER",
      error: priced.error,
      details: priced.details,
    };
  }
  const { calc, qada } = priced;

  if (input.amount_sen !== calc.totalSen) {
    return {
      ok: false,
      status: 409,
      code: "AMOUNT_MISMATCH",
      error:
        "Jumlah yang dihantar tidak sepadan dengan jumlah yang dikira pelayan.",
      details: {
        expected_amount_sen: input.amount_sen,
        amount_sen: calc.totalSen,
        amount: calc.totalSen / 100,
      },
    };
  }

  const row: Record<string, unknown> = {
    reference: makeReference(),
    payment_method: input.method,
    payer_name: input.name,
    payer_email: input.email,
    payer_phone: input.phone || null,
    negeri: input.negeri || null,
    category: input.category,
    days: calc.days,
    multiplier: calc.multiplier,
    rate_sen: calc.rateSen,
    amount_sen: calc.totalSen,
    message: input.message || null,
    // Always pending. Not a default that something could override: it is the
    // one value this function writes, and nothing in the input reaches it.
    status: "pending",
    upsell_accepted: false,
    upsell_title: null,
    upsell_amount_sen: 0,
    utm_source: input.utm_source,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    gclid: null,
    gbraid: null,
    wbraid: null,
    ga_client_id: null,
    fbp: null,
    fbc: null,
    client_ip: deps.clientIp ?? null,
    user_agent: API_USER_AGENT,
    landing_url: null,
    idempotency_key: input.idempotency_key,
    claimed_paid_at: input.paid_at ? new Date(input.paid_at).toISOString() : null,
  };

  const attempt = (r: Record<string, unknown>) =>
    supabase.from("donations").insert(r).select().single<Donation>();

  // Only a lewat qada' order names qada_breakdown, so no other payment can be
  // failed by that column being missing. If it is missing, keep the working in
  // the note rather than lose the payment record.
  let { data: donation, error: insertError } = await attempt(
    qada ? { ...row, qada_breakdown: qada.breakdown } : row
  );
  if (qada && isMissingColumnError(insertError, "qada_breakdown")) {
    ({ data: donation, error: insertError } = await attempt({
      ...row,
      message: [qada.note, input.message].filter(Boolean).join("\n"),
    }));
  }

  if (insertError) {
    // Two calls with the same key at once: the unique index let one in. The
    // loser returns the winner's record, which is what idempotency means.
    if (isUniqueViolation(insertError)) {
      const { data: winner } = await findByKey();
      if (winner) {
        return {
          ok: true,
          created: false,
          donation: winner,
          requiresStaffReview: winner.amount_sen >= QADA_REVIEW_THRESHOLD_SEN,
        };
      }
    }
    if (schemaIsBehind(insertError)) return migrationRequired();
    console.error("[manual-payment] insert failed:", insertError);
    return {
      ok: false,
      status: 500,
      code: "INSERT_FAILED",
      error: "Gagal merekod bayaran manual.",
    };
  }
  if (!donation) {
    return {
      ok: false,
      status: 500,
      code: "INSERT_FAILED",
      error: "Gagal merekod bayaran manual.",
    };
  }

  return {
    ok: true,
    created: true,
    donation,
    requiresStaffReview: donation.amount_sen >= QADA_REVIEW_THRESHOLD_SEN,
  };
}
