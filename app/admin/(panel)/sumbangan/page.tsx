import Link from "next/link";
import { Download, RefreshCw, Send } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { Donation, DonationStatus } from "@/lib/database.types";
import { formatMYR, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";
import { StatusBadge } from "@/components/admin/status-badge";
import { ProofViewer } from "@/components/admin/proof-viewer";
import {
  confirmManualPayment,
  recheckChipStatus,
  resendReceipt,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const filters: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "review", label: "Perlu Semak" },
  { key: "paid", label: "Berjaya" },
  { key: "pending", label: "Menunggu" },
  { key: "failed", label: "Gagal" },
];

function searchTerm(term: string) {
  // Escape characters that are meaningful in PostgREST's `or=` filter syntax.
  return term.replace(/[%,()]/g, "");
}

export default async function SumbanganPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status = "all", q = "", page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const term = searchTerm(q.trim());
  const supabase = await createClient();

  let listQuery = supabase
    .from("donations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  let sumQuery = supabase
    .from("donations")
    .select("amount_sen")
    .eq("status", "paid");

  if (status === "review") {
    // Manual transfers with proof uploaded, awaiting admin confirmation.
    listQuery = listQuery
      .eq("status", "pending")
      .eq("payment_method", "manual")
      .not("proof_of_payment_path", "is", null);
  } else if (status !== "all") {
    listQuery = listQuery.eq("status", status as DonationStatus);
  }
  if (term) {
    const orFilter = `payer_name.ilike.%${term}%,payer_email.ilike.%${term}%,reference.ilike.%${term}%`;
    listQuery = listQuery.or(orFilter);
    sumQuery = sumQuery.or(orFilter);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data, count }, { data: sumRows }] = await Promise.all([
    listQuery.range(from, to),
    sumQuery,
  ]);

  const rows = (data as Donation[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalPaidSen = (sumRows ?? []).reduce(
    (s, d) => s + (d as { amount_sen: number }).amount_sen,
    0
  );

  function pageHref(target: { status?: string; q?: string; page?: number }) {
    const params = new URLSearchParams();
    const s = target.status ?? status;
    const query = target.q ?? q;
    const p = target.page ?? page;
    if (s !== "all") params.set("status", s);
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/sumbangan${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sumbangan</h1>
          <p className="text-muted-foreground">
            Senarai pembayaran fidyah dan pembayar.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Jumlah terkumpul (ditapis)
          </p>
          <p className="text-2xl font-bold text-primary">
            {formatMYR(totalPaidSen)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={pageHref({ status: f.key, page: 1 })}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                status === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <form action="/admin/sumbangan" method="get" className="flex gap-2">
            {status !== "all" && (
              <input type="hidden" name="status" value={status} />
            )}
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Cari nama, emel atau rujukan..."
              className="w-64"
            />
            <Button type="submit" variant="outline" size="sm">
              Cari
            </Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/admin/sumbangan/export?${new URLSearchParams({
                ...(status !== "all" ? { status } : {}),
                ...(q ? { q } : {}),
              }).toString()}`}
            >
              <Download className="h-4 w-4" /> Eksport CSV
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{total} rekod</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tiada rekod ditemui.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rujukan</TableHead>
                  <TableHead>Pembayar</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Hari</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Kaedah</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tarikh</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      {d.reference}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{d.payer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.payer_email}
                        {d.negeri ? ` · ${d.negeri}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getCategory(d.category)?.title ?? d.category}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.days} × {d.multiplier}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMYR(d.amount_sen)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.payment_method === "manual" ? "Pindahan Manual" : "CHIP"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.utm_source ? (
                        <div>
                          <div className="font-medium">
                            {d.utm_source}
                            {d.utm_medium ? ` / ${d.utm_medium}` : ""}
                          </div>
                          {(d.utm_campaign || d.utm_content || d.utm_term) && (
                            <div className="text-xs text-muted-foreground">
                              {[d.utm_campaign, d.utm_content, d.utm_term]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Direct</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {d.status !== "paid" && d.chip_purchase_id && (
                          <form action={recheckChipStatus}>
                            <input type="hidden" name="id" value={d.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              title="Semak status terkini di CHIP"
                            >
                              <RefreshCw /> Semak CHIP
                            </Button>
                          </form>
                        )}
                        {d.payment_method === "manual" && d.proof_of_payment_path && (
                          <ProofViewer
                            donationId={d.id}
                            path={d.proof_of_payment_path}
                          />
                        )}
                        {d.payment_method === "manual" && d.status !== "paid" && (
                          <form action={confirmManualPayment}>
                            <input type="hidden" name="id" value={d.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Tandakan Dibayar
                            </Button>
                          </form>
                        )}
                        {d.status === "paid" && (
                          <form action={resendReceipt}>
                            <input type="hidden" name="id" value={d.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              title="Hantar semula resit ke emel pembayar"
                            >
                              <Send /> Resit
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Halaman {page} daripada {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref({ page: page - 1 })}>Sebelum</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Sebelum
                  </Button>
                )}
                {page < totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={pageHref({ page: page + 1 })}>Seterusnya</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Seterusnya
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
