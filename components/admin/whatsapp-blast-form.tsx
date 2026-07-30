"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  previewRecipients,
  startBlast,
  sendTestMessage,
} from "@/app/admin/(panel)/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BlastProgress } from "@/components/admin/blast-progress";
import { EmojiPicker } from "@/components/admin/emoji-picker";
import { BlastAttachmentPicker } from "@/components/admin/blast-attachment-picker";
import { BlastModePicker } from "@/components/admin/blast-mode-picker";
import type { MurpatiSessionInfo } from "@/lib/murpati";
import type { WhatsappBlastDelayMode } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const PLACEHOLDER =
  "Assalamualaikum {{nama}},\n\nAgihan fidyah bagi sumbangan anda telah selesai disalurkan. Jazakallahu khairan atas sumbangan anda. 🤲";

const DELAY_BOUNDS_MS: Record<Exclude<WhatsappBlastDelayMode, "custom">, [number, number]> = {
  yolo: [1_000, 15_000],
  medium: [15_000, 60_000],
  careful: [60_000, 180_000],
};

function delayBounds(
  mode: WhatsappBlastDelayMode,
  customMinSec: number,
  customMaxSec: number
): [number, number] {
  if (mode === "custom") return [customMinSec * 1000, customMaxSec * 1000];
  return DELAY_BOUNDS_MS[mode];
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}j ${m}m` : `${h}j`;
}

const STEPS = [
  { id: 1, label: "Tulis Mesej" },
  { id: 2, label: "Konfigur Penerima" },
  { id: 3, label: "Hantar" },
] as const;

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                step === s.id
                  ? "bg-primary text-primary-foreground"
                  : step > s.id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {s.id}
            </span>
            <span
              className={cn(
                "hidden sm:inline",
                step === s.id ? "font-medium" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span className="text-muted-foreground">›</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function WhatsAppBlastForm({
  disabled,
  session,
}: {
  disabled: boolean;
  session: MurpatiSessionInfo;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Compose
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);

  // Configure
  const [campaignName, setCampaignName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [delayMode, setDelayMode] = useState<WhatsappBlastDelayMode>("medium");
  const [customMinSec, setCustomMinSec] = useState(15);
  const [customMaxSec, setCustomMaxSec] = useState(60);
  const [preview, setPreview] = useState<{
    count: number;
    skipped: number;
    sample: { name: string; phone: string }[];
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);

  // Send
  const [blastId, setBlastId] = useState<string | null>(null);
  const [blastTotal, setBlastTotal] = useState(0);

  const [minMs, maxMs] = delayBounds(delayMode, customMinSec, customMaxSec);
  const estimatedMs = preview ? preview.count * ((minMs + maxMs) / 2) : 0;

  async function handleCalculate() {
    if (!dateFrom || !dateTo) {
      toast.error("Sila pilih tarikh mula dan tarikh akhir.");
      return;
    }
    setPreviewing(true);
    const fd = new FormData();
    fd.set("date_from", dateFrom);
    fd.set("date_to", dateTo);
    const result = await previewRecipients({}, fd);
    setPreviewing(false);

    if (result.error) {
      toast.error(result.error);
      setPreview(null);
      return;
    }
    setPreview({
      count: result.count ?? 0,
      skipped: result.skipped ?? 0,
      sample: result.sample ?? [],
    });
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("message", message);
    fd.set("media_url", mediaUrl ?? "");
    fd.set("name", campaignName);
    fd.set("date_from", dateFrom);
    fd.set("date_to", dateTo);
    fd.set("delay_mode", delayMode);
    if (delayMode === "custom") {
      fd.set("delay_min_ms", String(customMinSec * 1000));
      fd.set("delay_max_ms", String(customMaxSec * 1000));
    }
    return fd;
  }

  async function handleSendTest() {
    if (!testPhone.trim()) {
      toast.error("Sila masukkan nombor telefon untuk ujian.");
      return;
    }
    setTestSending(true);
    const fd = buildFormData();
    fd.set("phone", testPhone.trim());
    const result = await sendTestMessage(fd);
    setTestSending(false);

    if (result.error) toast.error(result.error);
    else toast.success("Mesej ujian dihantar.");
  }

  async function handleStart() {
    if (!preview || preview.count === 0) {
      toast.error("Sila kira anggaran penerima dahulu.");
      return;
    }
    if (
      !confirm(
        `Hantar mesej WhatsApp kepada ${preview.count} pembayar? Tindakan ini tidak boleh dibatalkan.`
      )
    ) {
      return;
    }

    setStarting(true);
    const result = await startBlast({}, buildFormData());
    setStarting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    setBlastId(result.blastId ?? null);
    setBlastTotal(result.total ?? preview.count);
    setStep(3);
  }

  const previewMessage = useMemo(
    () => message.replaceAll("{{nama}}", "Ahmad"),
    [message]
  );

  if (step === 3 && blastId) {
    return (
      <div className="space-y-4">
        <StepIndicator step={3} />
        <p className="text-sm font-medium">Menghantar blast…</p>
        <BlastProgress
          blastId={blastId}
          total={blastTotal}
          onDone={() => {
            toast.success("Blast selesai dihantar.");
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Mesej</Label>
              <EmojiPicker
                value={message}
                onChange={setMessage}
                textareaRef={textareaRef}
              />
            </div>
            <Textarea
              ref={textareaRef}
              id="message"
              rows={6}
              disabled={disabled}
              placeholder={PLACEHOLDER}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Guna <code className="rounded bg-muted px-1 py-0.5">{"{{nama}}"}</code>{" "}
                untuk gantikan dengan nama pembayar secara automatik.
              </span>
              <span>{message.length} aksara</span>
            </div>
          </div>

          <BlastAttachmentPicker
            disabled={disabled}
            url={mediaUrl}
            name={mediaName}
            onChange={(url, name) => {
              setMediaUrl(url);
              setMediaName(name);
            }}
          />

          {message.trim() && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pratonton</Label>
              <div className="rounded-2xl rounded-tl-none border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                {mediaUrl && (
                  <div className="mb-2 truncate rounded-lg border border-emerald-200/60 bg-white/60 px-2 py-1 text-xs dark:border-emerald-900 dark:bg-black/20">
                    📎 {mediaName ?? "Lampiran"}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{previewMessage}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={disabled || !message.trim()}
              onClick={() => setStep(2)}
            >
              Seterusnya: Konfigur Penerima
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
            ← Kembali ke Mesej
          </Button>

          <div className="space-y-2">
            <Label htmlFor="campaign_name">Nama Kempen (pilihan)</Label>
            <Input
              id="campaign_name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Contoh: Agihan Fidyah Ramadan 2026"
              disabled={disabled}
            />
          </div>

          <BlastModePicker
            mode={delayMode}
            onModeChange={setDelayMode}
            customMinSec={customMinSec}
            customMaxSec={customMaxSec}
            onCustomChange={(min, max) => {
              setCustomMinSec(min);
              setCustomMaxSec(max);
            }}
            disabled={disabled}
          />

          <div className="space-y-3">
            <Label>Penerima</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date_from" className="text-xs text-muted-foreground">
                  Tarikh Bayaran Mula
                </Label>
                <Input
                  type="date"
                  id="date_from"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPreview(null);
                  }}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_to" className="text-xs text-muted-foreground">
                  Tarikh Bayaran Akhir
                </Label>
                <Input
                  type="date"
                  id="date_to"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPreview(null);
                  }}
                  disabled={disabled}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || previewing}
              onClick={handleCalculate}
            >
              {previewing && <Loader2 className="animate-spin" />}
              Kira Penerima
            </Button>

            {preview && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">
                  {preview.count} penerima sah
                  {preview.skipped
                    ? ` — ${preview.skipped} diabaikan (tiada no. telefon sah)`
                    : ""}
                </p>
                {preview.sample.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-muted-foreground">
                    {preview.sample.map((s) => (
                      <li key={s.phone}>
                        {s.name} — {s.phone}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Hantar Mesej Ujian
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                type="tel"
                placeholder="Nombor telefon anda (contoh: 0123456789)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                disabled={disabled || testSending}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || testSending || !message.trim()}
                onClick={handleSendTest}
              >
                {testSending && <Loader2 className="animate-spin" />}
                Hantar Ujian
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Ringkasan Blast</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Penerima</p>
                <p className="text-xl font-bold">{preview?.count ?? 0}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Anggaran Masa</p>
                <p className="text-xl font-bold">
                  {preview ? formatDuration(estimatedMs) : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {session.connected ? (
                    <Wifi className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-destructive" />
                  )}
                  Sesi Aktif
                </p>
                <p className="truncate text-sm font-bold">
                  {session.connected
                    ? (session.deviceName ?? session.phoneNumber ?? "Bersambung")
                    : "Tidak bersambung"}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={disabled || starting || !preview || preview.count === 0}
            onClick={handleStart}
          >
            {starting && <Loader2 className="animate-spin" />}
            <Send className="h-4 w-4" />
            Hantar Blast{preview ? ` (${preview.count})` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
