"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { sendFollowUp } from "@/app/admin/(panel)/sumbangan/actions";
import type { Donation, FollowUpSettings } from "@/lib/database.types";
import { FOLLOWUP_TAGS, stageIndexForCount } from "@/lib/followup";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        Hantar Susulan
      </Button>
    </div>
  );
}

export function FollowUpButton({
  donation,
  templates,
}: {
  donation: Donation;
  templates: FollowUpSettings;
}) {
  const [open, setOpen] = useState(false);
  const whatsappRef = useRef<HTMLTextAreaElement>(null);
  const emailSubjectRef = useRef<HTMLInputElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);

  // Which step of the sequence this payer is due. Someone who has already
  // had two reminders shouldn't receive the same opening line a third time,
  // so the step matching their history is preselected.
  const stages = templates.stages;
  const [stageIndex, setStageIndex] = useState(() =>
    stageIndexForCount(templates, donation.followup_count)
  );
  const stage = stages[stageIndex] ?? stages[0];

  async function sendAction(formData: FormData) {
    const result = await sendFollowUp({}, formData);
    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
    } else if (result.error) {
      toast.error(result.error);
    }
  }

  /**
   * Swap the fields over to another step. Written straight to the DOM
   * because the fields are uncontrolled — re-rendering wouldn't move a
   * `defaultValue` that the browser has already applied.
   */
  function selectStage(index: number) {
    const next = stages[index];
    if (!next) return;
    setStageIndex(index);
    if (whatsappRef.current) whatsappRef.current.value = next.whatsapp_message;
    if (emailSubjectRef.current)
      emailSubjectRef.current.value = next.email_subject;
    if (emailBodyRef.current) emailBodyRef.current.value = next.email_body;
  }


  function insertTag(
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

  const hasPhone = Boolean(donation.payer_phone?.trim());

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title={
          donation.last_followup_at
            ? `Susulan terakhir: ${formatDate(donation.last_followup_at)}`
            : "Hantar susulan kepada pembayar"
        }
      >
        <Send /> Susulan
        {/* Always shown, including zero — an admin scanning the list needs to
            see "not chased yet" as readily as "chased twice". Falls back to 0
            so a missing column renders a number rather than nothing. */}
        <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
          {donation.followup_count ?? 0}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Susulan Pembayaran — {donation.reference}</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{donation.payer_name}</p>
            <p className="text-muted-foreground">
              {donation.payer_email}
              {donation.payer_phone ? ` · ${donation.payer_phone}` : ""}
            </p>
            {donation.followup_count > 0 && donation.last_followup_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {donation.followup_count} susulan dihantar sebelum ini —
                terakhir {formatDate(donation.last_followup_at)}
              </p>
            )}
          </div>

          <form action={sendAction} className="space-y-5">
            <input type="hidden" name="id" value={donation.id} />
            <input type="hidden" name="stage_name" value={stage?.name ?? ""} />

            {stages.length > 1 && (
              <div className="space-y-2">
                <Label>Peringkat susulan</Label>
                <div className="flex flex-wrap gap-1.5">
                  {stages.map((s, i) => (
                    <Button
                      key={s.name + i}
                      type="button"
                      size="sm"
                      variant={i === stageIndex ? "default" : "outline"}
                      onClick={() => selectStage(i)}
                    >
                      {s.name}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dipilih automatik mengikut bilangan susulan yang pembayar ini
                  sudah terima. Menukar peringkat akan menulis ganti ayat di
                  bawah.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label
                  htmlFor="via_whatsapp"
                  className="flex items-center gap-2"
                >
                  <input
                    id="via_whatsapp"
                    name="via_whatsapp"
                    type="checkbox"
                    defaultChecked={hasPhone}
                    disabled={!hasPhone}
                    className="h-4 w-4 rounded border-input"
                  />
                  Hantar melalui WhatsApp
                  {!hasPhone && (
                    <span className="text-xs text-muted-foreground">
                      (tiada no. telefon)
                    </span>
                  )}
                </Label>
                <div className="flex flex-wrap gap-1">
                  {FOLLOWUP_TAGS.map(({ tag, label }) => (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      title={label}
                      onClick={() => insertTag(whatsappRef, tag)}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea
                ref={whatsappRef}
                name="whatsapp_message"
                rows={6}
                defaultValue={stage?.whatsapp_message ?? ""}
              />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="via_email" className="flex items-center gap-2">
                <input
                  id="via_email"
                  name="via_email"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-input"
                />
                Hantar melalui emel
              </Label>
              <Input
                ref={emailSubjectRef}
                name="email_subject"
                defaultValue={stage?.email_subject ?? ""}
                placeholder="Tajuk emel"
              />
              <div className="flex flex-wrap justify-end gap-1">
                {FOLLOWUP_TAGS.map(({ tag, label }) => (
                  <Button
                    key={tag}
                    type="button"
                    variant="outline"
                    size="sm"
                    title={label}
                    onClick={() => insertTag(emailBodyRef, tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              <Textarea
                ref={emailBodyRef}
                name="email_body"
                rows={7}
                defaultValue={stage?.email_body ?? ""}
              />
              <p className="text-xs text-muted-foreground">
                Butang &quot;Sambung Pembayaran&quot; disertakan automatik di
                hujung emel.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Tag digantikan automatik dengan maklumat pembayar ini semasa
              hantar. Suntingan di sini untuk penghantaran ini sahaja — untuk
              ubah teks lalai semua susulan, pergi ke{" "}
              <Link href="/admin/notifikasi" className="underline">
                Notifikasi
              </Link>
              .
            </p>

            <SubmitButton />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
