"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import {
  previewRecipients,
  startBlast,
  type PreviewResult,
  type StartBlastState,
} from "@/app/admin/(panel)/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BlastProgress } from "@/components/admin/blast-progress";
import { EmojiPicker } from "@/components/admin/emoji-picker";
import { BlastAttachmentPicker } from "@/components/admin/blast-attachment-picker";

function PreviewButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Pratonton Penerima
    </Button>
  );
}

export function WhatsAppBlastForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [previewState, previewAction] = useActionState<PreviewResult, FormData>(
    previewRecipients,
    {}
  );
  const [startState, startAction, startPending] = useActionState<
    StartBlastState,
    FormData
  >(startBlast, {});

  useEffect(() => {
    if (previewState.error) toast.error(previewState.error);
  }, [previewState.error]);

  useEffect(() => {
    if (startState.error) toast.error(startState.error);
  }, [startState.error]);

  if (startState.blastId) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Menghantar blast…</p>
        <BlastProgress
          blastId={startState.blastId}
          total={startState.total ?? previewState.count ?? 0}
          onDone={() => {
            toast.success("Blast selesai dihantar.");
            router.refresh();
          }}
        />
      </div>
    );
  }

  const count = previewState.count;

  return (
    <form action={previewAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date_from">Tarikh Bayaran Mula</Label>
          <Input
            type="date"
            id="date_from"
            name="date_from"
            required
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_to">Tarikh Bayaran Akhir</Label>
          <Input
            type="date"
            id="date_to"
            name="date_to"
            required
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="message">Mesej</Label>
          <EmojiPicker textareaRef={textareaRef} />
        </div>
        <Textarea
          ref={textareaRef}
          id="message"
          name="message"
          rows={5}
          disabled={disabled}
          placeholder={
            "Assalamualaikum {{nama}},\n\nAgihan fidyah bagi sumbangan anda telah selesai disalurkan. Jazakallahu khairan atas sumbangan anda. 🤲"
          }
          required
        />
        <p className="text-xs text-muted-foreground">
          Guna <code className="rounded bg-muted px-1 py-0.5">{"{{nama}}"}</code>{" "}
          untuk gantikan dengan nama pembayar secara automatik.
        </p>
      </div>

      <BlastAttachmentPicker disabled={disabled} />

      <div className="flex flex-wrap gap-2">
        <PreviewButton />
        {count !== undefined && count > 0 && (
          <Button
            type="submit"
            formAction={startAction}
            disabled={disabled || startPending}
            onClick={(e) => {
              if (
                !confirm(
                  `Hantar mesej WhatsApp kepada ${count} pembayar? Tindakan ini tidak boleh dibatalkan.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            {startPending && <Loader2 className="animate-spin" />}
            <Send className="h-4 w-4" /> Hantar Blast ({count})
          </Button>
        )}
      </div>

      {count !== undefined && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">
            {count} penerima sah
            {previewState.skipped
              ? ` — ${previewState.skipped} diabaikan (tiada no. telefon sah)`
              : ""}
          </p>
          {previewState.sample && previewState.sample.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-muted-foreground">
              {previewState.sample.map((s) => (
                <li key={s.phone}>
                  {s.name} — {s.phone}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
