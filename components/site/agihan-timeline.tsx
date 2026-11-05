import Image from "next/image";
import { MapPin } from "lucide-react";

import type { AgihanUpdate } from "@/lib/database.types";
import { updateImages } from "@/lib/agihan-updates";
import { formatDateOnly } from "@/lib/utils";

/** Vertical timeline of distribution updates (date · place · photos · caption). */
export function AgihanTimeline({ items }: { items: AgihanUpdate[] }) {
  if (items.length === 0) return null;

  return (
    <ol className="relative mx-auto max-w-3xl space-y-10 pl-8">
      {/* The rail the markers sit on. */}
      <span
        aria-hidden
        className="absolute bottom-2 left-[11px] top-2 w-px bg-border"
      />
      {items.map((item) => {
        const images = updateImages(item).slice(0, 4);
        const single = images.length === 1;
        return (
          <li key={item.id} className="relative">
            <span className="absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background">
              <span className="h-2 w-2 rounded-full bg-primary" />
            </span>

            <time className="text-sm font-semibold text-primary-strong">
              {formatDateOnly(item.happened_on)}
            </time>
            {item.title && (
              <h3 className="mt-1 text-lg font-bold tracking-tight">
                {item.title}
              </h3>
            )}
            {item.location && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {item.location}
              </p>
            )}

            {images.length > 0 && (
              <div
                className={
                  single
                    ? "mt-3"
                    : "mt-3 grid grid-cols-2 gap-2"
                }
              >
                {images.map((src, i) => (
                  <div
                    key={src}
                    className={`relative overflow-hidden rounded-xl border bg-muted ${
                      single ? "aspect-video" : "aspect-square"
                    }`}
                  >
                    <Image
                      src={src}
                      alt={item.title ?? "Agihan fidyah"}
                      fill
                      className="object-cover"
                      sizes={
                        single
                          ? "(max-width: 768px) 100vw, 700px"
                          : "(max-width: 768px) 50vw, 350px"
                      }
                      priority={false}
                    />
                  </div>
                ))}
              </div>
            )}

            {item.caption && (
              <p className="mt-3 text-pretty text-muted-foreground">
                {item.caption}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
