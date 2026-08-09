import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FollowUpSettingsForm } from "@/components/admin/followup-settings-form";
import { FOLLOWUP_TAGS, getFollowUpSettings } from "@/lib/followup";

export const dynamic = "force-dynamic";

export default async function NotifikasiPage() {
  const settings = await getFollowUpSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifikasi</h1>
        <p className="text-muted-foreground">
          Templat mesej automatik yang dihantar kepada pembayar. Perubahan di
          sini terpakai untuk semua penghantaran seterusnya.
        </p>
      </div>

      <FollowUpSettingsForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tag Pemboleh Ubah</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tag di bawah digantikan automatik dengan maklumat pembayar semasa
            mesej dihantar.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {FOLLOWUP_TAGS.map(({ tag, label }) => (
              <li key={tag} className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5">{tag}</code>
                <span className="text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
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
