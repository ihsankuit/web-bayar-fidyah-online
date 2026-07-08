"use client";

import { useState } from "react";
import { Play } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GalleryItem } from "@/lib/database.types";
import { youtubeThumbnail, youtubeEmbedUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

function thumbnailFor(item: GalleryItem): string {
  if (item.type === "video" && item.youtube_id) {
    return item.image_url || youtubeThumbnail(item.youtube_id);
  }
  return item.image_url || "";
}

export function Gallery({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item)}
            className="group relative aspect-video overflow-hidden rounded-xl border bg-muted text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailFor(item)}
              alt={item.title ?? ""}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {item.type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg">
                  <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                </span>
              </span>
            )}
            {item.title && (
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-medium text-white",
                  item.type === "video" && "pb-3"
                )}
              >
                {item.title}
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(open) => !open && setActive(null)}
      >
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">
            {active?.title ?? "Galeri"}
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
