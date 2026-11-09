"use client";

import { useState } from "react";
import { Play, Trash2, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GalleryItem } from "@/lib/database.types";
import { youtubeThumbnail, youtubeEmbedUrl } from "@/lib/youtube";
import { deleteGalleryItem } from "@/app/admin/(panel)/galeri/actions";

function thumb(item: GalleryItem): string {
  if (item.type === "video" && item.youtube_id) {
    return item.image_url || youtubeThumbnail(item.youtube_id);
  }
  return item.image_url || "";
}

export function GalleryList({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Belum ada item galeri. Tambah gambar atau video di atas.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            {/* Click the thumbnail to preview it full-size / play the video. */}
            <button
              type="button"
              onClick={() => setActive(item)}
              className="group relative block aspect-video w-full bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Pratonton"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb(item)}
                alt={item.title ?? ""}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                {item.type === "video" ? (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg">
                    <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                  </span>
                ) : (
                  <ZoomIn className="h-7 w-7 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
              <Badge
                variant={item.type === "video" ? "default" : "secondary"}
                className="absolute left-2 top-2"
              >
                {item.type === "video" ? (
                  <>
                    <Play className="mr-1 h-3 w-3 fill-current" /> Video
                  </>
                ) : (
                  "Gambar"
                )}
              </Badge>
            </button>
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <p
                className="truncate text-sm font-medium"
                title={item.title ?? ""}
              >
                {item.title || (
                  <span className="text-muted-foreground">Tanpa tajuk</span>
                )}
              </p>
              <form action={deleteGalleryItem}>
                <input type="hidden" name="id" value={item.id} />
                <input
                  type="hidden"
                  name="storage_path"
                  value={item.storage_path ?? ""}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  title="Padam item"
                >
                  <Trash2 />
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
      >
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">
            {active?.title ?? "Pratonton galeri"}
          </DialogTitle>
          {active?.type === "video" && active.youtube_id ? (
            <div className="aspect-video w-full">
              <iframe
                src={youtubeEmbedUrl(active.youtube_id)}
                title={active.title ?? "Video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          ) : active ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.image_url ?? ""}
              alt={active.title ?? ""}
              className="max-h-[80vh] w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
