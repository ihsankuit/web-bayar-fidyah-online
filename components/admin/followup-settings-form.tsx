"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveFollowUpTemplates } from "@/app/admin/(panel)/notifikasi/actions";
import type { FollowUpSettings, FollowUpStage } from "@/lib/database.types";
import {
  DEFAULT_FOLLOWUP_STAGES,
  FOLLOWUP_TAGS,
  MAX_FOLLOWUP_STAGES,
} from "@/lib/followup";
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

function TagButtons({ onInsert }: { onInsert: (tag: string) => void }) {
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

/**
 * One step of the sequence. Field names carry the step's position, which is
 * what the server action reads — the inputs stay uncontrolled, so a step
 * that shifts position after a removal keeps whatever was typed into it and
 * simply submits under its new number.
 */
function StageFields({
  index,
  stage,
  onRemove,
}: {
  index: number;
  stage: FollowUpStage;
  onRemove: (() => void) | null;
}) {
  const whatsappRef = useRef<HTMLTextAreaElement>(null);
  const emailBodyRef = useRef<HTMLTextAreaElement>(null);
  const prefix = `stage_${index}_`;

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor={`${prefix}name`}>Nama peringkat</Label>
          <Input
            id={`${prefix}name`}
            name={`${prefix}name`}
            defaultValue={stage.name}
            placeholder={`Susulan ${index + 1}`}
          />
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            title="Buang peringkat ini"
          >
            <Trash2 /> Buang
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={`${prefix}whatsapp_message`}>Mesej WhatsApp</Label>
          <TagButtons onInsert={(t) => insertInto(whatsappRef, t)} />
        </div>
        <Textarea
          ref={whatsappRef}
          id={`${prefix}whatsapp_message`}
          name={`${prefix}whatsapp_message`}
          rows={8}
          defaultValue={stage.whatsapp_message}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}email_subject`}>Tajuk Emel</Label>
        <Input
          id={`${prefix}email_subject`}
          name={`${prefix}email_subject`}
          defaultValue={stage.email_subject}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={`${prefix}email_body`}>Kandungan Emel</Label>
          <TagButtons onInsert={(t) => insertInto(emailBodyRef, t)} />
        </div>
        <Textarea
          ref={emailBodyRef}
          id={`${prefix}email_body`}
          name={`${prefix}email_body`}
          rows={9}
          defaultValue={stage.email_body}
        />
      </div>
    </div>
  );
}

/** A blank step, prefilled from the shipped sequence where one exists. */
function newStage(index: number): FollowUpStage {
  const shipped = DEFAULT_FOLLOWUP_STAGES[index];
  if (shipped) return shipped;
  return {
    name: `Susulan ${index + 1}`,
    whatsapp_message: "",
    email_subject: "",
    email_body: "",
  };
}

export function FollowUpSettingsForm({
  settings,
}: {
  settings: FollowUpSettings;
}) {
  // `uid` keys the rows so React reuses the same DOM nodes as steps are
  // added and removed — without it, removing a step would shift everyone's
  // uncontrolled text up by one.
  const nextUid = useRef(settings.stages.length);
  const [rows, setRows] = useState(() =>
    settings.stages.map((stage, i) => ({ uid: i, stage }))
  );

  async function action(formData: FormData) {
    const result = await saveFollowUpTemplates({}, formData);
    if (result.ok) toast.success(result.message);
    else if (result.error) toast.error(result.error);
  }

  function addStage() {
    setRows((current) => [
      ...current,
      { uid: nextUid.current++, stage: newStage(current.length) },
    ]);
  }

  function removeStage(uid: number) {
    setRows((current) => current.filter((row) => row.uid !== uid));
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Susulan Pembayaran</CardTitle>
          <p className="text-sm text-muted-foreground">
            Urutan peringatan untuk pembayar yang statusnya masih{" "}
            <em>Menunggu</em> atau <em>Gagal</em>. Semasa menghantar, peringkat
            yang sepadan dengan bilangan susulan yang pembayar itu sudah terima
            dipilih automatik — pembayar yang belum pernah disusuli dapat
            Susulan&nbsp;1, yang sudah sekali dapat Susulan&nbsp;2, dan
            seterusnya. Admin masih boleh tukar peringkat atau sunting ayat
            sebelum hantar tanpa mengubah teks di sini.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => (
            <StageFields
              key={row.uid}
              index={index}
              stage={row.stage}
              // The first step is what every un-chased payer receives, so it
              // can't be removed — there would be nothing to prefill with.
              onRemove={
                rows.length > 1 ? () => removeStage(row.uid) : null
              }
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addStage}
              disabled={rows.length >= MAX_FOLLOWUP_STAGES}
            >
              <Plus /> Tambah Peringkat
            </Button>
            <SaveButton />
          </div>

          <p className="text-xs text-muted-foreground">
            Butang <strong>Sambung Pembayaran</strong> disertakan automatik di
            hujung setiap emel, jadi tidak perlu tulis pautan sendiri.
            Maksimum {MAX_FOLLOWUP_STAGES} peringkat.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
