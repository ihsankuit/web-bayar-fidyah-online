"use client";

import { formatQadaBreakdown } from "@/lib/ramadan";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ExternalLink, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { updateDonation } from "@/app/admin/(panel)/sumbangan/actions";
import type { Donation } from "@/lib/database.types";
import { FIDYAH_CATEGORIES, NEGERI } from "@/lib/fidyah";
import {
  isApiRecorded,
  needsReview,
  paymentMethodLabel,
  sourceLabel,
} from "@/lib/payment-methods";
import { formatDate } from "@/lib/utils";
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

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan Perubahan
    </Button>
  );
}

/**
 * The attached proof, shown in place so staff can match it against the bank
 * statement without leaving the dialog. The bucket is private: the image is
 * loaded through a short-lived signed URL, fetched when the dialog opens and
 * again after an upload or removal (`version` changes).
 */
function ProofPreview({
  donationId,
  hasProof,
  version,
}: {
  donationId: string;
  hasProof: boolean;
  version: number;
}) {
  // The outcome is stored against the request that produced it. Nothing is set
  // synchronously inside the effect: a stale result (an older version, or a
  // proof that has since been removed) simply no longer matches `key`.
  const key = `${donationId}:${version}`;
  const [result, setResult] = useState<{
    key: string;
    url?: string;
    failed?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!hasProof) return;
    let cancelled = false;
    fetch(`/admin/sumbangan/proof/${donationId}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        setResult(ok && d.url ? { key, url: d.url as string } : { key, failed: true });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [donationId, hasProof, version, key]);

  if (!hasProof) return null;
  const current = result?.key === key ? result : null;
  const url = current?.url ?? null;

  if (current?.failed) {
    return (
      <p className="text-xs text-destructive">Gagal memuatkan pratonton bukti.</p>
    );
  }
  if (!url) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // The signed URL has no extension, so the type is read from the file name
  // the server chose (always .jpg / .png / .webp / .pdf for API uploads).
  const isPdf = /\.pdf(\?|$)/i.test(url);
  return (
    <div className="space-y-2">
      {isPdf ? (
        <p className="text-xs text-muted-foreground">Bukti ialah fail PDF.</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Bukti pembayaran"
          className="max-h-56 w-auto rounded-md border bg-background object-contain"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
      >
        <ExternalLink className="h-3 w-3" /> Buka bukti dalam tab baharu
      </a>
    </div>
  );
}

/**
 * Edit a donation and, where needed, confirm it by hand.
 *
 * The case this is built for: a payer whose CHIP attempt failed, who paid
 * another way and sent the receipt over WhatsApp. The admin attaches that
 * receipt here and sets the status to Dibayar, which sends the payer their
 * own receipt and records the conversion.
 *
 * The proof upload sits outside the main form and posts on its own, because
 * a form can't be nested and because a photo of a receipt is larger than the
 * 1MB a Server Action will accept.
 */
export function EditDonationButton({ donation }: { donation: Donation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofPath, setProofPath] = useState(donation.proof_of_payment_path);
  // Bumped after an upload / removal so the preview reloads.
  const [proofVersion, setProofVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveAction(formData: FormData) {
    const result = await updateDonation({}, formData);
    if (result.ok) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    } else if (result.error) {
      toast.error(result.error);
    }
  }

  async function uploadProof() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Sila pilih fail bukti pembayaran dahulu.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/admin/sumbangan/proof/${donation.id}`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Muat naik gagal.");

      setProofPath("ada");
      setProofVersion((v) => v + 1);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Bukti pembayaran dimuat naik.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Muat naik gagal.");
    } finally {
      setUploading(false);
    }
  }

  async function removeProof() {
    setUploading(true);
    try {
      const res = await fetch(`/admin/sumbangan/proof/${donation.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuang bukti.");

      setProofPath(null);
      setProofVersion((v) => v + 1);
      toast.success("Bukti pembayaran dibuang.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuang bukti.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title="Sunting butiran & sahkan pembayaran"
      >
        <Pencil /> Sunting
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sunting Sumbangan — {donation.reference}</DialogTitle>
          </DialogHeader>

          {donation.payment_method !== "chip" && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {paymentMethodLabel(donation.payment_method)}
                </span>
                {sourceLabel(donation.utm_source) && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {sourceLabel(donation.utm_source)}
                  </span>
                )}
                {needsReview(donation) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    Perlu Semak
                  </span>
                )}
              </div>
              {isApiRecorded(donation.payment_method) && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Dicatat melalui API untuk bayaran yang sudah dibuat di luar
                  laman.
                  {donation.claimed_paid_at
                    ? ` Pengirim menyatakan bayaran pada ${formatDate(
                        donation.claimed_paid_at
                      )}; tarikh ini digunakan pada resit apabila disahkan.`
                    : ""}{" "}
                  Padankan dengan penyata bank sebelum mengesahkan.
                </p>
              )}
            </div>
          )}

          {/* Proof of payment. Its own section because it uploads on its own,
              before the form below is saved. */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Bukti Pembayaran</p>
              {proofPath ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Bukti sudah dilampirkan
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Belum ada bukti
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="h-auto flex-1 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
                disabled={uploading}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={uploadProof}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                Muat Naik
              </Button>
              {proofPath && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={removeProof}
                  disabled={uploading}
                  title="Buang bukti sedia ada"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Gambar resit yang pembayar hantar melalui WhatsApp boleh dimuat
              naik di sini. JPG, PNG, WEBP atau PDF, maksimum 5MB. Memuat naik
              yang baharu akan menggantikan yang lama.
            </p>
            {/* Only when the dialog is open: it is mounted either way, and the
                preview must not fetch a signed URL for every row in the list. */}
            {open && (
              <ProofPreview
                donationId={donation.id}
                hasProof={Boolean(proofPath)}
                version={proofVersion}
              />
            )}
          </div>

          <form action={saveAction} className="space-y-4">
            <input type="hidden" name="id" value={donation.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nama pembayar"
                name="payer_name"
                defaultValue={donation.payer_name}
                required
              />
              <Field
                label="Emel"
                name="payer_email"
                type="email"
                defaultValue={donation.payer_email}
                required
              />
              <Field
                label="No. telefon"
                name="payer_phone"
                defaultValue={donation.payer_phone ?? ""}
              />
              <div className="space-y-2">
                <Label htmlFor={`negeri-${donation.id}`}>Negeri</Label>
                <select
                  id={`negeri-${donation.id}`}
                  name="negeri"
                  defaultValue={donation.negeri ?? ""}
                  className={SELECT_CLASS}
                >
                  <option value="">—</option>
                  {NEGERI.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`category-${donation.id}`}>Kategori</Label>
                <select
                  id={`category-${donation.id}`}
                  name="category"
                  defaultValue={donation.category}
                  className={SELECT_CLASS}
                >
                  {FIDYAH_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`status-${donation.id}`}>Status</Label>
                <select
                  id={`status-${donation.id}`}
                  name="status"
                  defaultValue={donation.status}
                  className={SELECT_CLASS}
                >
                  <option value="pending">Menunggu</option>
                  <option value="paid">Dibayar</option>
                  <option value="failed">Gagal</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Bilangan hari"
                name="days"
                type="number"
                min="1"
                max="10000"
                defaultValue={String(donation.days)}
                required
              />
              <Field
                label="Gandaan"
                name="multiplier"
                type="number"
                min="1"
                max="20"
                defaultValue={String(donation.multiplier)}
                required
              />
              <Field
                label="Jumlah (RM)"
                name="amount"
                type="number"
                step="0.01"
                min="1"
                defaultValue={(donation.amount_sen / 100).toFixed(2)}
                required
              />
            </div>

            {donation.qada_breakdown && donation.qada_breakdown.length > 0 && (
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Pecahan lewat qada&apos;: {formatQadaBreakdown(donation.qada_breakdown)}.
                Jika anda mengubah kategori, hari, gandaan atau jumlah, pecahan
                tahun ini dipadam dan resit akan guna satu baris yang sepadan
                dengan angka baharu.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor={`message-${donation.id}`}>Catatan / doa</Label>
              <Textarea
                id={`message-${donation.id}`}
                name="message"
                rows={3}
                defaultValue={donation.message ?? ""}
              />
            </div>

            {donation.status === "paid" ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Sumbangan ini <strong>sudah disahkan dibayar</strong>. Mengubah
                jumlah di sini akan mengubah angka yang sudah masuk dalam
                laporan dan resit yang pembayar terima. Ubah hanya jika ada
                kesilapan sebenar. Setiap perubahan direkodkan dalam Log
                Aktiviti.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Menukar status kepada <strong>Dibayar</strong> akan menghantar
                resit kepada pembayar dan merekodkan penukaran — sama seperti
                pembayaran yang berjaya melalui gerbang. Setiap perubahan
                direkodkan dalam Log Aktiviti.
              </p>
            )}

            <div className="flex justify-end">
              <SaveButton />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
