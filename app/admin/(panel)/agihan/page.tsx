import Link from "next/link";

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
import type { AgihanTemplate, FidyahDistribution } from "@/lib/database.types";
import { formatDate, formatDateOnly } from "@/lib/utils";
import { AgihanForm } from "@/components/admin/agihan-form";

export const dynamic = "force-dynamic";

export default async function AgihanPage() {
  const supabase = await createClient();
  const [{ data }, { data: templateRows }] = await Promise.all([
    supabase
      .from("fidyah_distributions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agihan_templates")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const history = (data as FidyahDistribution[]) ?? [];
  const templates = (templateRows as AgihanTemplate[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agihan Fidyah</h1>
        <p className="text-muted-foreground">
          Hantar makluman kemaskini agihan fidyah kepada pembayar melalui
          WhatsApp, mengikut julat tarikh pembayaran.
        </p>
      </div>

      <AgihanForm templates={templates} />

      <Card>
        <CardHeader>
          <CardTitle>Sejarah Penghantaran</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada makluman agihan dihantar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Makluman</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Julat Tarikh
                  </TableHead>
                  <TableHead className="text-right">Penerima</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Dihantar Oleh
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Tarikh
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="max-w-xs">
                      <Link
                        href={`/admin/agihan/${h.id}`}
                        className="flex items-start gap-2 hover:underline"
                      >
                        {h.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.image_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded object-cover"
                          />
                        )}
                        <p className="line-clamp-2 text-sm">{h.message}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDateOnly(h.date_from)} –{" "}
                      {formatDateOnly(h.date_to)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <span className="font-medium text-emerald-600">
                        {h.sent_count}
                      </span>
                      {h.failed_count > 0 && (
                        <span className="text-destructive">
                          {" "}
                          / {h.failed_count} gagal
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {" "}
                        daripada {h.recipient_count}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {h.created_by}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDate(h.created_at)}
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
