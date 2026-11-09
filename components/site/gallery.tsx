"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

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
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows, items.length]);

  function scrollByPage(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Advance by most of a viewport so a peeked slide becomes fully visible.
    el.scrollBy({
      left: dir * el.clientWidth * 0.85,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      <div className="relative">
        {/* Track: horizontal, snap-scrolled, one peek of the next slide. */}
        <div
          ref={trackRef}
          onScroll={updateArrows}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item)}
              className="group relative aspect-video w-[80%] flex-none snap-start overflow-hidden rounded-xl border bg-muted text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
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
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-xs font-medium text-white">
                  {item.title}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Prev / next — shown only when there's room to scroll that way. */}
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Slaid sebelum"
          className={cn(
            "absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-md backdrop-blur transition-opacity hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            canLeft ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Slaid seterusnya"
          className={cn(
            "absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-md backdrop-blur transition-opacity hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            canRight ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
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
