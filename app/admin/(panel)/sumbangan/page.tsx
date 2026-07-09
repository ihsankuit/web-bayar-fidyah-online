import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { confirmDonationPaid } from "./actions";

export const dynamic = "force-dynamic";

const filters: { key: string; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "paid", label: "Berjaya" },
  { key: "pending", label: "Menunggu" },
  { key: "failed", label: "Gagal" },
];

export default async function SumbanganPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("donations")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status as DonationStatus);
  }

  const { data } = await query;
  const rows = (data as Donation[]) ?? [];
  const total = rows
    .filter((d) => d.status === "paid")
    .reduce((s, d) => s + d.amount_sen, 0);

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
            Jumlah terkumpul (dipaparkan)
          </p>
          <p className="text-2xl font-bold text-primary">{formatMYR(total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={`/admin/sumbangan?status=${f.key}`}
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

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} rekod</CardTitle>
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
                    <TableCell className="text-sm uppercase text-muted-foreground">
                      {d.payment_method}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.utm_source ? (
                        <div>
                          <div className="font-medium">
                            {d.utm_source}
                            {d.utm_medium ? ` / ${d.utm_medium}` : ""}
                          </div>
                          {d.utm_campaign && (
                            <div className="text-xs text-muted-foreground">
                              {d.utm_campaign}
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
                      {d.status !== "paid" && (
                        <form action={confirmDonationPaid}>
                          <input type="hidden" name="id" value={d.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Tandakan Dibayar
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
