"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveSeo, type SeoState } from "@/app/admin/(panel)/seo/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan
    </Button>
  );
}

/** Small character counter to keep title/description within SEO limits. */
function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={over ? "text-destructive" : "text-muted-foreground"}>
      {value.length}/{max} aksara
    </span>
  );
}

export function SeoEditor({
  title,
  description,
  keywords,
  h1,
}: {
  title: string;
  description: string;
  keywords: string[];
  h1: string;
}) {
  const [state, action] = useActionState<SeoState, FormData>(saveSeo, {});
  const [titleVal, setTitleVal] = useState(title);
  const [descVal, setDescVal] = useState(description);

  useEffect(() => {
    if (state.ok) toast.success("Tetapan SEO disimpan.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta & Tajuk Halaman</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kawal tajuk, penerangan, kata kunci &amp; tajuk utama (H1) yang
            dipaparkan pada hasil carian Google dan perkongsian media sosial.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Tajuk Meta (Title)</Label>
              <Counter value={titleVal} max={60} />
            </div>
            <Input
              id="title"
              name="title"
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Cadangan: 50–60 aksara.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Penerangan Meta (Description)</Label>
              <Counter value={descVal} max={160} />
            </div>
            <Textarea
              id="description"
              name="description"
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              className="min-h-[90px]"
            />
            <p className="text-xs text-muted-foreground">
              Cadangan: 150–160 aksara.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Kata Kunci (Keywords)</Label>
            <Textarea
              id="keywords"
              name="keywords"
              defaultValue={keywords.join(", ")}
              className="min-h-[110px]"
              placeholder="fidyah, bayar fidyah online, kalkulator fidyah, ..."
            />
            <p className="text-xs text-muted-foreground">
              Pisahkan setiap kata kunci dengan koma atau baris baharu.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="h1">Tajuk Utama Hero (H1)</Label>
            <Input id="h1" name="h1" defaultValue={h1} />
            <p className="text-xs text-muted-foreground">
              H1 ialah tajuk besar di bahagian atas laman utama. Ia juga boleh
              diedit di <span className="font-medium">Laman Utama</span>.
            </p>
          </div>

          <SaveButton />
        </CardContent>
      </Card>
    </form>
  );
}
