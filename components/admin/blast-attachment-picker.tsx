"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { uploadMedia } from "@/app/admin/(panel)/media/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_SIZE = 10 * 1024 * 1024;

export function BlastAttachmentPicker({ disabled }: { disabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error("Saiz fail melebihi had 10MB.");
      return;
    }

    setName(file.name);
    setPending(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadMedia({}, fd);
    setPending(false);

    if (result.ok && result.url) {
      setUrl(result.url);
      toast.success("Lampiran dimuat naik.");
    } else {
      toast.error(result.error ?? "Gagal memuat naik lampiran.");
      setName(null);
    }
  }

  function remove() {
    setUrl(null);
    setName(null);
  }

  const isImage = url ? /\.(png|jpe?g|gif|webp)$/i.test(url) : false;

  return (
    <div className="space-y-2">
      <Label>Lampiran (pilihan)</Label>
      <input type="hidden" name="media_url" value={url ?? ""} />

      {url ? (
        <div className="flex items-center gap-2 rounded-lg border p-2 text-sm">
          {isImage ? (
            <ImageIcon className="h-4 w-4 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{name ?? url}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={remove}
            aria-label="Buang lampiran"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept="image/*,application/pdf"
            disabled={disabled || pending}
            onChange={handleFileChange}
            className="max-w-xs cursor-pointer"
          />
          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Paperclip className="h-3 w-3" /> Gambar atau PDF dihantar bersama
        mesej sebagai lampiran (maks 10MB).
      </p>
    </div>
  );
}
