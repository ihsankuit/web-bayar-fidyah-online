import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createBill } from "@/lib/billplz";
import { calculateFidyah, getCategory } from "@/lib/fidyah";
import { getLandingContent } from "@/lib/settings";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional().default(""),
  negeri: z.string().trim().max(60).optional().default(""),
  category: z.string().trim().min(1),
  days: z.number().int().min(1).max(365),
  multiplier: z.number().int().min(1).max(20),
  message: z.string().trim().max(500).optional().default(""),
});

function makeReference(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `FID-${stamp}${rand}`;
}

export async function POST(request: Request) {
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

  // 1. Record the pending donation.
  const { data: donation, error: insertError } = await supabase
    .from("donations")
    .insert({
      reference,
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
      status: "pending",
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

  // 2. Create the Billplz bill.
  try {
    const bill = await createBill({
      email: input.email,
      name: input.name,
      amountSen: calc.totalSen,
      description: `Fidyah ${calc.days} hari — ${reference}`,
      callbackUrl: `${siteUrl}/api/billplz/callback`,
      redirectUrl: `${siteUrl}/api/billplz/redirect`,
      reference,
    });

    await supabase
      .from("donations")
      .update({ billplz_bill_id: bill.id })
      .eq("id", donation.id);

    return NextResponse.json({ url: bill.url, reference });
  } catch (err) {
    console.error("[fidyah/create] billplz failed:", err);
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
