import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPurchase } from "@/lib/chip";
import { calculateFidyah, getCategory } from "@/lib/fidyah";
import { getLandingContent } from "@/lib/settings";
import { getUpsellSettings } from "@/lib/upsell";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { emitDonationEvent } from "@/lib/webhooks";
import { parseCookieHeader } from "@/lib/tracking/cookies";
import { parseGaClientId } from "@/lib/tracking/google";
import type { Donation } from "@/lib/database.types";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().default(""),
  negeri: z.string().trim().max(60).optional().default(""),
  category: z.string().trim().min(1),
  days: z.number().int().min(1).max(365),
  multiplier: z.number().int().min(1).max(20),
  message: z.string().trim().max(500).optional().default(""),
  method: z.enum(["chip", "manual"]).optional().default("chip"),
  upsellAccepted: z.boolean().optional().default(false),
  upsellAmountSen: z.number().int().min(100).max(100_000_00).optional(),
  utm_source: z.string().trim().max(100).optional().default(""),
  utm_medium: z.string().trim().max(100).optional().default(""),
  utm_campaign: z.string().trim().max(100).optional().default(""),
  utm_term: z.string().trim().max(100).optional().default(""),
  utm_content: z.string().trim().max(100).optional().default(""),
});

function makeReference(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `FID-${stamp}${rand}`;
}

export async function POST(request: Request) {
  const allowed = await checkRateLimit(
    `fidyah-create:${clientIp(request)}`,
    5,
    600 // 5 attempts per 10 minutes
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

  if (!getCategory(input.category)) {
    return NextResponse.json({ error: "Kategori tidak sah." }, { status: 400 });
  }

  const content = await getLandingContent();
  const calc = calculateFidyah({
    days: input.days,
    multiplier: input.multiplier,
    rateSen: content.fidyah_rate_sen,
  });

  if (calc.totalSen < 100) {
    return NextResponse.json(
      { error: "Jumlah minimum pembayaran ialah RM1.00." },
      { status: 400 }
    );
  }

  // The upsell amount is payer-adjustable (like a tip), but only applies if
  // the campaign is actually enabled right now — never trust that alone.
  // The schema already bounds upsellAmountSen to [RM1, RM100,000]; fall back
  // to the campaign's own default if the payer didn't supply one.
  const upsell = await getUpsellSettings();
  const upsellApplied = input.upsellAccepted && upsell.enabled;
  const upsellAmountSen = upsellApplied
    ? input.upsellAmountSen ?? upsell.amount_sen
    : 0;
  const totalSen = calc.totalSen + upsellAmountSen;

  if (input.method === "manual" && !content.bank_account_number) {
    return NextResponse.json(
      {
        error:
          "Kaedah pemindahan bank manual belum dikonfigurasi. Sila hubungi pentadbir.",
      },
      { status: 503 }
    );
  }

  const reference = makeReference();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Pangkalan data belum dikonfigurasi. Sila hubungi pentadbir." },
      { status: 503 }
    );
  }

  // Capture conversion attribution from the payer's own browser now, while
  // it's actually here — a manual bank transfer is only confirmed later by
  // an admin, with no browser around to fire the pixel at that point.
  const cookies = parseCookieHeader(request.headers.get("cookie"));

  // 1. Record the pending donation.
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
      utm_source: input.utm_source || null,
      utm_medium: input.utm_medium || null,
      utm_campaign: input.utm_campaign || null,
      utm_term: input.utm_term || null,
      utm_content: input.utm_content || null,
      ga_client_id: parseGaClientId(cookies["_ga"]),
      fbp: cookies["_fbp"] || null,
      fbc: cookies["_fbc"] || null,
      client_ip: clientIp(request),
      user_agent: request.headers.get("user-agent") || null,
      landing_url: request.headers.get("referer") || null,
    })
    .select()
    .single();

  if (insertError || !donation) {
    console.error("[fidyah/create] insert failed:", insertError);
    return NextResponse.json(
      { error: "Gagal merekod pembayaran. Sila cuba lagi." },
      { status: 500 }
    );
  }

  // Notify automations that a new (pending) donation was created.
  await emitDonationEvent("donation.created", donation as Donation);

  // 2a. Manual bank transfer — hand back the account details and wait for
  // the payer to upload proof and an admin to confirm.
  if (input.method === "manual") {
    return NextResponse.json({
      method: "manual",
      reference,
      amountSen: totalSen,
      bank: {
        name: content.bank_name,
        accountName: content.bank_account_name,
        accountNumber: content.bank_account_number,
      },
    });
  }

  // 2b. FPX/card/QR via CHIP.
  try {
    const encodedRef = encodeURIComponent(reference);
    const purchase = await createPurchase({
      email: input.email,
      name: input.name,
      phone: input.phone,
      amountSen: calc.totalSen,
      description: `Fidyah ${calc.days} hari — ${reference}`,
      extraLineItem: upsellApplied
        ? { description: upsell.title || "Kempen Tambahan", amountSen: upsellAmountSen }
        : undefined,
      successCallbackUrl: `${siteUrl}/api/chip/callback`,
      successRedirectUrl: `${siteUrl}/api/chip/redirect?ref=${encodedRef}&result=success`,
      failureRedirectUrl: `${siteUrl}/api/chip/redirect?ref=${encodedRef}&result=failure`,
      reference,
    });

    await supabase
      .from("donations")
      .update({ chip_purchase_id: purchase.id })
      .eq("id", donation.id);

    return NextResponse.json({
      method: "chip",
      url: purchase.checkout_url,
      reference,
    });
  } catch (err) {
    console.error("[fidyah/create] chip failed:", err);
    await supabase
      .from("donations")
      .update({ status: "failed" })
      .eq("id", donation.id);
    return NextResponse.json(
      {
        error:
          "Gerbang pembayaran belum dikonfigurasi atau tidak tersedia. Sila hubungi pentadbir.",
      },
      { status: 502 }
    );
  }
}
