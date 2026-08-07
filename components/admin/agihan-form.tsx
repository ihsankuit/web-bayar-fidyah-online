"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";

import {
  previewRecipients,
  sendAgihanUpdate,
  type PreviewState,
  type SendState,
} from "@/app/admin/(panel)/agihan/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function FormButtons({
  previewAction,
}: {
  previewAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="submit"
        variant="outline"
        formAction={previewAction}
        formNoValidate
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Search />}
        Semak Penerima
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        Hantar Notifikasi WhatsApp
      </Button>
    </div>
  );
}

export function AgihanForm() {
  const [previewState, previewAction] = useActionState<PreviewState, FormData>(
    previewRecipients,
    {}
  );
  const [sendState, sendActionDispatch] = useActionState<SendState, FormData>(
    sendAgihanUpdate,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (previewState.error) toast.error(previewState.error);
  }, [previewState]);

  useEffect(() => {
    if (sendState.ok) {
      toast.success(
        `${sendState.sent} daripada ${sendState.total} berjaya dihantar.` +
          (sendState.failed ? ` ${sendState.failed} gagal.` : "")
      );
      formRef.current?.reset();
    } else if (sendState.error) {
      toast.error(sendState.error);
    }
  }, [sendState]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hantar Makluman Baharu</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pilih julat tarikh pembayaran, semak penerima, kemudian hantar
          makluman agihan (teks &amp; gambar pilihan) kepada pembayar melalui
          WhatsApp.
        </p>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={sendActionDispatch} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_from">Tarikh Bayaran Dari</Label>
              <Input id="date_from" name="date_from" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_to">Hingga</Label>
              <Input id="date_to" name="date_to" type="date" required />
            </div>
          </div>

          {previewState.checked && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {previewState.count} pembayar akan menerima notifikasi ini.
              </p>
              {(previewState.names?.length ?? 0) > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {previewState.names!.join(", ")}
                  {(previewState.count ?? 0) > (previewState.names?.length ?? 0)
                    ? ", ..."
                    : ""}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Makluman Agihan</Label>
            <Textarea
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Assalamualaikum, agihan fidyah anda telah selesai diagihkan kepada..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Gambar (pilihan)</Label>
            <Input id="image" name="image" type="file" accept="image/*" />
          </div>

          <FormButtons previewAction={previewAction} />
        </form>
      </CardContent>
    </Card>
  );
}
