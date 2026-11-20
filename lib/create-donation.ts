import { createAdminClient } from "@/lib/supabase/admin";
import { createPurchase } from "@/lib/chip";
import { calculateFidyah, getCategory } from "@/lib/fidyah";
import { getLandingContent } from "@/lib/settings";
import { getUpsellSettings } from "@/lib/upsell";
import type { Donation } from "@/lib/database.types";

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
      donation: Donation;
    }
  | {
      ok: true;
      method: "chip";
      reference: string;
      amountSen: number;
      checkoutUrl: string;
      donation: Donation;
    }
  | { ok: false; status: number; error: string };

function makeReference(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `FID-${stamp}${rand}`;
}

export async function createDonation(
  input: CreateDonationInput
): Promise<CreateDonationResult> {
  if (!getCategory(input.category)) {
    return { ok: false, status: 400, error: "Kategori tidak sah." };
  }

  const content = await getLandingContent();
  const calc = calculateFidyah({
    days: input.days,
    multiplier: input.multiplier,
    rateSen: content.fidyah_rate_sen,
  });

  if (calc.totalSen < 100) {
    return {
      ok: false,
      status: 400,
      error: "Jumlah minimum pembayaran ialah RM1.00.",
    };
  }

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

  const { data: donation, error: insertError } = await supabase
    .from("donations")
    .insert({
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
    })
    .select()
    .single<Donation>();

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
