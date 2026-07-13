import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { Donation } from "@/lib/database.types";

const BUCKET = "payment-proofs";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Accepts the payer's proof-of-payment upload for a pending manual bank
 * transfer donation. The `reference` acts as the bearer capability (same
 * model as `/status?ref=`) — no separate auth for the public payer.
 */
export async function POST(request: Request) {
  const allowed = await checkRateLimit(
    `fidyah-upload-proof:${clientIp(request)}`,
    10,
    600 // 10 attempts per 10 minutes
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak percubaan. Sila cuba lagi sebentar lagi." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak sah." }, { status: 400 });
  }

  const reference = (form.get("reference") as string | null)?.trim();
  const file = form.get("file") as File | null;

  if (!reference) {
    return NextResponse.json({ error: "Rujukan diperlukan." }, { status: 400 });
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Sila pilih fail bukti pembayaran." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Saiz fail melebihi had 5MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Jenis fail tidak disokong. Guna imej (JPG/PNG/WEBP) atau PDF." },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Pangkalan data belum dikonfigurasi. Sila hubungi pentadbir." },
      { status: 503 }
    );
  }

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("reference", reference)
    .maybeSingle<Donation>();

  if (!donation || donation.payment_method !== "manual") {
    return NextResponse.json({ error: "Rujukan tidak sah." }, { status: 404 });
  }
  if (donation.status === "paid") {
    return NextResponse.json(
      { error: "Sumbangan ini telah disahkan dibayar." },
      { status: 409 }
    );
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "bukti";
  const path = `${reference}/${Date.now()}-${base}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[fidyah/upload-proof] upload failed:", uploadError);
    return NextResponse.json(
      { error: "Gagal memuat naik bukti pembayaran. Sila cuba lagi." },
      { status: 500 }
    );
  }

  await supabase
    .from("donations")
    .update({ proof_of_payment_path: path })
    .eq("id", donation.id);

  return NextResponse.json({ ok: true });
}
