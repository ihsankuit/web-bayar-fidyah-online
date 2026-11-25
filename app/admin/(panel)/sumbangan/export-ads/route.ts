import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  buildAdsConversionCsv,
  type AdsClickIdType,
} from "@/lib/google-ads-export";
import type { Donation } from "@/lib/database.types";

/**
 * GET /admin/sumbangan/export-ads — Google Ads offline conversion file.
 *
 * Query: type (gclid | gbraid | wbraid), name (the conversion action's name in
 * Google Ads), from / to (YYYY-MM-DD, Malaysia time, on the paid date).
 * Admin only: the donation list and its click ids are not public.
 */
export async function GET(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Pangkalan data belum dikonfigurasi." },
      { status: 503 }
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak dibenarkan." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const typeParam = params.get("type");
  const type: AdsClickIdType =
    typeParam === "gbraid" || typeParam === "wbraid" ? typeParam : "gclid";
  const conversionName = (params.get("name") ?? "").trim();
  if (!conversionName) {
    return NextResponse.json(
      { error: "Sila masukkan nama penukaran seperti dalam Google Ads." },
      { status: 400 }
    );
  }
  const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = dateOk(params.get("from"));
  const to = dateOk(params.get("to"));

  // Malaysia is UTC+8: midnight there is 16:00 UTC the day before.
  const fromIso = from ? new Date(`${from}T00:00:00+08:00`).toISOString() : null;
  const toIso = to ? new Date(`${to}T23:59:59.999+08:00`).toISOString() : null;

  // PostgREST caps one response at about 1000 rows, so page through.
  const rows: Donation[] = [];
  const CHUNK = 1000;
  for (let start = 0; ; start += CHUNK) {
    let q = supabase
      .from("donations")
      .select("*")
      .eq("status", "paid")
      .not(type, "is", null)
      .neq(type, "")
      .order("paid_at", { ascending: true })
      .range(start, start + CHUNK - 1);
    if (fromIso) q = q.gte("paid_at", fromIso);
    if (toIso) q = q.lte("paid_at", toIso);
    const { data, error } = await q;
    if (error) {
      console.error("[export-ads] query failed:", error);
      return NextResponse.json({ error: "Gagal membaca data." }, { status: 500 });
    }
    const batch = (data as Donation[]) ?? [];
    rows.push(...batch);
    if (batch.length < CHUNK) break;
  }

  const { csv, count } = buildAdsConversionCsv(rows, { type, conversionName });
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="google-ads-${type}-${stamp}.csv"`,
      "X-Row-Count": String(count),
      "Cache-Control": "private, no-store",
    },
  });
}
