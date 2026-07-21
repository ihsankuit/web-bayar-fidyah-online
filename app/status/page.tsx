import Link from "next/link";
import { CheckCircle2, XCircle, HelpCircle, Clock } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Donation } from "@/lib/database.types";
import { formatMYR } from "@/lib/utils";
import { PurchaseTracker } from "@/components/analytics/purchase-tracker";
import { getTrackingSettings } from "@/lib/tracking/settings";

export const dynamic = "force-dynamic";

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ref?: string }>;
}) {
  const { status: statusParam = "unknown", ref } = await searchParams;

  let donation: Donation | null = null;
  if (ref) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("reference", ref)
        .maybeSingle<Donation>();
      donation = data ?? null;
    } catch {
      // ignore
    }
  }

  // The donation row (confirmed by webhook or admin) is the source of truth.
  // The `status` query param is only a fallback for the no-lookup edge case.
  const effectiveStatus = donation ? donation.status : statusParam;
  const paid = effectiveStatus === "paid";
  const failed = effectiveStatus === "failed";
  const pending = donation ? effectiveStatus === "pending" : false;

  const tracking = paid && donation ? await getTrackingSettings() : null;

  return (
    <div className="flex min-h-screen flex-col">
      {paid && donation && (
        <PurchaseTracker
          reference={donation.reference}
          value={donation.amount_sen / 100}
          googleAdsId={tracking?.googleAdsId}
          googleAdsConversionLabel={tracking?.googleAdsConversionLabel}
          name={donation.payer_name}
          email={donation.payer_email}
          phone={donation.payer_phone}
          ip={donation.client_ip}
          negeri={donation.negeri}
        />
      )}
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              {paid ? (
                <CheckCircle2 className="h-16 w-16 text-primary" />
              ) : pending ? (
                <Clock className="h-16 w-16 text-muted-foreground" />
              ) : failed ? (
                <XCircle className="h-16 w-16 text-destructive" />
              ) : (
                <HelpCircle className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            <h1 className="text-2xl font-bold">
              {paid
                ? "Pembayaran Berjaya!"
                : pending
                  ? "Menunggu Pengesahan"
                  : failed
                    ? "Pembayaran Tidak Berjaya"
                    : "Status Tidak Diketahui"}
            </h1>

            <p className="text-muted-foreground">
              {paid
                ? "Terima kasih. Fidyah anda telah diterima dan resit rasmi telah dihantar ke emel anda."
                : pending
                  ? "Terima kasih. Bayaran anda sedang diproses. Ini biasanya mengambil masa beberapa saat sahaja — resit akan dihantar ke emel anda sebaik pengesahan diterima."
                  : failed
                    ? "Pembayaran anda tidak dapat diproses. Anda boleh cuba semula."
                    : "Kami tidak dapat mengesahkan status pembayaran anda."}
            </p>

            {donation && (
              <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm">
                <Row label="No. Rujukan" value={donation.reference} />
                <Row
                  label="Jumlah"
                  value={formatMYR(donation.amount_sen)}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {paid || pending ? (
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
