import Link from "next/link";
import { formatQadaBreakdown } from "@/lib/ramadan";
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
import { DeleteDonationButton } from "@/components/admin/delete-donation-button";
import { FollowUpButton } from "@/components/admin/follow-up-button";
import { EditDonationButton } from "@/components/admin/edit-donation-button";
import { getFollowUpSettings } from "@/lib/followup";
import {
  isApiRecorded,
  isOffline,
  needsReview,
  paymentMethodLabel,
  sourceLabel,
} from "@/lib/payment-methods";
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

  const searchConds = term
    ? [
        `payer_name.ilike.%${term}%`,
        `payer_email.ilike.%${term}%`,
        `reference.ilike.%${term}%`,
      ]
    : [];

  if (status === "review") {
    // Waiting for staff to check against a bank statement: a payment recorded
    // over the API as already paid (QR / bank transfer), or a payer's own
    // manual transfer once they have uploaded proof.
    listQuery = listQuery.eq("status", "pending");
    const reviewConds = [
      "payment_method.in.(qr,bank_transfer)",
      "and(payment_method.eq.manual,proof_of_payment_path.not.is.null)",
    ];
    // Two separate .or() calls would not be a reliable AND, so a search over
    // the review list is spelled out as one OR of (review AND match) pairs.
    const combined = searchConds.length
      ? reviewConds.flatMap((r) => searchConds.map((m) => `and(${r},${m})`))
      : reviewConds;
    listQuery = listQuery.or(combined.join(","));
  } else {
    if (status !== "all") {
      listQuery = listQuery.eq("status", status as DonationStatus);
    }
    if (searchConds.length) listQuery = listQuery.or(searchConds.join(","));
  }
  if (searchConds.length) sumQuery = sumQuery.or(searchConds.join(","));

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data, count }, { data: sumRows }, followUpTemplates] =
    await Promise.all([listQuery.range(from, to), sumQuery, getFollowUpSettings()]);

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

        <div className="flex flex-wrap items-center gap-2">
          <form
            action="/admin/sumbangan"
            method="get"
            className="flex flex-wrap gap-2"
          >
            {status !== "all" && (
              <input type="hidden" name="status" value={status} />
            )}
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Cari nama, emel atau rujukan..."
              className="w-full sm:w-64"
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
          <details className="basis-full">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent">
              <Download className="h-4 w-4" /> Eksport Google Ads
            </summary>
            <form
              action="/admin/sumbangan/export-ads"
              method="get"
              className="mt-2 w-full max-w-sm space-y-3 rounded-lg border bg-card p-4"
            >
              <p className="text-xs text-muted-foreground">
                Fail penukaran luar talian untuk bayaran yang tidak dikesan
                pelayar. Muat naik di Google Ads &gt; Goals &gt; Conversions &gt;
                Uploads. Baris yang sama tidak dikira dua kali.
              </p>
              <div className="space-y-1">
                <label htmlFor="ads-name" className="text-xs font-medium">
                  Nama penukaran (sama seperti dalam Google Ads)
                </label>
                <Input id="ads-name" name="name" required placeholder="Contoh: Fidyah Dibayar" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="ads-from" className="text-xs font-medium">Dari</label>
                  <Input id="ads-from" name="from" type="date" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ads-to" className="text-xs font-medium">Hingga</label>
                  <Input id="ads-to" name="to" type="date" />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="ads-type" className="text-xs font-medium">Jenis ID klik</label>
                <select
                  id="ads-type"
                  name="type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="gclid">GCLID (biasa)</option>
                  <option value="gbraid">GBRAID (iOS, app)</option>
                  <option value="wbraid">WBRAID (iOS, web)</option>
                </select>
              </div>
              <Button type="submit" size="sm" className="w-full">
                Muat turun CSV
              </Button>
            </form>
          </details>
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
                  <TableHead className="hidden lg:table-cell">Rujukan</TableHead>
                  <TableHead>Pembayar</TableHead>
                  <TableHead className="hidden lg:table-cell">Kategori</TableHead>
                  <TableHead className="hidden lg:table-cell">Hari</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="hidden lg:table-cell">Kaedah</TableHead>
                  <TableHead className="hidden lg:table-cell">Sumber</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Tarikh</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="hidden font-mono text-xs lg:table-cell">
                      {d.reference}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{d.payer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.payer_email}
                        {d.negeri ? ` · ${d.negeri}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {getCategory(d.category)?.title ?? d.category}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {d.qada_breakdown?.length
                        ? `${d.qada_breakdown.length} tahun`
                        : `${d.days} × ${d.multiplier}`}
                      {d.qada_breakdown?.length ? (
                        <div className="text-xs text-muted-foreground">
                          {formatQadaBreakdown(d.qada_breakdown)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMYR(d.amount_sen)}
                      {d.upsell_accepted && (
                        <div className="text-xs font-normal text-muted-foreground">
                          + {formatMYR(d.upsell_amount_sen)} kempen
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {paymentMethodLabel(d.payment_method)}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {d.utm_source ? (
                        <div>
                          <div className="font-medium">
                            {sourceLabel(d.utm_source) ?? d.utm_source}
                            {d.utm_medium ? ` / ${d.utm_medium}` : ""}
                          </div>
                          {sourceLabel(d.utm_source) && (
                            <div className="text-xs text-muted-foreground">
                              {d.utm_source}
                            </div>
                          )}
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
                      <StatusBadge status={d.status} review={needsReview(d)} />
                      {isApiRecorded(d.payment_method) &&
                        d.status === "pending" &&
                        !d.proof_of_payment_path && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Belum ada bukti
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <EditDonationButton donation={d} />
                        {d.status !== "paid" && !isApiRecorded(d.payment_method) && (
                          <FollowUpButton
                            donation={d}
                            templates={followUpTemplates}
                          />
                        )}
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
                        {d.proof_of_payment_path && (
                          <ProofViewer
                            donationId={d.id}
                            path={d.proof_of_payment_path}
                          />
                        )}
                        {isOffline(d.payment_method) && d.status !== "paid" && (
                          <form action={confirmManualPayment}>
                            <input type="hidden" name="id" value={d.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Tandakan Dibayar
                            </Button>
                          </form>
                        )}
                        {d.status === "paid" && (
                          <>
                            <Button asChild size="sm" variant="ghost">
                              <a
                                href={`/resit/${encodeURIComponent(d.reference)}`}
                                title="Muat turun resit PDF"
                              >
                                <Download /> PDF
                              </a>
                            </Button>
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
                          </>
                        )}
                        <DeleteDonationButton
                          id={d.id}
                          reference={d.reference}
                        />
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
