"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveUpsell, type UpsellState } from "@/app/admin/(panel)/kempen/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UpsellSettings } from "@/lib/database.types";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan
    </Button>
  );
}

export function UpsellSettingsForm({ upsell }: { upsell: UpsellSettings }) {
  const [state, action] = useActionState<UpsellState, FormData>(saveUpsell, {});

  useEffect(() => {
    if (state.ok) toast.success("Tetapan kempen disimpan.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kempen di Halaman Bayaran</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bila diaktifkan, tawaran ini dipaparkan sebagai popup sejurus
          pembayar menekan &quot;Bayar&quot;, sebelum diarahkan ke gerbang
          pembayaran. Jika mereka terima, jumlah kempen digabung terus ke
          dalam pembayaran fidyah (satu transaksi, satu resit).
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-5">
          <div className="flex items-center gap-2">
            <input
              id="enabled"
              name="enabled"
              type="checkbox"
              defaultChecked={upsell.enabled}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Aktifkan kempen ini
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Tajuk kempen</Label>
              <Input
                id="title"
                name="title"
                defaultValue={upsell.title}
                placeholder="Contoh: Sertai Tabung Anak Yatim"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Jumlah cadangan (RM)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="1"
                defaultValue={(upsell.amount_sen / 100).toFixed(2)}
              />
              <p className="text-xs text-muted-foreground">
                Dipaparkan sebagai nilai lalai — pembayar boleh ubah jumlah
                ini dalam popup.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Penerangan</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={upsell.description}
              placeholder="Terangkan kempen ini secara ringkas kepada pembayar."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="poster_image_url">URL poster kempen (pilihan)</Label>
            <Input
              id="poster_image_url"
              name="poster_image_url"
              defaultValue={upsell.poster_image_url}
              placeholder="https://... (muat naik di Media, salin URL)"
            />
            <p className="text-xs text-muted-foreground">
              Dipaparkan di bahagian atas popup. Kosongkan untuk tiada
              poster. Muat naik gambar di{" "}
              <Link href="/admin/media" className="underline">
                Media
              </Link>{" "}
              dahulu, kemudian salin URL fail tersebut ke sini.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accept_label">Label butang terima</Label>
              <Input
                id="accept_label"
                name="accept_label"
                defaultValue={upsell.accept_label}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skip_label">Label butang lewatkan</Label>
              <Input
                id="skip_label"
                name="skip_label"
                defaultValue={upsell.skip_label}
              />
            </div>
          </div>

          <SaveButton />
        </form>
      </CardContent>
    </Card>
  );
}
