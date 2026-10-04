import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import { slugify } from "@/lib/utils";
import type { Donation } from "@/lib/database.types";

const BUCKET = "payment-proofs";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

/** Reject anyone who isn't a signed-in admin. */
async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

/**
 * Returns a short-lived signed URL for a donation's uploaded proof of
 * payment. The `payment-proofs` bucket is private, so this is the only way
 * to view a proof — direct bucket URLs aren't public. Consumed by the
 * ProofViewer dialog (fetched via JS, not navigated to directly).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak dibenarkan." }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: donation } = await admin
    .from("donations")
    .select("proof_of_payment_path")
    .eq("id", id)
    .maybeSingle<{ proof_of_payment_path: string | null }>();

  if (!donation?.proof_of_payment_path) {
    return NextResponse.json({ error: "Bukti tidak dijumpai." }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("payment-proofs")
    .createSignedUrl(donation.proof_of_payment_path, 60 * 10);

  if (error || !signed) {
    return NextResponse.json(
      { error: "Gagal menjana pautan bukti." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}

/**
 * Attach a proof of payment to a donation on the admin's behalf.
 *
 * The payer-facing upload at /api/fidyah/upload-proof only accepts manual
 * bank transfers, and refuses a donation that is already paid — correct for
 * a payer, wrong for an admin. When a CHIP attempt fails and the payer pays
 * some other way and sends the receipt over WhatsApp, it is the admin who
 * has the file, and the record is a CHIP one. So this route takes any
 * donation in any state, gated on the admin session instead of on the
 * reference acting as a bearer token.
 *
 * A route handler rather than a Server Action because Server Actions cap
 * request bodies at 1MB by default, well under a phone photo of a receipt.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Tidak dibenarkan." }, { status: 401 });
  }

  const { id } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak sah." }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "Sila pilih fail bukti pembayaran." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Saiz fail melebihi had 5MB." },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Jenis fail tidak disokong. Guna imej (JPG/PNG/WEBP) atau PDF." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: donation } = await admin
    .from("donations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Donation>();

  if (!donation) {
    return NextResponse.json(
      { error: "Rekod sumbangan tidak dijumpai." },
      { status: 404 }
    );
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "bukti";
  const path = `${donation.reference}/${Date.now()}-${base}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[admin/proof] upload failed:", uploadError);
    return NextResponse.json(
      { error: "Gagal memuat naik bukti pembayaran. Sila cuba lagi." },
      { status: 500 }
    );
  }

  const { error: updateError } = await admin
    .from("donations")
    .update({ proof_of_payment_path: path })
    .eq("id", id);

  if (updateError) {
    // The row is the only thing pointing at the file, so an orphan here would
    // sit in storage forever with nothing able to reach it.
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json(
      { error: "Gagal merekod bukti pembayaran." },
      { status: 500 }
    );
  }

  // Replacing an existing proof leaves the old file behind otherwise.
  if (donation.proof_of_payment_path) {
    await admin.storage.from(BUCKET).remove([donation.proof_of_payment_path]);
  }

  await logActivity("donation.upload_proof", {
    reference: donation.reference,
    filename: file.name,
    replaced: donation.proof_of_payment_path ? "ya" : "tidak",
  });

  return NextResponse.json({ ok: true });
}

/** Remove a proof that was attached to the wrong donation. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Tidak dibenarkan." }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: donation } = await admin
    .from("donations")
    .select("*")
    .eq("id", id)
    .maybeSingle<Donation>();

  if (!donation?.proof_of_payment_path) {
    return NextResponse.json({ error: "Bukti tidak dijumpai." }, { status: 404 });
  }

  await admin.storage.from(BUCKET).remove([donation.proof_of_payment_path]);
  await admin
    .from("donations")
    .update({ proof_of_payment_path: null })
    .eq("id", id);

  await logActivity("donation.delete_proof", {
    reference: donation.reference,
  });

  return NextResponse.json({ ok: true });
}
