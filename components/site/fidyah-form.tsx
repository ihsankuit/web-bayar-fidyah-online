"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Minus,
  Plus,
  X,
} from "lucide-react";
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
import {
  calculateQada,
  formatCalendarDate,
  latestRamadanHijriYear,
  MAX_RAMADAN_DAYS,
  nextRamadan,
  qadaYearOptions,
  QADA_CATEGORY_ID as QADA_CATEGORY,
  MAX_QADA_ROWS,
  QADA_REVIEW_THRESHOLD_SEN,
} from "@/lib/ramadan";
import { formatMYR } from "@/lib/utils";
import { getStoredUtm, getStoredClickIds } from "@/lib/utm";
import type { PaymentMethod, UpsellSettings } from "@/lib/database.types";


interface QadaRowState {
  /** Stable key, so removing a row does not shift what is typed into the rest. */
  id: number;
  hijriYear: number;
  days: number;
}

interface ManualTransferData {
  reference: string;
  amountSen: number;
  bank: {
    name: string;
    accountName: string;
    accountNumber: string;
    qrImageUrl?: string;
  };
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
  // "Today" is fixed when the form mounts. Lewat qada' depends on the date
  // (a row's multiplier steps up the day a new Ramadan begins), and holding
  // it steady keeps the figure from shifting under someone mid-form.
  const [now, setNow] = useState(() => new Date());
  const yearOptions = useMemo(() => qadaYearOptions(now), [now]);
  const nextRowId = useRef(2);
  const [qadaRows, setQadaRows] = useState<QadaRowState[]>(() => [
    // Lewat qada' means a Ramadan has gone by, so open on last year's rather
    // than on the most recent one, which would start the payer at RM0.
    { id: 1, hijriYear: latestRamadanHijriYear(new Date()) - 1, days: 1 },
  ]);
  const [category, setCategory] = useState(FIDYAH_CATEGORIES[0].id as string);
  const [chosenMethod, setMethod] = useState<PaymentMethod>("chip");
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [showRange, setShowRange] = useState(false);
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
    () => calculateFidyah({ days, rateSen }),
    [days, rateSen]
  );

  const isQada = category === QADA_CATEGORY;
  const [basicOnly, setBasicOnly] = useState(false);
  const qada = useMemo(
    () => calculateQada(qadaRows, rateSen, now, { basicOnly }),
    [qadaRows, rateSen, now, basicOnly]
  );
  const upcomingRamadan = useMemo(() => nextRamadan(now), [now]);
  // The server's own figure, kept when it disagreed with this browser's. A
  // browser can work out Ramadan's start slightly differently (older engines
  // lack the Umm al-Qura calendar), and recalculating here would never match,
  // so the payer would be refused on every attempt. It applies only to the
  // exact set of years it was given for.
  const orderKey = useMemo(
    () => JSON.stringify([qadaRows.map((r) => [r.hijriYear, r.days]), basicOnly]),
    [qadaRows, basicOnly]
  );
  const [serverOverride, setServerOverride] = useState<{
    key: string;
    amountSen: number;
  } | null>(null);
  const overrideActive = serverOverride?.key === orderKey;
  const qadaTotalSen = overrideActive ? serverOverride.amountSen : qada.totalSen;
  // The one figure everything below charges, whichever mode is showing.
  const totalSen = isQada ? qadaTotalSen : result.totalSen;
  // A big lewat qada' total is not charged online: it goes by bank transfer
  // and staff check the proof.
  const requiresReview = isQada && totalSen >= QADA_REVIEW_THRESHOLD_SEN;
  const method: PaymentMethod = requiresReview ? "manual" : chosenMethod;

  function generateRange() {
    if (rangeFrom === null || rangeTo === null) {
      return toast.error("Sila pilih tahun mula dan tahun akhir.");
    }
    const lo = Math.min(rangeFrom, rangeTo);
    const hi = Math.max(rangeFrom, rangeTo);
    const years = yearOptions
      .filter((o) => o.hijriYear >= lo && o.hijriYear <= hi)
      .map((o) => o.hijriYear)
      .sort((a, b) => b - a);
    if (years.length === 0) return toast.error("Tiada tahun dalam julat itu.");
    setQadaRows(
      years.map((hijriYear) => ({
        id: nextRowId.current++,
        hijriYear,
        days: rangeDays,
      }))
    );
    setShowRange(false);
  }

  function updateQadaRow(id: number, patch: Partial<QadaRowState>) {
    setQadaRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addQadaRow() {
    const used = new Set(qadaRows.map((r) => r.hijriYear));
    const free = yearOptions.find((o) => !used.has(o.hijriYear));
    if (!free || qadaRows.length >= MAX_QADA_ROWS) return;
    setQadaRows((rows) => [
      ...rows,
      { id: nextRowId.current++, hijriYear: free.hijriYear, days: 1 },
    ]);
  }

  function removeQadaRow(id: number) {
    setQadaRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Sila masukkan nama anda.");
    if (!email.trim()) return toast.error("Sila masukkan alamat emel anda.");
    if (isQada && qadaTotalSen === 0)
      return toast.error(
        "Tiada fidyah kelewatan bagi tahun yang dipilih lagi. Qada' puasa anda sebelum Ramadan berikutnya."
      );
    if (totalSen < 100)
      return toast.error("Jumlah minimum pembayaran ialah RM1.00.");
    if (requiresReview && !manualTransferAvailable)
      return toast.error(
        "Jumlah ini besar. Sila hubungi pasukan kami untuk menguruskan bayaran."
      );

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
      const clickIds = getStoredClickIds();
      const res = await fetch("/api/fidyah/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          negeri,
          category,
          // Lewat qada': send the years and let the server work the amount
          // out; days/multiplier are only the legacy shape for other
          // categories. expectedFidyahSen lets the server tell us if the
          // date has moved the figure since it was shown.
          days: isQada ? 1 : result.days,
          multiplier: isQada ? 1 : result.multiplier,
          ...(isQada
            ? {
                qada: qadaRows.map((r) => ({
                  hijriYear: r.hijriYear,
                  days: r.days,
                })),
                qadaBasicOnly: basicOnly,
                expectedFidyahSen: qadaTotalSen,
              }
            : {}),
          message,
          method,
          upsellAccepted,
          upsellAmountSen: upsellAccepted
            ? Math.round(Math.max(1, upsellAmount) * 100)
            : undefined,
          ...(utm ?? {}),
          ...(clickIds ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "AMOUNT_CHANGED") {
          // A Ramadan began while the form was open. Recalculate on the
          // server's clock so the screen shows what we would charge.
          if (data.serverTime) setNow(new Date(data.serverTime));
          if (typeof data.amountSen === "number") {
            setServerOverride({ key: orderKey, amountSen: data.amountSen });
          }
          toast.error(data.error);
          setSubmitting(false);
          return;
        }
        throw new Error(data.error ?? "Ralat tidak dijangka.");
      }

      // Checkout initiated: the donation row exists and we're about to hand
      // the payer over to CHIP (or show the bank-transfer card). Fire it here
      // — the actual CHIP payment page is on chip-in.asia, a domain our GTM
      // can't run on, so this is the last point we control. Uses sendBeacon
      // under the hood (gtag/fbq), which survives the redirect that follows.
      const checkoutValue =
        totalSen / 100 +
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
        <CardTitle className="text-2xl">Kalkulator Fidyah</CardTitle>
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

            {!isQada && (
              <div className="space-y-2">
                <Label>Bilangan hari ditinggalkan</Label>
                <Stepper
                  value={days}
                  onChange={setDays}
                  min={1}
                  label="Bilangan hari ditinggalkan"
                />
              </div>
            )}
          </div>

          {isQada && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed">
                <button
                  type="button"
                  onClick={() => setShowRange((v) => !v)}
                  aria-expanded={showRange}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-medium">
                      Tertunggak banyak tahun?
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Isi julat tahun sekaligus, sehingga {MAX_QADA_ROWS} tahun.
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      showRange ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showRange && (
              <div className="space-y-3 border-t p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="range-from">Dari tahun</Label>
                    <Select
                      value={rangeFrom === null ? "" : String(rangeFrom)}
                      onValueChange={(v) => setRangeFrom(Number(v))}
                    >
                      <SelectTrigger id="range-from">
                        <SelectValue placeholder="Pilih tahun" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((o) => (
                          <SelectItem key={o.hijriYear} value={String(o.hijriYear)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="range-to">Hingga tahun</Label>
                    <Select
                      value={rangeTo === null ? "" : String(rangeTo)}
                      onValueChange={(v) => setRangeTo(Number(v))}
                    >
                      <SelectTrigger id="range-to">
                        <SelectValue placeholder="Pilih tahun" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((o) => (
                          <SelectItem key={o.hijriYear} value={String(o.hijriYear)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2 sm:col-span-1">
                    <Label>Hari setahun</Label>
                    <Stepper
                      value={rangeDays}
                      onChange={setRangeDays}
                      min={1}
                      max={MAX_RAMADAN_DAYS}
                      label="Purata hari ditinggalkan setahun"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={generateRange}
                >
                  Jana senarai tahun
                </Button>
              </div>
                )}
              </div>

              {qadaRows.map((row, i) => {
                const computed = qada.rows[i];
                const taken = new Set(
                  qadaRows.filter((r) => r.id !== row.id).map((r) => r.hijriYear)
                );
                return (
                  <div key={row.id} className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <div className="col-span-2 space-y-2 sm:col-span-1">
                        <Label htmlFor={`qada-year-${row.id}`}>
                          Tahun puasa ditinggalkan
                        </Label>
                        <Select
                          value={String(row.hijriYear)}
                          onValueChange={(v) =>
                            updateQadaRow(row.id, { hijriYear: Number(v) })
                          }
                        >
                          <SelectTrigger id={`qada-year-${row.id}`}>
                            <SelectValue placeholder="Pilih tahun" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((o) => (
                              <SelectItem
                                key={o.hijriYear}
                                value={String(o.hijriYear)}
                                disabled={taken.has(o.hijriYear)}
                              >
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Bilangan hari</Label>
                        <Stepper
                          value={row.days}
                          onChange={(v) => updateQadaRow(row.id, { days: v })}
                          min={1}
                          max={MAX_RAMADAN_DAYS}
                          label={`Bilangan hari ditinggalkan, ${computed.label}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 sm:h-10 sm:w-10"
                        aria-label={`Buang ${computed.label}`}
                        onClick={() => removeQadaRow(row.id)}
                        disabled={qadaRows.length === 1}
                      >
                        <X />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {computed.multiplier === 0
                        ? "Belum melepasi 1 Ramadan berikutnya. Gandaan belum dikenakan."
                        : computed.waivedMultiplier
                          ? `Telah melepasi ${computed.waivedMultiplier} Ramadan. Gandaan ${computed.waivedMultiplier}× tidak dikenakan, bayaran asas sahaja.`
                          : `Telah melepasi ${computed.multiplier} Ramadan. Gandaan ${computed.multiplier}×.`}
                    </p>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={addQadaRow}
                disabled={
                  qadaRows.length >= MAX_QADA_ROWS ||
                  qadaRows.length >= yearOptions.length
                }
              >
                <Plus /> Tambah tahun
              </Button>
              <p className="text-xs text-muted-foreground">
                Kadar tetap {formatMYR(rateSen)} sehari. Gandaan bermula selepas
                1 Ramadan berikutnya, iaitu tarikh ganti puasa sepatutnya
                dibuat, dan bertambah apabila Ramadan baharu bermula (
                {upcomingRamadan.hijriYear}H dijangka sekitar{" "}
                {formatCalendarDate(upcomingRamadan.start)}).
              </p>
              <label
                htmlFor="qada-basic-only"
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
              >
                <input
                  id="qada-basic-only"
                  type="checkbox"
                  checked={basicOnly}
                  onChange={(e) => setBasicOnly(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-medium">
                    Saya tidak mampu membayar gandaan
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Dikira bayaran asas sahaja (hari × {formatMYR(rateSen)}),
                    tanpa gandaan. Qada&apos; puasa tetap wajib diganti jika
                    mampu.
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-lg border bg-muted/40 p-4">
            {isQada ? (
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {qada.rows.map((r) => (
                  <div key={r.hijriYear} className="flex items-center justify-between">
                    <span>
                      {r.label} · {r.days} hari × {r.multiplier}
                    </span>
                    <span>{formatMYR(r.subtotalSen)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-1.5">
                  <span>Jumlah hari dikenakan</span>
                  <span>{qada.chargeableDays} hari</span>
                </div>
                {overrideActive && qada.totalSen !== qadaTotalSen && (
                  <p className="pt-1 text-xs">
                    Jumlah dikemas kini oleh sistem mengikut tarikh semasa.
                    Tekan Bayar untuk teruskan dengan jumlah ini.
                  </p>
                )}
                {qadaTotalSen === 0 && (
                  <p className="pt-1 text-xs">
                    Tiada fidyah kelewatan lagi bagi tahun yang dipilih. Qada&apos;
                    puasa anda sebelum Ramadan {upcomingRamadan.hijriYear}H bermula.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {result.days} hari × {formatMYR(result.rateSen)}
                </span>
                <span>Jumlah</span>
              </div>
            )}
            <div className="mt-1 flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Perlu dibayar</span>
              <span className="text-3xl font-bold text-primary">
                {formatMYR(totalSen)}
              </span>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nama penuh</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
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
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
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
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="negeri-select">Negeri (pilihan)</Label>
              <Select value={negeri} onValueChange={setNegeri}>
                <SelectTrigger id="negeri-select">
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
              maxLength={500}
              placeholder="Contoh: Bayaran bagi pihak arwah ayah."
            />
          </div>

          {requiresReview && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Jumlah ini besar (RM5,000 ke atas), jadi bayaran dibuat melalui
              pindahan bank dan disahkan oleh pasukan kami.
              {!manualTransferAvailable &&
                " Sila hubungi kami untuk menguruskan bayaran."}
            </p>
          )}

          {manualTransferAvailable && !requiresReview && (
            <div className="space-y-2">
              <Label>Kaedah pembayaran</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMethod("chip")}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === "chip"
                      ? "border-primary bg-primary/5 text-primary-strong"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  FPX / Kad / QR
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    Pembayaran segera melalui CHIP
                  </p>
                  <Image
                    src="/pay-with-chip-long.svg"
                    alt="Pay with CHIP"
                    width={623}
                    height={100}
                    className="mt-2 h-5 w-auto"
                    unoptimized
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("manual")}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === "manual"
                      ? "border-primary bg-primary/5 text-primary-strong"
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
            Bayar {formatMYR(totalSen)} Sekarang
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
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto overflow-x-hidden sm:w-full">
          {upsell.poster_image_url && (
            <div className="-mx-6 -mt-6 overflow-hidden rounded-t-lg bg-muted">
              <Image
                src={upsell.poster_image_url}
                alt={upsell.title}
                width={0}
                height={0}
                sizes="(min-width: 640px) 32rem, 100vw"
                style={{ width: "100%", height: "auto" }}
                className="mx-auto max-h-[55vh] object-contain"
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
              inputMode="decimal"
              min="1"
              step="0.01"
              value={upsellAmount}
              onChange={(e) => setUpsellAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fidyah</span>
              <span>{formatMYR(totalSen)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Kempen tambahan</span>
              <span>{formatMYR(Math.round(Math.max(1, upsellAmount) * 100))}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 font-medium">
              <span>Jumlah jika sertai</span>
              <span className="text-primary-strong">
                {formatMYR(
                  totalSen + Math.round(Math.max(1, upsellAmount) * 100)
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
          {/* Amount, reference and account number are copyable: typing them by
              hand is where transfers go wrong, and a mistyped reference means
              an admin has to reconcile the payment manually. */}
          <Row label="Jumlah" value={formatMYR(data.amountSen)} copyable />
          <Row label="Rujukan" value={data.reference} copyable />
          {data.bank.name && <Row label="Bank" value={data.bank.name} />}
          {data.bank.accountName && (
            <Row label="Nama akaun" value={data.bank.accountName} />
          )}
          {data.bank.accountNumber && (
            <Row label="No. akaun" value={data.bank.accountNumber} copyable />
          )}
        </div>

        {data.bank.qrImageUrl && (
          <div className="space-y-3 rounded-lg border p-4 text-center">
            <p className="text-sm font-medium">Atau imbas QR</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.bank.qrImageUrl}
              alt="Kod QR pembayaran"
              className="mx-auto h-56 w-56 rounded-md border bg-white object-contain p-2"
            />
            <Button variant="outline" size="sm" asChild>
              <a href={data.bank.qrImageUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" /> Muat Turun QR
              </a>
            </Button>
            {/* A payer on a phone can't scan a QR shown on that same phone, so
                spell out the gallery route rather than leaving them stuck. */}
            <p className="text-xs text-muted-foreground">
              Guna telefon? Simpan QR di atas, kemudian buka aplikasi bank anda
              → DuitNow QR → <strong>pilih dari galeri</strong>. Lebih mudah:
              salin no. akaun dan buat pindahan biasa.
            </p>
          </div>
        )}

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

function Row({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin. Sila salin secara manual.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            aria-label={`Salin ${label}`}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </span>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min, v));
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0 sm:h-10 sm:w-10"
        aria-label={`Kurangkan ${label}`}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus />
      </Button>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
        className="h-11 text-center sm:h-10"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0 sm:h-10 sm:w-10"
        aria-label={`Tambah ${label}`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus />
      </Button>
    </div>
  );
}
