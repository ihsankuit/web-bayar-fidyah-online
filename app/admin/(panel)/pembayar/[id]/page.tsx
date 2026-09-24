import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getPayerByKey } from "@/lib/payers";
import { getCategory } from "@/lib/fidyah";
import { formatMYR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const payer = await getPayerByKey(supabase, decodeURIComponent(id));
  if (!payer) notFound();

  const waLink = payer.phone ? `https://wa.me/${payer.phone}` : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pembayar"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke senarai pembayar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{payer.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {payer.displayPhone && waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone className="h-4 w-4" /> {payer.displayPhone}
              </a>
            )}
            <a
              href={`mailto:${payer.email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="h-4 w-4" /> {payer.email}
            </a>
            {payer.negeri && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {payer.negeri}
              </span>
            )}
          </div>
        </div>
        {payer.paidCount > 1 && (
          <Badge variant="secondary" className="text-sm">
            Penderma berulang
          </Badge>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Jumlah dibayar" value={formatMYR(payer.totalPaidSen)} />
        <Metric label="Bayaran berjaya" value={String(payer.paidCount)} />
        <Metric
          label="Jumlah cubaan"
          value={String(payer.totalCount)}
          hint={`${payer.pendingCount} menunggu · ${payer.failedCount} gagal`}
        />
        <Metric
          label="Purata sumbangan"
          value={formatMYR(
            payer.paidCount > 0
              ? Math.round(payer.totalPaidSen / payer.paidCount)
              : 0
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maklumat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sumbangan pertama" value={formatDate(payer.firstAt)} />
            <Row label="Sumbangan terakhir" value={formatDate(payer.lastAt)} />
            <Row
              label="Sumber (terakhir)"
              value={payer.utmSource ?? "Direct"}
            />
            <Row
              label="Kategori"
              value={payer.categories
                .map((c) => getCategory(c)?.title ?? c)
                .join(", ")}
            />
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sejarah sumbangan ({payer.donations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden lg:table-cell">Rujukan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="hidden sm:table-cell">Kaedah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Tarikh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payer.donations.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    {d.reference}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getCategory(d.category)?.title ?? d.category}
                    <div className="text-xs text-muted-foreground">
                      {d.days} × {d.multiplier}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMYR(d.amount_sen)}
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">
                    {d.payment_method === "manual" ? "Pindahan Manual" : "CHIP"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatDate(d.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
