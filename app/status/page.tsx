import Link from "next/link";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Donation } from "@/lib/database.types";
import { formatMYR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; bill?: string }>;
}) {
  const { status = "unknown", bill } = await searchParams;

  let donation: Donation | null = null;
  if (bill) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("billplz_bill_id", bill)
        .maybeSingle<Donation>();
      donation = data ?? null;
    } catch {
      // ignore
    }
  }

  const paid = status === "paid";
  const failed = status === "failed";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              {paid ? (
                <CheckCircle2 className="h-16 w-16 text-primary" />
              ) : failed ? (
                <XCircle className="h-16 w-16 text-destructive" />
              ) : (
                <HelpCircle className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            <h1 className="text-2xl font-bold">
              {paid
                ? "Pembayaran Berjaya!"
                : failed
                  ? "Pembayaran Tidak Berjaya"
                  : "Status Tidak Diketahui"}
            </h1>

            <p className="text-muted-foreground">
              {paid
                ? "Terima kasih. Fidyah anda telah diterima dan resit rasmi telah dihantar ke emel anda."
                : failed
                  ? "Pembayaran anda tidak dapat diproses. Anda boleh cuba semula."
                  : "Kami tidak dapat mengesahkan status pembayaran anda."}
            </p>

            {donation && (
              <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
                <Row label="No. Rujukan" value={donation.reference} />
                <Row label="Nama" value={donation.payer_name} />
                <Row
                  label="Jumlah"
                  value={formatMYR(donation.amount_sen)}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {paid ? (
                <Button asChild>
                  <Link href="/">Kembali ke Laman Utama</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/#kira">Cuba Semula</Link>
                </Button>
              )}
              <Button asChild variant="ghost">
                <Link href="/blog">Baca Artikel Fidyah</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
