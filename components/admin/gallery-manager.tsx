"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";

import {
  addGalleryImages,
  addGalleryVideo,
  type GalleryState,
} from "@/app/admin/(panel)/galeri/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Local previews of the files chosen before they are uploaded. */
function SelectedPreviews({ files }: { files: File[] }) {
  // Object URLs must be created and revoked together so we don't leak them.
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [urls]);

  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {files.length} gambar dipilih
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {urls.map((url, i) => (
          <div
            key={url}
            className="relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={files[i].name}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GalleryManager() {
  const [imgState, imgAction] = useActionState<GalleryState, FormData>(
    addGalleryImages,
    {}
  );
  const [vidState, vidAction] = useActionState<GalleryState, FormData>(
    addGalleryVideo,
    {}
  );
  const imgForm = useRef<HTMLFormElement>(null);
  const vidForm = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<File[]>([]);

  useEffect(() => {
    if (imgState.ok) {
      toast.success(
        `${imgState.uploaded} gambar ditambah ke galeri.` +
          (imgState.failures?.length
            ? ` ${imgState.failures.length} dilangkau.`
            : "")
      );
      if (imgState.failures?.length) {
        toast.error(`Dilangkau — ${imgState.failures.join("; ")}`);
      }
      imgForm.current?.reset();
      setSelected([]);
    } else if (imgState.error) toast.error(imgState.error);
  }, [imgState]);

  useEffect(() => {
    if (vidState.ok) {
      toast.success("Video ditambah ke galeri.");
      vidForm.current?.reset();
    } else if (vidState.error) toast.error(vidState.error);
  }, [vidState]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4 text-primary" /> Tambah Gambar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={imgForm} action={imgAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="img-title">Tajuk (pilihan)</Label>
              <Input
                id="img-title"
                name="title"
                placeholder="Contoh: Majlis Agihan Fidyah"
              />
              <p className="text-xs text-muted-foreground">
                Tajuk yang sama digunakan untuk semua gambar dalam muat naik ini.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="img-file">Fail gambar (boleh pilih banyak)</Label>
              <Input
                id="img-file"
                type="file"
                name="files"
                accept="image/*"
                multiple
                required
                className="cursor-pointer"
                onChange={(e) =>
                  setSelected(Array.from(e.target.files ?? []))
                }
              />
              <p className="text-xs text-muted-foreground">
                Setiap gambar maksimum 10MB. Jika muat naik gagal untuk kumpulan
                besar, cuba bahagikan kepada beberapa kumpulan lebih kecil.
              </p>
            </div>

            {selected.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">Pratonton</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected([]);
                      imgForm.current?.reset();
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Kosongkan
                  </button>
                </div>
                <SelectedPreviews files={selected} />
              </div>
            )}

            <SubmitButton>
              {selected.length > 1
                ? `Muat Naik ${selected.length} Gambar`
                : "Muat Naik Gambar"}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4 text-primary" /> Tambah Video (YouTube)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={vidForm} action={vidAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vid-title">Tajuk (pilihan)</Label>
              <Input id="vid-title" name="title" placeholder="Contoh: Ceramah Fidyah" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vid-url">Pautan YouTube</Label>
              <Input
                id="vid-url"
                name="youtube_url"
                required
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <SubmitButton>Tambah Video</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
