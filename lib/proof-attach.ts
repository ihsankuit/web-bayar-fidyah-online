import type { SupabaseClient } from "@supabase/supabase-js";

import { isApiRecorded } from "@/lib/payment-methods";
import {
  MAX_PROOF_BYTES,
  fetchProofFromUrl,
  sniffProofType,
  type FetchProofOptions,
} from "@/lib/proof-file";
import type { Donation } from "@/lib/database.types";

export const PROOF_BUCKET = "payment-proofs";

export type ProofSource =
  | { kind: "file"; bytes: Uint8Array }
  | { kind: "url"; url: string };

export type AttachProofResult =
  | { ok: true; donation: Donation; replaced: boolean; filename: string }
  | { ok: false; status: number; code: string; error: string };

export interface AttachProofDeps {
  supabase: SupabaseClient;
  fetchOptions?: FetchProofOptions;
}

const fail = (
  status: number,
  code: string,
  error: string
): AttachProofResult => ({ ok: false, status, code, error });

/**
 * Attach a proof of payment to an API-recorded manual payment.
 *
 * Only a payment that is DuitNow QR / bank transfer AND still waiting for
 * staff (pending) can take one. An online (CHIP) record has its proof in the
 * gateway; a confirmed one is settled and its paper trail must not change
 * underneath a receipt that has already gone out.
 *
 * The file type comes from its first bytes, never from the declared type or
 * the name, and the stored name is built here, never taken from the caller.
 */
export async function attachProof(
  deps: AttachProofDeps,
  reference: string,
  source: ProofSource
): Promise<AttachProofResult> {
  const { supabase } = deps;

  const { data: donation } = await supabase
    .from("donations")
    .select("*")
    .eq("reference", reference)
    .maybeSingle<Donation>();

  if (!donation) {
    return fail(404, "NOT_FOUND", "Rujukan tidak dijumpai.");
  }
  if (!isApiRecorded(donation.payment_method)) {
    return fail(
      409,
      "NOT_MANUAL_PAYMENT",
      "Bukti hanya boleh dilampirkan pada rekod bayaran manual (QR / pindahan bank), bukan bayaran online."
    );
  }
  if (donation.status !== "pending") {
    return fail(
      409,
      "NOT_AWAITING_REVIEW",
      "Bukti hanya boleh dilampirkan pada rekod berstatus Perlu Semak."
    );
  }

  let bytes: Uint8Array;
  if (source.kind === "url") {
    const fetched = await fetchProofFromUrl(source.url, deps.fetchOptions);
    if (!fetched.ok) return fail(fetched.status, fetched.code, fetched.error);
    bytes = fetched.bytes;
  } else {
    bytes = source.bytes;
  }

  if (bytes.byteLength === 0) {
    return fail(400, "EMPTY_FILE", "Fail bukti kosong.");
  }
  if (bytes.byteLength > MAX_PROOF_BYTES) {
    return fail(413, "FILE_TOO_LARGE", "Saiz fail melebihi had 5MB.");
  }

  const kind = sniffProofType(bytes);
  if (!kind) {
    return fail(
      415,
      "UNSUPPORTED_FILE_TYPE",
      "Jenis fail tidak disokong. Guna JPG, PNG, WEBP atau PDF."
    );
  }

  // Read before anything is written, so what "replaced" means cannot depend
  // on what a later call hands back.
  const previousPath = donation.proof_of_payment_path;

  const filename = `${Date.now()}-bukti.${kind.ext}`;
  const path = `${donation.reference}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (uploadError) {
    console.error("[attach-proof] upload failed:", uploadError);
    return fail(500, "UPLOAD_FAILED", "Gagal menyimpan bukti pembayaran.");
  }

  // Guarded on status so a confirmation that lands between the check above and
  // this write is not quietly overwritten: zero rows updated means someone got
  // there first, and the file just uploaded is orphaned, so remove it.
  const { data: updated, error: updateError } = await supabase
    .from("donations")
    .update({ proof_of_payment_path: path })
    .eq("id", donation.id)
    .eq("status", "pending")
    .select("id");

  if (updateError || !updated || updated.length === 0) {
    await supabase.storage.from(PROOF_BUCKET).remove([path]);
    if (updateError) {
      console.error("[attach-proof] row update failed:", updateError);
      return fail(500, "UPDATE_FAILED", "Gagal merekod bukti pembayaran.");
    }
    return fail(
      409,
      "NOT_AWAITING_REVIEW",
      "Rekod ini telah disahkan semasa bukti dimuat naik."
    );
  }

  // Replace, don't accumulate: remove the previous proof now the new one is
  // safely recorded.
  if (previousPath) {
    await supabase.storage.from(PROOF_BUCKET).remove([previousPath]);
  }

  return {
    ok: true,
    donation: { ...donation, proof_of_payment_path: path },
    replaced: Boolean(previousPath),
    filename,
  };
}
