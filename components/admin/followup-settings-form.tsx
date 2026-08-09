"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveFollowUpTemplates } from "@/app/admin/(panel)/notifikasi/actions";
import type { FollowUpSettings } from "@/lib/database.types";
import { FOLLOWUP_TAGS } from "@/lib/followup";
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

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan
    </Button>
  );
}

function TagButtons({
  onInsert,
}: {
  onInsert: (tag: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FOLLOWUP_TAGS.map(({ tag, label }) => (
        <Button
          key={tag}
          type="button"
          variant="outline"
          size="sm"
          title={label}
          onClick={() => onInsert(tag)}
        >
          {tag}
        </Button>
      ))}
    </div>
  );
}

export function FollowUpSettingsForm({
  settings,
}: {
  settings: FollowUpSettings;
}) {
  const whatsappRef = useRef<HTMLTextAreaElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);

  async function action(formData: FormData) {
    const result = await saveFollowUpTemplates({}, formData);
    if (result.ok) toast.success(result.message);
    else if (result.error) toast.error(result.error);
  }

  function insertInto(
    ref: React.RefObject<HTMLTextAreaElement | null>,
    tag: string
  ) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + tag + el.value.slice(end);
    const cursor = start + tag.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Susulan Pembayaran</CardTitle>
          <p className="text-sm text-muted-foreground">
            Teks lalai untuk peringatan yang dihantar kepada pembayar yang
            statusnya masih <em>Menunggu</em> atau <em>Gagal</em>. Ia mengisi
            dialog <span className="font-medium">Susulan</span>{" "}
            di Admin&nbsp;&gt;&nbsp;Sumbangan — admin masih boleh menyunting
            ayat sebelum hantar tanpa mengubah teks lalai di sini.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="whatsapp_message">Mesej WhatsApp</Label>
              <TagButtons onInsert={(t) => insertInto(whatsappRef, t)} />
            </div>
            <Textarea
              ref={whatsappRef}
              id="whatsapp_message"
              name="whatsapp_message"
              rows={8}
              defaultValue={settings.whatsapp_message}
            />
          </div>

          <div className="space-y-2 border-t border-border pt-6">
            <Label htmlFor="email_subject">Tajuk Emel</Label>
            <Input
              id="email_subject"
              name="email_subject"
              defaultValue={settings.email_subject}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="email_body">Kandungan Emel</Label>
              <TagButtons onInsert={(t) => insertInto(emailBodyRef, t)} />
            </div>
            <Textarea
              ref={emailBodyRef}
              id="email_body"
              name="email_body"
              rows={9}
              defaultValue={settings.email_body}
            />
            <p className="text-xs text-muted-foreground">
              Butang <strong>Sambung Pembayaran</strong> disertakan automatik di
              hujung emel, jadi tidak perlu tulis pautan sendiri di sini.
            </p>
          </div>

          <SaveButton />
        </CardContent>
      </Card>
    </form>
  );
}
