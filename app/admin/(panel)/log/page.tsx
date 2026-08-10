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
import type { ActivityLogEntry } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "donation.recheck_chip": "Semak semula status CHIP",
  "donation.confirm_manual_paid": "Sahkan pindahan manual dibayar",
  "donation.auto_expire": "Luputkan sumbangan tertunda secara automatik",
  "donation.resend_receipt": "Hantar semula resit",
  "donation.followup": "Hantar susulan kepada pembayar",
  "notifikasi.save_followup": "Kemas kini templat notifikasi susulan",
  "notifikasi.save_payment_success":
    "Kemas kini templat notifikasi pembayaran berjaya",
  "blog.publish": "Terbitkan artikel",
  "blog.save_draft": "Simpan draf artikel",
  "blog.delete": "Padam artikel",
  "media.delete": "Padam media",
  "agihan.send": "Hantar makluman agihan fidyah (WhatsApp)",
  "agihan.retry": "Cuba hantar semula agihan fidyah yang gagal",
  "agihan.test": "Hantar mesej ujian agihan fidyah",
  "admin.create": "Tambah pentadbir baharu",
  "admin.delete": "Padam pentadbir",
};

function describe(entry: ActivityLogEntry): string {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  const details = entry.details ?? {};
  const bits = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return bits.length > 0 ? `${label} — ${bits.join(", ")}` : label;
}

export default async function ActivityLogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = (data as ActivityLogEntry[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log Aktiviti</h1>
        <p className="text-muted-foreground">
          Rekod tindakan pentadbir terkini (100 terbaharu).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{entries.length} rekod</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tiada aktiviti direkodkan lagi.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tindakan</TableHead>
                  <TableHead>Pentadbir</TableHead>
                  <TableHead>Tarikh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      {describe(entry)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.actor}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(entry.created_at)}
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
