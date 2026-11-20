import { createAdminClient } from "@/lib/supabase/admin";
import { createPurchase } from "@/lib/chip";
import {
  calculateFidyah,
  getCategory,
  type FidyahCalculationResult,
} from "@/lib/fidyah";
import { getLandingContent } from "@/lib/settings";
import { getUpsellSettings } from "@/lib/upsell";
import { isMissingColumnError } from "@/lib/db-errors";
import {
  QADA_CATEGORY_ID,
  resolveQadaOrder,
  type QadaOrder,
  type QadaRowInput,
} from "@/lib/ramadan";
import type { Donation, QadaBreakdownRow } from "@/lib/database.types";

/**
 * Creating a fidyah donation, shared by the browser checkout and the REST
 * API.
 *
 * Both callers have to agree on the rate, the minimum, how the upsell is
 * applied and how the CHIP purchase is built. Keeping that in one place is
 * what stops the API quietly charging a different amount than the form once
 * someone edits one of them.
 *
 * The caller owns everything it alone knows — rate limiting, auth, and the
 * tracking identifiers it can see — and passes them in.
 */

export interface CreateDonationInput {
  name: string;
  email: string;
  phone: string;
  negeri: string;
  category: string;
  days: number;
  multiplier: number;
  /**
   * For lewat qada': the years the payer chose. When present the amount is
   * worked out here from the calendar and `days`/`multiplier` are ignored, so
   * what is charged never depends on a figure the caller computed.
   */
  qada?: QadaRowInput[];
  /**
   * The fidyah amount (sen, upsell excluded) the payer was shown. If the
   * server works out something different — a wrong device clock, or a page
   * left open across the day a Ramadan begins — the request is refused with
   * the current figure, rather than charging a sum the payer never saw.
   */
  expectedFidyahSen?: number;
  message: string;
  method: "chip" | "manual";
  upsellAccepted: boolean;
  upsellAmountSen?: number;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    term: string;
    content: string;
  };
  ads: { gclid: string; gbraid: string; wbraid: string };
  /** What the caller can observe about the origin of the request. */
  tracking: {
    gaClientId: string | null;
    fbp: string | null;
    fbc: string | null;
    clientIp: string | null;
    userAgent: string | null;
    landingUrl: string | null;
  };
  /** Origin used to build the CHIP callback and redirect URLs. */
  siteUrl: string;
}

export type CreateDonationResult =
  | {
      ok: true;
      method: "manual";
      reference: string;
      amountSen: number;
      bank: {
        name: string;
        accountName: string;
        accountNumber: string;
        qrImageUrl: string;
      };
      breakdown: QadaBreakdownRow[] | null;
      donation: Donation;
    }
  | {
      ok: true;
      method: "chip";
      reference: string;
      amountSen: number;
      checkoutUrl: string;
      breakdown: QadaBreakdownRow[] | null;
      donation: Donation;
    }
  | {
      ok: false;
      status: number;
      error: string;
      /** Extra fields for the response body, e.g. the current amount. */
      details?: Record<string, unknown>;
    };

/** What an amount depends on — everything except who is paying. */
export interface PriceInput {
  category: string;
  days: number;
  multiplier: number;
  qada?: QadaRowInput[];
  expectedFidyahSen?: number;
}

type PricedOrder =
  | {
      ok: true;
      calc: FidyahCalculationResult;
      qada: Extract<QadaOrder, { ok: true }> | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details?: Record<string, unknown>;
    };

/**
 * Work out what an order costs. The one place that does, for creating a
 * donation and for quoting one, so a quote can never differ from the charge.
 */
