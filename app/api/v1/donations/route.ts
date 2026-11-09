import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized, serializeDonation } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { Donation, DonationStatus } from "@/lib/database.types";

/**
 * GET /api/v1/donations
 * List donations for automations (e.g. n8n). Auth: API key.
 * Query params: status, utm_source, from, to (ISO, on created_at), offset,
 * limit. `limit` is optional and uncapped — omit it to return every matching
 * row (paged through internally).
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-donations:${clientIp(request)}`, 120, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as DonationStatus | null;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const utmSource = url.searchParams.get("utm_source");
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  // No cap: a provided `limit` is honoured as-is; omitting it returns all rows.
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : null;

  try {
    const supabase = createAdminClient();

    // Build a fresh filtered query each time — a PostgREST builder can't be
    // reused once it has been awaited.
    const buildQuery = () => {
      let q = supabase
        .from("donations")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (status && ["pending", "paid", "failed"].includes(status)) {
        q = q.eq("status", status);
      }
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      if (utmSource) q = q.eq("utm_source", utmSource);
      return q;
    };

    // PostgREST caps a single response at ~1000 rows, so page through in
    // chunks — this is what lets "no limit" return the entire set.
    const CHUNK = 1000;
    const rows: Donation[] = [];
    let total = 0;
    let start = offset;
    for (;;) {
      const want = limit === null ? CHUNK : Math.min(CHUNK, limit - rows.length);
      if (want <= 0) break;
      const { data, count, error } = await buildQuery().range(
        start,
        start + want - 1
      );
      if (error) throw error;
      total = count ?? total;
      const batch = (data as Donation[]) ?? [];
      rows.push(...batch);
      if (batch.length < want) break; // no more rows
      start += batch.length;
    }

    return NextResponse.json({
      data: rows.map(serializeDonation),
      count: total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[api/v1/donations]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
