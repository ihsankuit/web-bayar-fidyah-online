import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Donation, DonationStatus } from "@/lib/database.types";
import { getCategory } from "@/lib/fidyah";
import { formatDate } from "@/lib/utils";

const COLUMNS = [
  "Rujukan",
  "Nama",
  "Emel",
  "Telefon",
  "Negeri",
  "Kategori",
  "Hari",
  "Gandaan",
  "Jumlah (RM)",
  "Kaedah",
  "Status",
  "Tarikh",
] as const;

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Admin-only CSV export of donations, honouring the same status/search filters as the list page. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const term = (url.searchParams.get("q") ?? "").trim().replace(/[%,()]/g, "");

  let query = supabase
    .from("donations")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status as DonationStatus);
  }
  if (term) {
    query = query.or(
      `payer_name.ilike.%${term}%,payer_email.ilike.%${term}%,reference.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as Donation[]) ?? [];
  const lines = [COLUMNS.join(",")];
  for (const d of rows) {
    lines.push(
      [
        d.reference,
        d.payer_name,
        d.payer_email,
        d.payer_phone ?? "",
        d.negeri ?? "",
        getCategory(d.category)?.title ?? d.category,
        String(d.days),
        String(d.multiplier),
        (d.amount_sen / 100).toFixed(2),
        d.payment_method,
        d.status,
        formatDate(d.created_at),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `sumbangan-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
