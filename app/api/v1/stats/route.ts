import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorized, unauthorized } from "@/lib/api";
import type { Donation } from "@/lib/database.types";

/**
 * GET /api/v1/stats
 * Aggregate donation totals for dashboards/automations. Auth: API key.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("donations").select("*");
    const rows = (data as Donation[]) ?? [];

    const paid = rows.filter((d) => d.status === "paid");
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
      count_paid: paid.length,
      count_pending: rows.filter((d) => d.status === "pending").length,
      count_failed: rows.filter((d) => d.status === "failed").length,
      unique_payers: new Set(paid.map((d) => d.payer_email)).size,
      by_category: byCategory,
    });
  } catch (err) {
    console.error("[api/v1/stats]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
