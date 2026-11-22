import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Users,
  Clock,
  FileText,
} from "lucide-react";

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
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatusBadge } from "@/components/admin/status-badge";
import { PaymentsChart } from "@/components/admin/payments-chart";
import {
  RANGE_PRESETS,
  buildBreakdown,
  buildRangeSeries,
  buildSourceBreakdown,
  donationWhen,
  inWindow,
  momChange,
  resolveRange,
  sumPaid,
  summariseUpsell,
  upsellAmount,
  type BreakdownItem,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Malaysian calendar date (YYYY-MM-DD) of an instant, for the date inputs. */
function mytIsoDay(d: Date): string {
  return new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: donations }, { count: postCount }] = await Promise.all([
    supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("blog_posts").select("*", { count: "exact", head: true }),
  ]);

  const allRows = (donations as Donation[]) ?? [];
  const now = new Date();

  const earliestPaid = allRows
    .filter((d) => d.status === "paid")
    .reduce<Date | null>((min, d) => {
      const when = donationWhen(d);
      return !min || when < min ? when : min;
    }, null);
  const range = resolveRange(query, now, earliestPaid);

  // Everything below describes the chosen window. Paid money is placed by when
  // it was paid; anything unpaid by when it was made.
  const rows = allRows.filter((d) => inWindow(donationWhen(d), range.from, range.to));
  // The queue is a live backlog, not a period figure: always every pending one.
  const pendingCount = allRows.filter((d) => d.status === "pending").length;
  const current = sumPaid(allRows, range.from, range.to);
  const totalPaidSen = current.totalSen;
  const uniquePayers = current.payers;
  const series = buildRangeSeries(allRows, range);
  const upsell = summariseUpsell(allRows, range.from, range.to);
  const upsellSeries = buildRangeSeries(allRows, range, upsellAmount);
  const change = range.previous
    ? momChange(current.totalSen, sumPaid(allRows, range.previous.from, range.previous.to).totalSen)
    : null;

  const categoryBreakdown = buildBreakdown(
    rows,
    (d) => getCategory(d.category)?.title ?? d.category
  );
  const negeriBreakdown = buildBreakdown(
    rows,
    (d) => d.negeri || "Tidak dinyatakan"
  ).slice(0, 6);

  const sources = buildSourceBreakdown(rows);
  const maxSourceTotal = Math.max(1, ...sources.map((s) => s.total));

  const stats = [
    {
      label: "Jumlah Terkumpul",
      value: totalPaidSen,
      kind: "myr" as const,
      icon: TrendingUp,
      badge: change,
    },
    { label: "Pembayar", value: uniquePayers, icon: Users },
    {
      label: "Menunggu Bayaran",
      value: pendingCount,
      icon: Clock,
    },
    { label: "Artikel Blog", value: postCount ?? 0, icon: FileText },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Ringkasan sumbangan dan aktiviti platform.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker
          presets={RANGE_PRESETS}
          activeKey={range.key}
          from={mytIsoDay(range.from)}
          to={mytIsoDay(new Date(range.to.getTime() - 1))}
          summary={
            RANGE_PRESETS.find((p) => p.key === range.key)?.label ??
            (range.key === "custom" ? "Julat sendiri" : "Tarikh")
          }
        />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{range.label}</span> ({range.days}{" "}
          hari, waktu Malaysia)
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
                  <p className="mt-1 text-2xl font-bold">
                    <AnimatedNumber
                      value={s.value}
                      kind={"kind" in s ? s.kind : "int"}
                      fromZero
                    />
                  </p>
                  {"badge" in s && s.badge !== null && s.badge !== undefined && (
                    <p
                      className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${
                        s.badge >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {s.badge >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5" />
                      )}
                      {Math.abs(s.badge)}% berbanding tempoh sebelumnya
                    </p>
                  )}
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
            Jumlah fidyah berjaya dikumpul mengikut{" "}
            {range.granularity === "day" ? "hari" : "bulan"} ({range.label}).
          </p>
        </CardHeader>
        <CardContent>
          <PaymentsChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hasil Upsell</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kempen tambahan yang dipilih ketika membayar fidyah, mengikut{" "}
            {range.granularity === "day" ? "hari" : "bulan"} ({range.label}).
            Jumlah ini sudah termasuk dalam Jumlah Terkumpul di atas.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Hasil upsell</p>
              <p className="mt-1 text-2xl font-bold">
                <AnimatedNumber value={upsell.totalSen} kind="myr" />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {upsell.shareOfRevenue}% daripada jumlah terkumpul
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kadar ambil</p>
              <p className="mt-1 text-2xl font-bold">{upsell.takeRate}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {upsell.count} daripada {upsell.paidCount} pembayaran berjaya
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Purata upsell</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMYR(upsell.count > 0 ? Math.round(upsell.totalSen / upsell.count) : 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">setiap pembayar yang ambil</p>
            </div>
          </div>
          <PaymentsChart
            data={upsellSeries}
            unit="upsell"
            color="var(--chart-2, var(--primary))"
            emptyText="Tiada upsell dalam tempoh ini."
          />
          {upsell.byTitle.length > 1 && (
            <BreakdownList
              items={upsell.byTitle.map((t) => ({
                label: t.title,
                totalSen: t.totalSen,
                count: t.count,
                percent: t.percent,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mengikut Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList items={categoryBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mengikut Negeri</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownList items={negeriBreakdown} />
          </CardContent>
        </Card>
      </div>

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
          <CardTitle>Sumbangan Terkini (dalam tempoh)</CardTitle>
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
              Tiada sumbangan dalam tempoh ini.
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

function BreakdownList({ items }: { items: BreakdownItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada data.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground">
              {formatMYR(item.totalSen)} · {item.count}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${item.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
