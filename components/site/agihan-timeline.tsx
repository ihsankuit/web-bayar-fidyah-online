"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

import type { AgihanUpdate } from "@/lib/database.types";
import { captionPreview, updateImages } from "@/lib/agihan-updates";
import { cn, formatDateOnly } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Horizontal, side-scrolling timeline of distribution updates. Each card is one
 * update (date · place · up to 4 photos · caption), joined along a top rail.
 * Native swipe on touch; prev/next buttons appear when there's room to scroll.
 */
export function AgihanTimeline({ items }: { items: AgihanUpdate[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [active, setActive] = useState<AgihanUpdate | null>(null);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows, items.length]);

  function scrollByPage(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * el.clientWidth * 0.85,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateArrows}
        className="flex gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => {
          const images = updateImages(item).slice(0, 4);
          const single = images.length === 1;
          const isLast = i === items.length - 1;
          return (
            <article
              key={item.id}
              className="w-[85%] flex-none sm:w-[360px] lg:w-[400px]"
            >
              {/* Marker + rail segment joining this card to the next. */}
              <div className="relative mb-4 h-6">
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-3 top-[11px] h-px bg-border",
                    isLast ? "right-3" : "right-[-20px]"
                  )}
                />
                <span className="absolute left-0 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
              </div>

              <time className="text-sm font-semibold text-primary-strong">
                {formatDateOnly(item.happened_on)}
              </time>
              {item.title && (
                <h3 className="mt-1 text-lg font-bold leading-snug tracking-tight">
                  {item.title}
                </h3>
              )}
              {item.location && (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {item.location}
                </p>
              )}

              {images.length > 0 && (
                <div
                  className={cn(
                    "mt-3",
                    !single && "grid grid-cols-2 gap-2"
                  )}
                >
                  {images.map((src) => (
                    <div
                      key={src}
                      className={cn(
                        "relative overflow-hidden rounded-xl border bg-muted",
                        single ? "aspect-video" : "aspect-square"
                      )}
                    >
                      <Image
                        src={src}
                        alt={item.title ?? "Agihan fidyah"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 85vw, 400px"
                      />
                    </div>
                  ))}
                </div>
              )}

              {item.caption &&
                (() => {
                  const preview = captionPreview(item.caption);
                  return (
                    <div className="mt-3">
                      <p className="whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                        {preview.text}
                      </p>
                      {preview.truncated && (
                        <button
                          type="button"
                          onClick={() => setActive(item)}
                          className="mt-1 text-sm font-semibold text-primary-strong hover:underline"
                        >
                          Baca lagi →
                        </button>
                      )}
                    </div>
                  );
                })()}
            </article>
          );
        })}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{active?.title ?? "Update Agihan"}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary-strong">
                {formatDateOnly(active.happened_on)}
                {active.location ? ` · ${active.location}` : ""}
              </p>
              <p className="whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                {active.caption}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label="Update sebelum"
        className={cn(
          "absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-md backdrop-blur transition-opacity hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          canLeft ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label="Update seterusnya"
        className={cn(
          "absolute -right-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-md backdrop-blur transition-opacity hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          canRight ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
