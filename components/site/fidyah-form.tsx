"use client";

import { useMemo, useState } from "react";
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
import { calculateFidyah, FIDYAH_CATEGORIES, NEGERI } from "@/lib/fidyah";
import { formatMYR } from "@/lib/utils";

export function FidyahForm({ rateSen }: { rateSen: number }) {
  const [days, setDays] = useState(1);
  const [multiplier, setMultiplier] = useState(1);
  const [category, setCategory] = useState(FIDYAH_CATEGORIES[0].id as string);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [negeri, setNegeri] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const result = useMemo(
    () => calculateFidyah({ days, multiplier, rateSen }),
    [days, multiplier, rateSen]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Sila masukkan nama anda.");
    if (!email.trim()) return toast.error("Sila masukkan alamat emel anda.");
    if (result.totalSen < 100)
      return toast.error("Jumlah minimum pembayaran ialah RM1.00.");

    setSubmitting(true);
    try {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ralat tidak dijangka.");
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

  return (
    <Card className="border-primary/20 shadow-lg shadow-primary/5">
      <CardHeader>
        <CardTitle className="text-2xl">Kalkulator & Bayaran Fidyah</CardTitle>
        <CardDescription>
          Masukkan bilangan hari yang ditinggalkan dan butiran anda. Jumlah
          dikira secara automatik.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
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
            Pembayaran diproses dengan selamat melalui Billplz (FPX & kad).
          </p>
        </form>
      </CardContent>
    </Card>
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
