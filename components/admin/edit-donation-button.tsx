"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { updateDonation } from "@/app/admin/(panel)/sumbangan/actions";
import type { Donation } from "@/lib/database.types";
import { FIDYAH_CATEGORIES, NEGERI } from "@/lib/fidyah";
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
                max="365"
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
