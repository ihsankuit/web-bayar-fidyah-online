import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
