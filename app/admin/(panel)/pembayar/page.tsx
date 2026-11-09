import Link from "next/link";
import { ArrowRight, Repeat, Users, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getPayers } from "@/lib/payers";
import { formatMYR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PembayarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim().toLowerCase();

  const supabase = await createClient();
  const { payers, withoutContact } = await getPayers(supabase);

  const digits = term.replace(/\D/g, "");
  const filtered = term
    ? payers.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term) ||
          (digits && p.phone?.includes(digits)) ||
          (p.displayPhone ?? "").toLowerCase().includes(term)
      )
    : payers;

  const totalPaidSen = payers.reduce((s, p) => s + p.totalPaidSen, 0);
  const repeatDonors = payers.filter((p) => p.paidCount > 1).length;
  const payersWithPaid = payers.filter((p) => p.paidCount > 0).length;
  const avgPerPayerSen =
    payersWithPaid > 0 ? Math.round(totalPaidSen / payersWithPaid) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pembayar</h1>
        <p className="text-muted-foreground">
          Profil setiap pembayar, dikumpulkan mengikut nombor telefon.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Users className="h-5 w-5" />}
          label="Pembayar unik"
          value={String(payers.length)}
          hint={
            withoutContact > 0
              ? `${withoutContact} tiada telefon/emel`
              : undefined
          }
        />
        <StatTile
          icon={<Repeat className="h-5 w-5" />}
          label="Penderma berulang"
          value={String(repeatDonors)}
          hint="≥ 2 bayaran berjaya"
        />
        <StatTile
          icon={<Wallet className="h-5 w-5" />}
          label="Purata setiap pembayar"
          value={formatMYR(avgPerPayerSen)}
          hint="berdasarkan yang telah membayar"
        />
      </div>

      <form action="/admin/pembayar" method="get" className="flex flex-wrap gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Cari nama, telefon atau emel..."
          className="w-full sm:w-72"
        />
        <Button type="submit" variant="outline" size="sm">
          Cari
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{filtered.length} pembayar</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tiada pembayar ditemui.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pembayar</TableHead>
                  <TableHead className="hidden lg:table-cell">Negeri</TableHead>
                  <TableHead className="text-right">Jumlah dibayar</TableHead>
                  <TableHead className="text-center">Bayaran</TableHead>
                  <TableHead className="hidden lg:table-cell">Sumber</TableHead>
                  <TableHead className="hidden sm:table-cell">Terakhir</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.phone}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {p.displayPhone ?? p.email}
                        {p.keyType === "email" && (
                          <span className="ml-1.5 font-sans not-italic text-[10px] uppercase tracking-wide text-muted-foreground/70">
                            (emel)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {p.negeri ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMYR(p.totalPaidSen)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium">{p.paidCount}</span>
                      {p.paidCount > 1 && (
                        <Badge variant="secondary" className="ml-1.5 align-middle">
                          Berulang
                        </Badge>
                      )}
                      {p.totalCount > p.paidCount && (
                        <div className="text-xs text-muted-foreground">
                          {p.totalCount} jumlah cubaan
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {p.utmSource ?? (
                        <span className="text-muted-foreground">Direct</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDate(p.lastAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/pembayar/${encodeURIComponent(p.key)}`}>
                          Profil <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
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

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
