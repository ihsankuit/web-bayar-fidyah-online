import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import type { Donation, DonationStatus } from "@/lib/database.types";

/**
 * GET /api/v1/stats
 * Aggregate donation totals for dashboards/automations. Auth: API key.
 */
export async function GET(request: Request) {
  if (!(await isAuthorized(request))) return unauthorized();
  if (!(await checkRateLimit(`api-v1-stats:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const supabase = createAdminClient();

    // Status counts via exact head-counts — these are not subject to the
    // row-return cap, so they stay correct past 1000 donations.
    const countFor = async (status: DonationStatus) => {
      const { count } = await supabase
        .from("donations")
        .select("*", { count: "exact", head: true })
        .eq("status", status);
      return count ?? 0;
    };
    const [countPaid, countPending, countFailed] = await Promise.all([
      countFor("paid"),
      countFor("pending"),
      countFor("failed"),
    ]);

    // Sum/group over paid rows. A plain select is capped (~1000 rows) by
    // PostgREST, which would silently under-report totals as data grows, so
    // page through every paid row (only the columns we aggregate on).
    const PAGE = 1000;
    type PaidRow = Pick<Donation, "amount_sen" | "category" | "payer_email">;
    const paid: PaidRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabase
        .from("donations")
        .select("amount_sen, category, payer_email")
        .eq("status", "paid")
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1)
        .returns<PaidRow[]>();
      if (error) throw error;
      if (!data || data.length === 0) break;
      paid.push(...data);
      if (data.length < PAGE) break;
    }

    const totalPaidSen = paid.reduce((s, d) => s + d.amount_sen, 0);

    const byCategory: Record<string, { count: number; amount: number }> = {};
    for (const d of paid) {
      const b = (byCategory[d.category] ??= { count: 0, amount: 0 });
      b.count += 1;
      b.amount += d.amount_sen / 100;
    }

    return NextResponse.json({
      currency: "MYR",
      total_collected: totalPaidSen / 100,
      total_collected_sen: totalPaidSen,
      count_paid: countPaid,
      count_pending: countPending,
      count_failed: countFailed,
      unique_payers: new Set(paid.map((d) => d.payer_email)).size,
      by_category: byCategory,
    });
  } catch (err) {
    console.error("[api/v1/stats]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
