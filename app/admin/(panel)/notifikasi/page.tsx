import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FollowUpSettingsForm } from "@/components/admin/followup-settings-form";
import { PaymentSuccessSettingsForm } from "@/components/admin/payment-success-settings-form";
import { FOLLOWUP_TAGS, getFollowUpSettings } from "@/lib/followup";
import { getPaymentSuccessSettings, SUCCESS_TAGS } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function NotifikasiPage() {
  const [settings, successSettings] = await Promise.all([
    getFollowUpSettings(),
    getPaymentSuccessSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifikasi</h1>
        <p className="text-muted-foreground">
          Templat mesej automatik yang dihantar kepada pembayar. Perubahan di
          sini terpakai untuk semua penghantaran seterusnya.
        </p>
      </div>

      <PaymentSuccessSettingsForm settings={successSettings} />

      <FollowUpSettingsForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tag Pemboleh Ubah</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tag di bawah digantikan automatik dengan maklumat pembayar semasa
            mesej dihantar. Setiap borang di atas hanya memaparkan tag yang
            berkaitan dengannya.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Pembayaran Berjaya</h3>
            <ul className="space-y-2 text-sm">
              {SUCCESS_TAGS.map(({ tag, label }) => (
                <li key={tag} className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5">{tag}</code>
                  <span className="text-muted-foreground">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Susulan Pembayaran</h3>
            <ul className="space-y-2 text-sm">
              {FOLLOWUP_TAGS.map(({ tag, label }) => (
                <li key={tag} className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5">{tag}</code>
                  <span className="text-muted-foreground">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5">
              {"{{pautan}}"}
            </code>{" "}
            menghasilkan pautan khas untuk pembayar meneruskan pembayaran. Ia
            membuka semula halaman bayaran CHIP — jika pautan asal sudah luput,
            satu pautan baharu dijana automatik supaya pembayar tidak menemui
            halaman mati.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
