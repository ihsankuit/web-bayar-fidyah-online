import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type {
  FidyahDistribution,
  FidyahDistributionRecipient,
} from "@/lib/database.types";
import { formatDate, formatDateOnly } from "@/lib/utils";
import { retryFailedRecipients } from "../actions";

export const dynamic = "force-dynamic";

export default async function AgihanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: distribution }, { data: recipientRows }] = await Promise.all([
    supabase.from("fidyah_distributions").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("fidyah_distribution_recipients")
      .select("*")
      .eq("distribution_id", id)
      .order("status", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (!distribution) notFound();

  const dist = distribution as FidyahDistribution;
  const recipients = (recipientRows as FidyahDistributionRecipient[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/agihan"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Agihan Fidyah
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Butiran Penghantaran
        </h1>
        <p className="text-muted-foreground">
          {formatDateOnly(dist.date_from)} – {formatDateOnly(dist.date_to)} ·
          dihantar oleh {dist.created_by} pada {formatDate(dist.created_at)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Makluman</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dist.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dist.image_url}
              alt=""
              className="max-h-64 rounded-lg border border-border object-cover"
            />
          )}
          <p className="whitespace-pre-wrap text-sm">{dist.message}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>
            {recipients.length} penerima — {dist.sent_count} berjaya
            {dist.failed_count > 0 ? `, ${dist.failed_count} gagal` : ""}
          </CardTitle>
          {dist.failed_count > 0 && (
            <form action={retryFailedRecipients}>
              <input type="hidden" name="distribution_id" value={dist.id} />
              <Button type="submit" size="sm" variant="outline">
                <RefreshCw className="h-4 w-4" /> Cuba Hantar Semula (
                {dist.failed_count})
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tiada rekod penerima.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>No. Telefon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ralat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">
                      {r.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.phone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "sent" ? "success" : "destructive"}
                      >
                        {r.status === "sent" ? "Berjaya" : "Gagal"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.error ?? "—"}
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
