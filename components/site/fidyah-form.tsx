"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateFidyah, FIDYAH_CATEGORIES, NEGERI } from "@/lib/fidyah";
import { formatMYR } from "@/lib/utils";
import { getStoredUtm } from "@/lib/utm";
import type { PaymentMethod, UpsellSettings } from "@/lib/database.types";

interface ManualTransferData {
  reference: string;
  amountSen: number;
  bank: { name: string; accountName: string; accountNumber: string };
}

export function FidyahForm({
  rateSen,
  manualTransferAvailable = false,
  upsell,
}: {
  rateSen: number;
  manualTransferAvailable?: boolean;
  upsell?: UpsellSettings;
}) {
  const [days, setDays] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [category, setCategory] = useState(FIDYAH_CATEGORIES[0].id as string);
  const [method, setMethod] = useState<PaymentMethod>("chip");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [negeri, setNegeri] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellAmount, setUpsellAmount] = useState(() =>
    upsell ? upsell.amount_sen / 100 : 10
  );
  const [manualTransfer, setManualTransfer] = useState<ManualTransferData | null>(
    null
  );

  const result = useMemo(
    () => calculateFidyah({ days, multiplier, rateSen }),
    [days, multiplier, rateSen]
  );

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Sila masukkan nama anda.");
    if (!email.trim()) return toast.error("Sila masukkan alamat emel anda.");
    if (result.totalSen < 100)
      return toast.error("Jumlah minimum pembayaran ialah RM1.00.");

    if (upsell?.enabled) {
      setShowUpsell(true);
      return;
    }
    submitDonation(false);
  }

  async function submitDonation(upsellAccepted: boolean) {
    setShowUpsell(false);
    setSubmitting(true);
    try {
      const utm = getStoredUtm();
      const res = await fetch("/api/fidyah/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          negeri,
          category,
          days: result.days,
          multiplier: result.multiplier,
          message,
          method,
          upsellAccepted,
          upsellAmountSen: upsellAccepted
            ? Math.round(Math.max(1, upsellAmount) * 100)
            : undefined,
          ...(utm ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ralat tidak dijangka.");

      // Checkout initiated: the donation row exists and we're about to hand
      // the payer over to CHIP (or show the bank-transfer card). Fire it here
      // — the actual CHIP payment page is on chip-in.asia, a domain our GTM
      // can't run on, so this is the last point we control. Uses sendBeacon
      // under the hood (gtag/fbq), which survives the redirect that follows.
      const checkoutValue =
        result.totalSen / 100 +
        (upsellAccepted ? Math.max(1, upsellAmount) : 0);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "begin_checkout",
        event_id: data.reference,
        transaction_id: data.reference,
        value: checkoutValue,
        currency: "MYR",
        payment_method: method,
      });

      if (data.method === "manual") {
        setManualTransfer({
          reference: data.reference,
          amountSen: data.amountSen,
          bank: data.bank,
        });
        setSubmitting(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url as string;
      } else {
        throw new Error("Pautan pembayaran tidak diterima.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Pembayaran gagal dimulakan."
      );
      setSubmitting(false);
    }
  }

  if (manualTransfer) {
    return <ManualTransferCard data={manualTransfer} />;
  }

  return (
    <>
    <Card className="border-primary/20 shadow-lg shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-2xl">Kalkulator & Bayaran Fidyah</CardTitle>
        <CardDescription>
          Masukkan bilangan hari yang ditinggalkan dan butiran anda. Jumlah
          dikira secara automatik.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {FIDYAH_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bilangan hari ditinggalkan</Label>
              <Stepper value={days} onChange={setDays} min={1} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gandaan (jika lewat qada&apos;)</Label>
            <Stepper value={multiplier} onChange={setMultiplier} min={1} />
            <p className="text-xs text-muted-foreground">
              1 = dibayar dalam tempoh. Tambah gandaan bagi setiap tahun qada&apos;
              yang dilewatkan.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {result.days} hari × {formatMYR(result.rateSen)} ×{" "}
                {result.multiplier}
              </span>
              <span>Jumlah</span>
            </div>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Perlu dibayar</span>
              <span className="text-3xl font-bold text-primary">
                {formatMYR(result.totalSen)}
              </span>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nama penuh</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama seperti dalam kad pengenalan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Emel</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@contoh.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">No. telefon (pilihan)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="negeri">Negeri (pilihan)</Label>
              <Select value={negeri} onValueChange={setNegeri}>
                <SelectTrigger id="negeri">
                  <SelectValue placeholder="Pilih negeri" />
                </SelectTrigger>
                <SelectContent>
                  {NEGERI.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Catatan / doa (pilihan)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contoh: Bayaran bagi pihak arwah ayah."
            />
          </div>

          {manualTransferAvailable && (
            <div className="space-y-2">
              <Label>Kaedah pembayaran</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("chip")}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === "chip"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  FPX / Kad / QR
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    Pembayaran segera melalui CHIP
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("manual")}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === "manual"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Pindahan Bank
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    Pindah manual & muat naik bukti bayaran
                  </p>
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting && <Loader2 className="animate-spin" />}
            Bayar {formatMYR(result.totalSen)} Sekarang
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {method === "manual"
              ? "Anda akan diminta pindahkan bayaran secara manual dan muat naik bukti pembayaran."
              : "Pembayaran diproses dengan selamat melalui CHIP (FPX, kad & QR)."}
          </p>
        </form>
      </CardContent>
    </Card>

    {upsell?.enabled && (
      <Dialog open={showUpsell} onOpenChange={setShowUpsell}>
        <DialogContent>
          {upsell.poster_image_url && (
            <div className="relative -mx-6 -mt-6 aspect-square w-[calc(100%+3rem)] overflow-hidden rounded-t-lg">
              <Image
                src={upsell.poster_image_url}
                alt={upsell.title}
                fill
                sizes="(min-width: 640px) 32rem, 100vw"
                className="object-cover"
              />
            </div>
          )}
          <DialogHeader>
            <DialogTitle>{upsell.title}</DialogTitle>
            <DialogDescription>{upsell.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="upsell_amount">Jumlah kempen (RM)</Label>
            <Input
              id="upsell_amount"
              type="number"
              min="1"
              step="0.01"
              value={upsellAmount}
              onChange={(e) => setUpsellAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fidyah</span>
              <span>{formatMYR(result.totalSen)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Kempen tambahan</span>
              <span>{formatMYR(Math.round(Math.max(1, upsellAmount) * 100))}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 font-medium">
              <span>Jumlah jika sertai</span>
              <span className="text-primary">
                {formatMYR(
                  result.totalSen + Math.round(Math.max(1, upsellAmount) * 100)
                )}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => submitDonation(false)}
            >
              {submitting && <Loader2 className="animate-spin" />}
              {upsell.skip_label}
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => submitDonation(true)}
            >
              {submitting && <Loader2 className="animate-spin" />}
              {upsell.accept_label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

function ManualTransferCard({ data }: { data: ManualTransferData }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Sila pilih fail bukti pembayaran.");

    setUploading(true);
    try {
      const form = new FormData();
      form.set("reference", data.reference);
      form.set("file", file);
      const res = await fetch("/api/fidyah/upload-proof", {
        method: "POST",
        body: form,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Ralat tidak dijangka.");
      setUploaded(true);
      toast.success("Bukti pembayaran diterima.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memuat naik bukti."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-primary/20 shadow-lg shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-2xl">Pindahan Bank Manual</CardTitle>
        <CardDescription>
          Pindahkan jumlah di bawah ke akaun bank berikut, kemudian muat naik
          bukti pembayaran (resit/tangkapan skrin).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <Row label="Jumlah" value={formatMYR(data.amountSen)} />
          <Row label="Rujukan" value={data.reference} />
          {data.bank.name && <Row label="Bank" value={data.bank.name} />}
          {data.bank.accountName && (
            <Row label="Nama akaun" value={data.bank.accountName} />
          )}
          {data.bank.accountNumber && (
            <Row label="No. akaun" value={data.bank.accountNumber} />
          )}
        </div>

        {uploaded ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Terima kasih. Bukti pembayaran anda telah diterima dan sedang
              disemak oleh pentadbir. Resit akan dihantar ke emel anda sebaik
              pengesahan selesai.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push(`/status?ref=${data.reference}`)}
            >
              Semak Status
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proof">Bukti pembayaran (imej atau PDF, maks 5MB)</Label>
              <Input
                id="proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={uploading}
            >
              {uploading && <Loader2 className="animate-spin" />}
              Hantar Bukti Pembayaran
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        className="text-center"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
