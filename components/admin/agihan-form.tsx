"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  Bookmark,
  FlaskConical,
  Loader2,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplate,
  previewRecipients,
  saveTemplate,
  sendAgihanUpdate,
  sendTestBlast,
  type PreviewState,
  type SendState,
  type TemplateState,
  type TestState,
} from "@/app/admin/(panel)/agihan/actions";
import type { AgihanTemplate } from "@/lib/database.types";
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
import { EmojiPickerButton } from "@/components/admin/emoji-picker-button";

const VARIABLE_TAGS: { tag: string; label: string }[] = [
  { tag: "{{nama}}", label: "Nama" },
  { tag: "{{jumlah}}", label: "Jumlah" },
  { tag: "{{hari}}", label: "Hari" },
  { tag: "{{kategori}}", label: "Kategori" },
  { tag: "{{negeri}}", label: "Negeri" },
];

function TestButton({
  testAction,
}: {
  testAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      formAction={testAction}
      formNoValidate
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
      Hantar Ujian
    </Button>
  );
}

function FormButtons({
  previewAction,
  saveTemplateAction,
}: {
  previewAction: (formData: FormData) => void;
  saveTemplateAction: (formData: FormData) => void;
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
      <Button
        type="submit"
        variant="outline"
        formAction={saveTemplateAction}
        formNoValidate
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Bookmark />}
        Simpan Sebagai Templat
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        Hantar Notifikasi WhatsApp
      </Button>
    </div>
  );
}

export function AgihanForm({
  templates,
}: {
  templates: AgihanTemplate[];
}) {
  const [previewState, previewAction] = useActionState<PreviewState, FormData>(
    previewRecipients,
    {}
  );
  const [sendState, sendActionDispatch] = useActionState<SendState, FormData>(
    sendAgihanUpdate,
    {}
  );
  const [templateState, saveTemplateAction] = useActionState<
    TemplateState,
    FormData
  >(saveTemplate, {});
  const [testState, testAction] = useActionState<TestState, FormData>(
    sendTestBlast,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const templateNameRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (testState.ok) toast.success(testState.message);
    else if (testState.error) toast.error(testState.error);
  }, [testState]);

  useEffect(() => {
    if (templateState.ok) {
      toast.success(templateState.message);
      if (templateNameRef.current) templateNameRef.current.value = "";
    } else if (templateState.error) {
      toast.error(templateState.error);
    }
  }, [templateState]);

  function insertAtCursor(text: string) {
    const el = messageRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const cursor = start + text.length;
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  function loadTemplate(message: string) {
    const el = messageRef.current;
    if (!el) return;
    el.value = message;
    el.focus();
  }

  async function handleDeleteTemplate(id: string) {
    await deleteTemplate(id);
  }

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
              <Input id="date_from" name="date_from" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_to">Hingga</Label>
              <Input id="date_to" name="date_to" type="date" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Import Kontak (pilihan)
              </Label>
              <span className="text-xs text-muted-foreground">
                Satu kontak satu baris: <code>Nama,0123456789</code>
              </span>
            </div>
            <Textarea
              name="contacts_text"
              rows={3}
              placeholder={"Ahmad,0123456789\nSiti,0198765432"}
            />
            <Input
              name="contacts_file"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
            />
            <p className="text-xs text-muted-foreground">
              Guna ini untuk hantar kepada penerima di luar rekod pembayaran.
              Julat tarikh boleh dikosongkan jika awak nak hantar kepada senarai
              import sahaja. Nombor bertindih ditapis automatik.
            </p>
          </div>

          {previewState.checked && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {previewState.count} penerima akan menerima notifikasi ini.
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {previewState.fromDonations} daripada rekod pembayaran ·{" "}
                {previewState.fromImport} daripada senarai import
                {previewState.duplicates
                  ? ` · ${previewState.duplicates} bertindih ditapis`
                  : ""}
              </p>
              {(previewState.names?.length ?? 0) > 0 && (
                <p className="mt-1 text-muted-foreground">
                  {previewState.names!.join(", ")}
                  {(previewState.count ?? 0) > (previewState.names?.length ?? 0)
                    ? ", ..."
                    : ""}
                </p>
              )}
              {(previewState.skipped?.length ?? 0) > 0 && (
                <p className="mt-1 text-destructive">
                  Baris import dilangkau (nombor tidak sah):{" "}
                  {previewState.skipped!.join(", ")}
                </p>
              )}
            </div>
          )}

          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Templat Tersedia
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => loadTemplate(t.message)}
                      className="hover:underline"
                    >
                      {t.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Padam templat ${t.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="message">Makluman Agihan</Label>
              <div className="flex flex-wrap gap-2">
                <EmojiPickerButton onSelect={insertAtCursor} />
                {VARIABLE_TAGS.map(({ tag, label }) => (
                  <Button
                    key={tag}
                    type="button"
                    variant="outline"
                    size="sm"
                    title={label}
                    onClick={() => insertAtCursor(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              ref={messageRef}
              id="message"
              name="message"
              required
              rows={4}
              placeholder="Assalamualaikum {{nama}}, agihan fidyah anda ({{jumlah}}, {{hari}} hari) telah selesai diagihkan kepada..."
            />
            <p className="text-xs text-muted-foreground">
              Tag tersedia:{" "}
              {VARIABLE_TAGS.map(({ tag, label }, i) => (
                <span key={tag}>
                  <code className="rounded bg-muted px-1 py-0.5">{tag}</code>{" "}
                  ({label}){i < VARIABLE_TAGS.length - 1 ? ", " : ""}
                </span>
              ))}
              {" "}— digantikan secara automatik ikut setiap pembayar semasa
              hantar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Gambar (pilihan)</Label>
            <Input id="image" name="image" type="file" accept="image/*" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template_name">
              Nama Templat (pilihan, untuk simpan makluman di atas)
            </Label>
            <Input
              ref={templateNameRef}
              id="template_name"
              name="template_name"
              placeholder="cth: Makluman Agihan Ramadan"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <Label htmlFor="test_phone">Hantar Ujian Dahulu</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="test_phone"
                name="test_phone"
                className="w-full sm:w-56"
                placeholder="0123456789"
              />
              <TestButton testAction={testAction} />
            </div>
            <p className="text-xs text-muted-foreground">
              Hantar mesej ini ke satu nombor sahaja untuk semakan. Tag diisi
              dengan nilai contoh, dan ia tidak direkodkan dalam sejarah.
            </p>
          </div>

          <FormButtons
            previewAction={previewAction}
            saveTemplateAction={saveTemplateAction}
          />
        </form>
      </CardContent>
    </Card>
  );
}
