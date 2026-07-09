import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getCategory } from "@/lib/fidyah";
import { formatDate } from "@/lib/utils";
import type { Donation, DonationStatus } from "@/lib/database.types";

const HEADERS = [
  "Rujukan",
  "Nama",
  "Emel",
  "Telefon",
  "Negeri",
  "Kategori",
  "Hari",
  "Gandaan",
  "Kadar (RM)",
  "Jumlah (RM)",
  "Status",
  "Tarikh Dicipta",
  "Tarikh Dibayar",
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "UTM Term",
  "UTM Content",
  "Mesej",
];

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toRow(d: Donation): string {
  return [
    d.reference,
    d.payer_name,
    d.payer_email,
    d.payer_phone ?? "",
    d.negeri ?? "",
    getCategory(d.category)?.title ?? d.category,
    String(d.days),
    String(d.multiplier),
    (d.rate_sen / 100).toFixed(2),
    (d.amount_sen / 100).toFixed(2),
    d.status,
    formatDate(d.created_at),
    d.paid_at ? formatDate(d.paid_at) : "",
    d.utm_source ?? "",
    d.utm_medium ?? "",
    d.utm_campaign ?? "",
    d.utm_term ?? "",
    d.utm_content ?? "",
    d.message ?? "",
  ]
    .map(csvCell)
    .join(",");
}

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
  const status = params.get("status");
  const term = (params.get("q") ?? "").trim().replace(/[%,()]/g, "");

  let query = supabase
    .from("donations")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status as DonationStatus);
  }
  if (term) {
    query = query.or(
      `payer_name.ilike.%${term}%,payer_email.ilike.%${term}%,reference.ilike.%${term}%`
    );
  }

  const { data } = await query;
  const rows = (data as Donation[]) ?? [];

  const csv =
    "﻿" + [HEADERS.join(","), ...rows.map(toRow)].join("\r\n");

  const filename = `sumbangan-${status && status !== "all" ? `${status}-` : ""}${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