function priceOrder(input: PriceInput, rateSen: number, now: Date): PricedOrder {
  if (!getCategory(input.category)) {
    return { ok: false, status: 400, error: "Kategori tidak sah." };
  }

  let qada: Extract<QadaOrder, { ok: true }> | null = null;
  if (input.qada && input.qada.length > 0) {
    if (input.category !== QADA_CATEGORY_ID) {
      return {
        ok: false,
        status: 400,
        error: "Pecahan tahun hanya untuk kategori Lewat qada'.",
      };
    }
    const resolved = resolveQadaOrder(input.qada, rateSen, now);
    if (!resolved.ok) {
      return { ok: false, status: 400, error: resolved.error };
    }
    if (
      input.expectedFidyahSen !== undefined &&
      input.expectedFidyahSen !== resolved.totalSen
    ) {
      return {
        ok: false,
        status: 409,
        error:
          "Jumlah telah dikemas kini mengikut tarikh semasa. Sila semak semula sebelum membayar.",
        details: {
          code: "AMOUNT_CHANGED",
          amountSen: resolved.totalSen,
          // Lets the form recalculate on the server's clock and show the
          // same figure, instead of arguing with it.
          serverTime: now.toISOString(),
        },
      };
    }
    qada = resolved;
  }

  const calc = qada
    ? calculateFidyah({ days: qada.chargeableDays, multiplier: 1, rateSen })
    : calculateFidyah({
        days: input.days,
        multiplier: input.multiplier,
        rateSen,
      });

  if (calc.totalSen < 100) {
    return {
      ok: false,
      status: 400,
      error: "Jumlah minimum pembayaran ialah RM1.00.",
    };
  }
  return { ok: true, calc, qada };
}

export type QuoteResult =
  | {
      ok: true;
      amountSen: number;
      days: number;
      multiplier: number;
      rateSen: number;
      breakdown: QadaBreakdownRow[] | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      details?: Record<string, unknown>;
    };

/** What a donation would cost right now, without creating anything. */
export async function quoteDonation(input: PriceInput): Promise<QuoteResult> {
  const content = await getLandingContent();
  const priced = priceOrder(input, content.fidyah_rate_sen, new Date());
  if (!priced.ok) return priced;
  return {
    ok: true,
    amountSen: priced.calc.totalSen,
    days: priced.calc.days,
    multiplier: priced.calc.multiplier,
    rateSen: priced.calc.rateSen,
    breakdown: priced.qada?.breakdown ?? null,
  };
}

function makeReference(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `FID-${stamp}${rand}`;
}

