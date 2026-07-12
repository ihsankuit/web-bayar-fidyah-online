import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized, serializeDonation } from "@/lib/api";
import type { Donation, DonationStatus } from "@/lib/database.types";

/**
 * GET /api/v1/donations
 * List donations for automations (e.g. n8n). Auth: API key.
 * Query params: status, limit (<=200), offset, from, to (ISO, on created_at).
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as DonationStatus | null;
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    200
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("donations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && ["pending", "paid", "failed"].includes(status)) {
      query = query.eq("status", status);
    }
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: ((data as Donation[]) ?? []).map(serializeDonation),
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[api/v1/donations]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
