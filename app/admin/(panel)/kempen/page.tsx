import { UpsellSettingsForm } from "@/components/admin/upsell-settings-form";
import { getUpsellSettings } from "@/lib/upsell";

export const dynamic = "force-dynamic";

export default async function KempenPage() {
  const upsell = await getUpsellSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kempen Naik Taraf</h1>
        <p className="text-muted-foreground">
          Tawaran tambahan yang dipaparkan sejurus pembayar menekan &quot;Bayar&quot;
          — mereka boleh terima (digabung dalam satu pembayaran) atau teruskan
          bayar fidyah sahaja.
        </p>
      </div>

      <UpsellSettingsForm upsell={upsell} />
    </div>
  );
}