export async function createDonation(
  input: CreateDonationInput
): Promise<CreateDonationResult> {
  const content = await getLandingContent();
  const priced = priceOrder(input, content.fidyah_rate_sen, new Date());
  if (!priced.ok) return priced;
  const { calc, qada } = priced;

  // The upsell amount is caller-adjustable (like a tip), but only applies if
  // the campaign is actually enabled right now — never trust that alone.
  const upsell = await getUpsellSettings();
  const upsellApplied = input.upsellAccepted && upsell.enabled;
  const upsellAmountSen = upsellApplied
    ? input.upsellAmountSen ?? upsell.amount_sen
    : 0;
  const totalSen = calc.totalSen + upsellAmountSen;

  if (input.method === "manual" && !content.bank_account_number) {
    return {
      ok: false,
      status: 503,
      error:
        "Kaedah pemindahan bank manual belum dikonfigurasi. Sila hubungi pentadbir.",
    };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Pangkalan data belum dikonfigurasi. Sila hubungi pentadbir.",
    };
  }

  const reference = makeReference();

  const row = {
      reference,
      payment_method: input.method,
      payer_name: input.name,
      payer_email: input.email,
      payer_phone: input.phone || null,
      negeri: input.negeri || null,
      category: input.category,
      days: calc.days,
      multiplier: calc.multiplier,
      rate_sen: calc.rateSen,
      amount_sen: totalSen,
      message: input.message || null,
      status: "pending",
      upsell_accepted: upsellApplied,
      upsell_title: upsellApplied ? upsell.title : null,
      upsell_amount_sen: upsellAmountSen,
      utm_source: input.utm.source || null,
      utm_medium: input.utm.medium || null,
      utm_campaign: input.utm.campaign || null,
      utm_term: input.utm.term || null,
      utm_content: input.utm.content || null,
      gclid: input.ads.gclid || null,
      gbraid: input.ads.gbraid || null,
      wbraid: input.ads.wbraid || null,
      ga_client_id: input.tracking.gaClientId,
      fbp: input.tracking.fbp,
      fbc: input.tracking.fbc,
      client_ip: input.tracking.clientIp,
      user_agent: input.tracking.userAgent,
      landing_url: input.tracking.landingUrl,
  };

  // Only a lewat qada' order names the new column, so every other kind of
  // donation is untouched by it — it cannot fail a payment that has no
  // breakdown to store.
  const firstAttempt: Record<string, unknown> = qada
    ? { ...row, qada_breakdown: qada.breakdown }
    : row;
  let { data: donation, error: insertError } = await supabase
    .from("donations")
    .insert(firstAttempt)
    .select()
    .single<Donation>();

  // The code can go live before supabase/add-qada-breakdown.sql is run. A
  // payment is not worth losing over missing bookkeeping, so retry without
  // the column and put the working in the note instead, where it is still
  // readable. The warning says what to do about it.
  if (qada && isMissingColumnError(insertError, "qada_breakdown")) {
    console.warn(
      "[create-donation] qada_breakdown column is missing — run supabase/add-qada-breakdown.sql. Storing the working in the note instead."
    );
    ({ data: donation, error: insertError } = await supabase
      .from("donations")
      .insert({
        ...row,
        message: [qada.note, input.message].filter(Boolean).join("\n"),
      })
      .select()
      .single<Donation>());
  }

  if (insertError || !donation) {
    console.error("[create-donation] insert failed:", insertError);
    return {
      ok: false,
      status: 500,
      error: "Gagal merekod pembayaran. Sila cuba lagi.",
    };
  }

  if (input.method === "manual") {
    return {
      ok: true,
      method: "manual",
      reference,
      amountSen: totalSen,
      bank: {
        name: content.bank_name,
        accountName: content.bank_account_name,
        accountNumber: content.bank_account_number,
        qrImageUrl: content.bank_qr_image_url,
      },
      breakdown: qada?.breakdown ?? null,
      donation,
    };
  }

  try {
    const encodedRef = encodeURIComponent(reference);
    const purchase = await createPurchase({
      email: input.email,
      name: input.name,
      phone: input.phone,
      // The upsell rides along as its own line item rather than being folded
      // into the fidyah amount, so the CHIP receipt itemises the two.
      amountSen: calc.totalSen,
      description: `Fidyah ${calc.days} hari — ${reference}`,
      extraLineItem: upsellApplied
        ? {
            description: upsell.title || "Kempen Tambahan",
            amountSen: upsellAmountSen,
          }
        : undefined,
      successCallbackUrl: `${input.siteUrl}/api/chip/callback`,
      successRedirectUrl: `${input.siteUrl}/api/chip/redirect?ref=${encodedRef}&result=success`,
      failureRedirectUrl: `${input.siteUrl}/api/chip/redirect?ref=${encodedRef}&result=failure`,
      reference,
    });

    await supabase
      .from("donations")
      .update({ chip_purchase_id: purchase.id })
      .eq("id", donation.id);

    return {
      ok: true,
      method: "chip",
      reference,
      amountSen: totalSen,
      checkoutUrl: purchase.checkout_url,
      breakdown: qada?.breakdown ?? null,
      donation,
    };
  } catch (err) {
    console.error("[create-donation] chip failed:", err);
    // The row exists but can never be paid — mark it so it doesn't sit in
    // the dashboard looking like a payer who simply hasn't finished.
    await supabase
      .from("donations")
      .update({ status: "failed" })
      .eq("id", donation.id);
    return {
      ok: false,
      status: 502,
      error:
        "Gerbang pembayaran belum dikonfigurasi atau tidak tersedia. Sila hubungi pentadbir.",
    };
  }
}
