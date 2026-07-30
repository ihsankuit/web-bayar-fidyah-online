import Link from "next/link";
import { Paperclip } from "lucide-react";

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
import { getMurpatiSettings } from "@/lib/murpati";
import { formatDate } from "@/lib/utils";
import type { WhatsappBlast } from "@/lib/database.types";
import { WhatsAppBlastForm } from "@/components/admin/whatsapp-blast-form";
import { ResumeBlastButton } from "@/components/admin/resume-blast-button";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const [murpati, supabase] = await Promise.all([
    getMurpatiSettings(),
    createClient(),
  ]);

  const configured = Boolean(murpati.apiKey && murpati.sessionId);

  const { data } = await supabase
    .from("whatsapp_blasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const blasts = (data as WhatsappBlast[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Hantar kemas kini (contoh: status agihan fidyah) kepada pembayar
          mengikut julat tarikh pembayaran, melalui WhatsApp.
        </p>
      </div>

      {!configured && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4 text-sm">
            Murpati belum dikonfigurasi. Sila isi API Key &amp; Session ID di{" "}
            <Link href="/admin/integrasi" className="font-medium underline">
              Integrasi
            </Link>{" "}
            sebelum menghantar blast.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blast Baharu</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppBlastForm disabled={!configured} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sejarah Blast</CardTitle>
        </CardHeader>
        <CardContent>
          {blasts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada blast dihantar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesej</TableHead>
                  <TableHead className="hidden md:table-cell">Julat Tarikh</TableHead>
                  <TableHead className="text-right">Penerima</TableHead>
                  <TableHead className="text-right">Berjaya</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Gagal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Dihantar Oleh</TableHead>
                  <TableHead className="hidden sm:table-cell">Tarikh</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {blasts.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="max-w-xs text-sm" title={b.message}>
                      <div className="flex items-center gap-1.5">
                        {b.media_url && (
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{b.message}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {b.date_from} – {b.date_to}
                    </TableCell>
                    <TableCell className="text-right">{b.total_recipients}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {b.sent_count}
                    </TableCell>
                    <TableCell className="hidden text-right text-destructive sm:table-cell">
                      {b.failed_count}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.status === "completed" ? "Selesai" : "Diproses"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {b.created_by}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDate(b.created_at)}
                    </TableCell>
                    <TableCell>
                      {b.status === "processing" && (
                        <ResumeBlastButton
                          blastId={b.id}
                          total={b.total_recipients}
                          sentCount={b.sent_count}
                          failedCount={b.failed_count}
                        />
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
