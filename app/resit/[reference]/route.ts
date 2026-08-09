import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReceiptPdf } from "@/lib/receipt-pdf";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { Donation } from "@/lib/database.types";

/**
 * GET /resit/[reference] — downloads the PDF receipt for a settled payment.
 *
 * Only issued once the donation is actually `paid`, so a receipt can never be
 * produced for a payment that hasn't cleared. Like `/status?ref=…`, the
 * reference is what grants access.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  if (!reference) {
    return NextResponse.json({ error: "Rujukan tidak sah." }, { status: 400 });
  }

  if (!(await checkRateLimit(`resit:${clientIp(request)}`, 30, 600))) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Sila cuba sebentar lagi." },
      { status: 429 }
    );
  }

  let donation: Donation | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("donations")
      .select("*")
      .eq("reference", reference)
      .maybeSingle<Donation>();
    donation = data ?? null;
  } catch (err) {
    console.error("[resit] lookup failed:", err);
    return NextResponse.json(
      { error: "Resit tidak tersedia buat masa ini." },
      { status: 503 }
    );
  }

  if (!donation) {
    return NextResponse.json({ error: "Rekod tidak dijumpai." }, { status: 404 });
  }
  if (donation.status !== "paid") {
    return NextResponse.json(
      { error: "Resit hanya tersedia untuk pembayaran yang telah berjaya." },
      { status: 409 }
    );
  }

  try {
    const pdf = await buildReceiptPdf(donation);
    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resit-${donation.reference}.pdf"`,
        // Receipts are per-payer and immutable once paid — never shared cache.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[resit] pdf generation failed:", err);
    return NextResponse.json(
      { error: "Gagal menjana resit." },
      { status: 500 }
    );
  }
}
