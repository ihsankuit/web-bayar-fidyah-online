import crypto from "crypto";
import { NextResponse } from "next/server";
import type { BlogPost, Donation } from "@/lib/database.types";
import { getIntegrationSettings } from "@/lib/integrations";
import { apiStatus } from "@/lib/payment-methods";

/**
 * Bearer/API-key auth for the public REST API (`/api/v1/*`). The key is managed
 * from the admin panel (Integrasi) or falls back to the `API_KEY` env var.
 * Clients send `Authorization: Bearer <key>` or `X-API-Key: <key>`.
 */
export async function isAuthorized(request: Request): Promise<boolean> {
  const { api_key: key } = await getIntegrationSettings();
  if (!key) return false; // API disabled until a key is configured.

  const auth = request.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const provided = bearer ?? request.headers.get("x-api-key");
  if (!provided) return false;

  // Hash both to a fixed 32-byte digest before comparing so the compare is
  // constant-time and never leaks the key length via a length check.
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(key).digest();
  return crypto.timingSafeEqual(a, b);
}

export function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized. Provide a valid API key." },
    { status: 401 }
  );
}

/**
 * A short, non-reversible fingerprint of the caller's key, for rate-limit
 * buckets.
 *
 * Write endpoints throttle per key rather than per IP. A chatbot or
 * automation calls from one server address, so an IP bucket would make every
 * one of its users share a single allowance — and the real unit of trust
 * here is the key, not where it happens to be hosted.
 */
export function apiKeyFingerprint(request: Request): string {
  const auth = request.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const provided = bearer ?? request.headers.get("x-api-key") ?? "";
  return crypto.createHash("sha256").update(provided).digest("hex").slice(0, 16);
}

/**
 * Who to name in the activity log for an API-key request. There is no user
 * session, so the key's fingerprint stands in: enough to tell one key from
 * another, never enough to recover it.
 */
export function apiActor(request: Request): string {
  return `api:key-${apiKeyFingerprint(request).slice(0, 8)}`;
}

/** Shape a donation row for API responses (Ringgit amount, no internal noise). */
export function serializeDonation(d: Donation) {
  return {
    reference: d.reference,
    // `review` for a QR / bank-transfer payment recorded over the API that is
    // waiting for staff; every other row keeps its stored status.
    status: apiStatus(d),
    payment_method: d.payment_method,
    proof_attached: Boolean(d.proof_of_payment_path),
    claimed_paid_at: d.claimed_paid_at ?? null,
    payer_name: d.payer_name,
    payer_email: d.payer_email,
    payer_phone: d.payer_phone,
    negeri: d.negeri,
    category: d.category,
    days: d.days,
    multiplier: d.multiplier,
    // Per-year working for lewat qada'; null for other categories.
    qada_breakdown: d.qada_breakdown ?? null,
    amount: d.amount_sen / 100,
    amount_sen: d.amount_sen,
    currency: "MYR",
    message: d.message,
    // Attribution — lets automations (e.g. Hermes) reconcile payments against
    // the campaign/source that drove them.
    utm_source: d.utm_source,
    utm_medium: d.utm_medium,
    utm_campaign: d.utm_campaign,
    utm_term: d.utm_term,
    utm_content: d.utm_content,
    // Google Ads click ids — for offline conversion import back to Ads.
    gclid: d.gclid,
    gbraid: d.gbraid,
    wbraid: d.wbraid,
    paid_at: d.paid_at,
    created_at: d.created_at,
  };
}

/** Shape a blog post row for API responses. */
export function serializeBlogPost(p: BlogPost) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    cover_image: p.cover_image,
    status: p.status,
    author: p.author,
    published_at: p.published_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}
