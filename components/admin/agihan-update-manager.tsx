"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addAgihanUpdate,
  type AgihanUpdateState,
} from "@/app/admin/(panel)/update-agihan/actions";
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
      Tambah Update
    </Button>
  );
}

export function AgihanUpdateManager() {
  const [state, action] = useActionState<AgihanUpdateState, FormData>(
    addAgihanUpdate,
    {}
  );
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Update agihan ditambah.");
      form.current?.reset();
    } else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarPlus className="h-4 w-4 text-primary" /> Tambah Update Agihan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={form} action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Tajuk</Label>
              <Input
                id="title"
                name="title"
                placeholder="Contoh: Agihan Beras Dapur Ihsan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="happened_on">Tarikh agihan</Label>
              <Input id="happened_on" name="happened_on" type="date" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Tempat</Label>
            <Input
              id="location"
              name="location"
              placeholder="Contoh: Masjid Sungai Buah, Selangor"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caption">Keterangan (copywriting ringkas)</Label>
            <Textarea
              id="caption"
              name="caption"
              rows={3}
              placeholder="Contoh: Alhamdulillah, 120 bungkusan beras diagihkan kepada keluarga asnaf sekitar Sungai Buah."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Gambar</Label>
            <Input
              id="image"
              type="file"
              name="image"
              accept="image/*"
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Maksimum 10MB. Gambar dipaparkan dalam timeline di laman utama.
            </p>
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
