"use client";

import { useState } from "react";
import { FileCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProofViewer({
  donationId,
  path,
}: {
  donationId: string;
  path: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPdf = path.toLowerCase().endsWith(".pdf");

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next || url) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/admin/sumbangan/proof/${donationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ralat tidak dijangka.");
      setUrl(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuatkan bukti.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onOpenChange(true)}
      >
        <FileCheck /> Lihat Bukti
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bukti Pembayaran</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        )}

        {url && !loading && (
          isPdf ? (
            <iframe
              src={url}
              title="Bukti pembayaran (PDF)"
              className="h-[70vh] w-full rounded-md border"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Bukti pembayaran"
              className="max-h-[70vh] w-full rounded-md border object-contain"
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
