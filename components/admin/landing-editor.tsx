"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  saveLanding,
  type LandingState,
} from "@/app/admin/(panel)/laman/actions";
import type { LandingContent } from "@/lib/database.types";
import { FIDYAH_CATEGORIES, DEFAULT_CATEGORY_IMAGES } from "@/lib/fidyah";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan Perubahan
    </Button>
  );
}

export function LandingEditor({ content }: { content: LandingContent }) {
  const [state, action] = useActionState<LandingState, FormData>(
    saveLanding,
    {}
  );

  useEffect(() => {
    if (state.ok) toast.success("Kandungan laman utama dikemaskini.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bahagian Hero</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Label kecil (badge)"
            name="hero_badge"
            defaultValue={content.hero_badge}
          />
          <Field
            label="Tajuk utama"
            name="hero_title"
            defaultValue={content.hero_title}
          />
          <div className="space-y-2">
            <Label htmlFor="hero_subtitle">Sari kata</Label>
            <Textarea
              id="hero_subtitle"
              name="hero_subtitle"
              defaultValue={content.hero_subtitle}
            />
          </div>
          <Field
            label="Teks butang (CTA)"
            name="hero_cta"
            defaultValue={content.hero_cta}
          />
          <div className="space-y-2">
            <Label htmlFor="hero_image_url">
              URL gambar latar belakang hero (pilihan)
            </Label>
            <Input
              id="hero_image_url"
              name="hero_image_url"
              defaultValue={content.hero_image_url}
              placeholder="https://... (muat naik di Media, salin URL)"
            />
            <p className="text-xs text-muted-foreground">
              Dipaparkan sebagai latar lembut di belakang teks hero. Kosongkan
              untuk tiada gambar. Muat naik gambar di{" "}
              <Link href="/admin/media" className="underline">
                Media
              </Link>{" "}
              dahulu, kemudian salin URL fail tersebut ke sini.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fidyah & Hukumnya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Tajuk seksyen"
            name="hukum_title"
            defaultValue={content.hukum_title}
          />
          <div className="space-y-2">
            <Label htmlFor="hukum_body">
              Penerangan hukum (guna **teks** untuk tebal, baris kosong untuk
              perenggan baharu)
            </Label>
            <Textarea
              id="hukum_body"
              name="hukum_body"
              defaultValue={content.hukum_body}
              className="min-h-[160px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hadith_arabic">Teks hadith (Arab)</Label>
            <Textarea
              id="hadith_arabic"
              name="hadith_arabic"
              defaultValue={content.hadith_arabic}
              dir="rtl"
              lang="ar"
              className="min-h-[90px] text-xl leading-loose"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hadith_meaning">Maksud hadith</Label>
            <Textarea
              id="hadith_meaning"
              name="hadith_meaning"
              defaultValue={content.hadith_meaning}
            />
          </div>
          <Field
            label="Sumber hadith"
            name="hadith_source"
            defaultValue={content.hadith_source}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Siapa Yang Wajib Membayar Fidyah?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kad kategori di laman utama. Kosongkan mana-mana medan untuk
            kekalkan nilai lalai.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {FIDYAH_CATEGORIES.filter((c) => c.id !== "lain").map((c) => {
            const override = content.category_content?.[c.id];
            const defaultImage = DEFAULT_CATEGORY_IMAGES[c.id]?.[0] ?? "";
            return (
              <div
                key={c.id}
                className="space-y-3 rounded-lg border p-4"
              >
                <p className="text-sm font-medium">{c.title}</p>
                <div className="space-y-2">
                  <Label htmlFor={`category_${c.id}_title`}>Tajuk</Label>
                  <Input
                    id={`category_${c.id}_title`}
                    name={`category_${c.id}_title`}
                    defaultValue={override?.title ?? ""}
                    placeholder={c.title}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`category_${c.id}_description`}>
                    Penerangan
                  </Label>
                  <Textarea
                    id={`category_${c.id}_description`}
                    name={`category_${c.id}_description`}
                    defaultValue={override?.description ?? ""}
                    placeholder={c.description}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`category_${c.id}_image_url`}>
                    URL gambar (pilihan)
                  </Label>
                  <Input
                    id={`category_${c.id}_image_url`}
                    name={`category_${c.id}_image_url`}
                    defaultValue={override?.image_url ?? ""}
                    placeholder={defaultImage || "https://..."}
                  />
                  <p className="text-xs text-muted-foreground">
                    Muat naik di{" "}
                    <Link href="/admin/media" className="underline">
                      Media
                    </Link>{" "}
                    dahulu, kemudian salin URL fail tersebut ke sini.
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tetapan & Statistik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fidyah_rate">Kadar fidyah sehari (RM)</Label>
            <Input
              id="fidyah_rate"
              name="fidyah_rate"
              type="number"
              step="0.10"
              min="0.10"
              defaultValue={(content.fidyah_rate_sen / 100).toFixed(2)}
            />
            <p className="text-xs text-muted-foreground">
              Kadar ini digunakan oleh kalkulator di laman utama.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stats_json">Statistik (JSON)</Label>
            <Textarea
              id="stats_json"
              name="stats_json"
              defaultValue={JSON.stringify(content.stats, null, 2)}
              className="min-h-[140px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Format: {`[{ "label": "...", "value": "..." }]`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pindahan Bank Manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Butiran akaun ditunjukkan kepada pembayar yang memilih kaedah
            &quot;Pindahan Bank&quot;. Kosongkan No. akaun untuk sembunyikan
            kaedah ini di laman utama.
          </p>
          <Field
            label="Nama bank"
            name="bank_name"
            defaultValue={content.bank_name}
          />
          <Field
            label="Nama pemegang akaun"
            name="bank_account_name"
            defaultValue={content.bank_account_name}
          />
          <Field
            label="No. akaun"
            name="bank_account_number"
            defaultValue={content.bank_account_number}
          />
          <Field
            label="URL gambar QR (DuitNow) — pilihan"
            name="bank_qr_image_url"
            defaultValue={content.bank_qr_image_url}
          />
          <p className="text-xs text-muted-foreground">
            Muat naik gambar QR di <strong>Media</strong>, salin URL dan tampal
            di sini. Kosongkan untuk sembunyikan QR. Pembayar di telefon
            digalakkan salin no. akaun; QR lebih berguna untuk pengguna desktop
            dan mereka yang mahu imbas dari galeri.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (Chat dengan Admin)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Butang WhatsApp terapung dipaparkan di penjuru kanan bawah setiap
            halaman. Kosongkan untuk menyembunyikannya.
          </p>
          <Field
            label="No. WhatsApp (dengan kod negara, cth. 60123456789)"
            name="whatsapp_number"
            defaultValue={content.whatsapp_number}
          />
          <Field
            label="Teks sapaan gelembung"
            name="whatsapp_greeting"
            defaultValue={content.whatsapp_greeting}
            placeholder="Ada pertanyaan? Kami di sini 👋"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soalan Lazim & Footer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="faqs_json">FAQ (JSON)</Label>
            <Textarea
              id="faqs_json"
              name="faqs_json"
              defaultValue={JSON.stringify(content.faqs, null, 2)}
              className="min-h-[220px] font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Format: {`[{ "question": "...", "answer": "..." }]`}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="footer_note">Nota footer</Label>
            <Textarea
              id="footer_note"
              name="footer_note"
              defaultValue={content.footer_note}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}
