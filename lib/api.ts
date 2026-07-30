import crypto from "crypto";
import { NextResponse } from "next/server";
import type { BlogPost, Donation } from "@/lib/database.types";
import { getIntegrationSettings } from "@/lib/integrations";

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

/** Shape a donation row for API responses (Ringgit amount, no internal noise). */
export function serializeDonation(d: Donation) {
  return {
    reference: d.reference,
    status: d.status,
    payer_name: d.payer_name,
    payer_email: d.payer_email,
    payer_phone: d.payer_phone,
    negeri: d.negeri,
    category: d.category,
    days: d.days,
    multiplier: d.multiplier,
    amount: d.amount_sen / 100,
    amount_sen: d.amount_sen,
    currency: "MYR",
    message: d.message,
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
