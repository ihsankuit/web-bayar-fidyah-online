import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiActor,
  apiKeyFingerprint,
  isAuthorized,
  unauthorized,
} from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { attachProof, type ProofSource } from "@/lib/proof-attach";
import { MAX_PROOF_BYTES } from "@/lib/proof-file";
import { checkRateLimit } from "@/lib/rate-limit";

const urlBodySchema = z.object({
  proof_url: z.string().trim().min(1).max(2048),
});

/** Headroom over the file itself for the multipart framing around it. */
const MULTIPART_OVERHEAD = 256 * 1024;

const err = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status });

/**
 * POST /api/v1/donations/{reference}/proof
 *
 * Attach proof of payment to a QR / bank-transfer record created through
 * POST /api/v1/donations/manual. Auth: API key.
 *
 * Send EITHER multipart/form-data with a `file` field, OR JSON
 * `{"proof_url": "https://api.murpati.com/..."}` and the server downloads it.
 * JPG, PNG, WEBP or PDF, 5MB at most, identified from the file's own bytes.
 * Only a record still awaiting review can take one; a new proof replaces any
 * earlier one.
 *
 * Note for large files: a multipart body is also subject to the host's own
 * request-size limit (about 4.5MB on Vercel). `proof_url` is not, because the
 * file never passes through the request.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  if (!(await isAuthorized(request))) return unauthorized();

  if (
    !(await checkRateLimit(
      `api-v1-proof:${apiKeyFingerprint(request)}`,
      30,
      60
    ))
  ) {
    return err(429, "RATE_LIMITED", "Rate limit exceeded. Max 30 requests per minute per key.");
  }

  const { reference } = await params;
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  let source: ProofSource;

  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return err(400, "INVALID_JSON", "Invalid JSON body");
    }
    const parsed = urlBodySchema.safeParse(body);
    if (!parsed.success) {
      return err(400, "VALIDATION_FAILED", "Diperlukan: {\"proof_url\": \"https://...\"}.");
    }
    source = { kind: "url", url: parsed.data.proof_url };
  } else if (contentType.includes("multipart/form-data")) {
    // Refuse an oversized body before reading it into memory.
    const declared = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declared) &&
      declared > MAX_PROOF_BYTES + MULTIPART_OVERHEAD
    ) {
      return err(413, "FILE_TOO_LARGE", "Saiz fail melebihi had 5MB.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return err(400, "INVALID_FORM", "Permintaan multipart tidak sah.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return err(400, "VALIDATION_FAILED", "Medan `file` diperlukan.");
    }
    if (file.size > MAX_PROOF_BYTES) {
      return err(413, "FILE_TOO_LARGE", "Saiz fail melebihi had 5MB.");
    }
    source = { kind: "file", bytes: new Uint8Array(await file.arrayBuffer()) };
  } else {
    return err(
      415,
      "UNSUPPORTED_CONTENT_TYPE",
      "Guna multipart/form-data (medan `file`) atau application/json ({\"proof_url\": ...})."
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return err(503, "NOT_CONFIGURED", "Pangkalan data belum dikonfigurasi.");
  }

  const result = await attachProof({ supabase }, reference, source);
  if (!result.ok) {
    return err(result.status, result.code, result.error);
  }

  await logActivity(
    "donation.api_attach_proof",
    {
      reference: result.donation.reference,
      source: source.kind === "url" ? "proof_url" : "file",
      file: result.filename,
      replaced: result.replaced ? "ya" : "tidak",
    },
    apiActor(request)
  );

  return NextResponse.json({
    data: { reference: result.donation.reference, proof_attached: true },
  });
}
