import crypto from "crypto";
import { NextResponse } from "next/server";
import type { Donation } from "@/lib/database.types";

/**
 * Bearer/API-key auth for the public REST API (`/api/v1/*`). Set `API_KEY` to
 * enable it. Clients send `Authorization: Bearer <key>` or `X-API-Key: <key>`.
 */
export function isAuthorized(request: Request): boolean {
  const key = process.env.API_KEY;
  if (!key) return false; // API disabled until a key is configured.

  const auth = request.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const provided = bearer ?? request.headers.get("x-api-key");
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
