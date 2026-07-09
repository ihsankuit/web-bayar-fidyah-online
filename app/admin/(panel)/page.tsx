import Link from "next/link";
import { ArrowRight, TrendingUp, Users, Clock, FileText } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { Donation } from "@/lib/database.types";
import { formatMYR, formatDate } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";
import { StatusBadge } from "@/components/admin/status-badge";
import { PaymentsChart } from "@/components/admin/payments-chart";
import { buildMonthlySeries, buildSourceBreakdown } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: donations }, { count: postCount }] = await Promise.all([
    supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("blog_posts").select("*", { count: "exact", head: true }),
  ]);

  const rows = (donations as Donation[]) ?? [];
  const paid = rows.filter((d) => d.status === "paid");
  const pending = rows.filter((d) => d.status === "pending");
  const totalPaidSen = paid.reduce((sum, d) => sum + d.amount_sen, 0);
  const uniquePayers = new Set(paid.map((d) => d.payer_email)).size;
  const monthlySeries = buildMonthlySeries(rows, 6);
  const sources = buildSourceBreakdown(rows);
  const maxSourceTotal = Math.max(1, ...sources.map((s) => s.total));

  const stats = [
    {
      label: "Jumlah Terkumpul",
      value: formatMYR(totalPaidSen),
      icon: TrendingUp,
    },
    { label: "Pembayar", value: String(uniquePayers), icon: Users },
    {
      label: "Menunggu Bayaran",
      value: String(pending.length),
      icon: Clock,
    },
    { label: "Artikel Blog", value: String(postCount ?? 0), icon: FileText },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Ringkasan sumbangan dan aktiviti platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold">{s.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jumlah Pembayaran</CardTitle>
          <p className="text-sm text-muted-foreground">
            Jumlah fidyah berjaya dikumpul mengikut bulan (6 bulan terakhir).
          </p>
        </CardHeader>
        <CardContent>
          <PaymentsChart data={monthlySeries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sumber Pembayaran</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sumbangan berjaya mengikut utm_source (kempen/iklan). &quot;Direct&quot;
            bermaksud tiada tag UTM (pelawat terus ke laman).
          </p>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada sumbangan berjaya untuk dipaparkan.
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.source} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.source}</span>
                    <span className="text-muted-foreground">
                      {formatMYR(s.total)} · {s.count} bayaran
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${(s.total / maxSourceTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Sumbangan Terkini</CardTitle>
          <Link
            href="/admin/sumbangan"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            Lihat semua <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada sumbangan direkodkan.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rujukan</TableHead>
                  <TableHead>Pembayar</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tarikh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 8).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      {d.reference}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{d.payer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.payer_email}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getCategory(d.category)?.title ?? d.category}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMYR(d.amount_sen)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(d.created_at)}
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
