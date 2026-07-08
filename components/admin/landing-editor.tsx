"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  saveLanding,
  type LandingState,
} from "@/app/admin/(panel)/laman/actions";
import type { LandingContent } from "@/lib/database.types";
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tentang Fidyah</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Tajuk"
            name="about_title"
            defaultValue={content.about_title}
          />
          <div className="space-y-2">
            <Label htmlFor="about_body">Penerangan</Label>
            <Textarea
              id="about_body"
              name="about_body"
              defaultValue={content.about_body}
              className="min-h-[120px]"
            />
          </div>
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
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} />
    </div>
  );
}
