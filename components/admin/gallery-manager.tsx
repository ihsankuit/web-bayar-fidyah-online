"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, Loader2, Video } from "lucide-react";
import { toast } from "sonner";

import {
  addGalleryImage,
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

export function GalleryManager() {
  const [imgState, imgAction] = useActionState<GalleryState, FormData>(
    addGalleryImage,
    {}
  );
  const [vidState, vidAction] = useActionState<GalleryState, FormData>(
    addGalleryVideo,
    {}
  );
  const imgForm = useRef<HTMLFormElement>(null);
  const vidForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (imgState.ok) {
      toast.success("Gambar ditambah ke galeri.");
      imgForm.current?.reset();
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
              <Input id="img-title" name="title" placeholder="Contoh: Majlis Agihan Fidyah" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="img-file">Fail gambar</Label>
              <Input
                id="img-file"
                type="file"
                name="file"
                accept="image/*"
                required
                className="cursor-pointer"
              />
            </div>
            <SubmitButton>Muat Naik Gambar</SubmitButton>
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
