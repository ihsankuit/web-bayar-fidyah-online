"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface RangePreset {
  key: string;
  label: string;
}

/**
 * A date-range filter: presets down the left, a custom from/to on the right.
 * The chosen range lives in the URL (?range=… or ?range=custom&from=&to=) so a
 * view can be bookmarked or shared, and the server page does the filtering.
 */
export function DateRangePicker({
  presets,
  activeKey,
  from,
  to,
  summary,
  basePath = "/admin",
}: {
  presets: RangePreset[];
  activeKey: string;
  /** YYYY-MM-DD, Malaysian dates, to prefill the custom fields. */
  from: string;
  to: string;
  /** What the button says, e.g. "30 hari lepas". */
  summary: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dari, setDari] = useState(activeKey === "custom" ? from : "");
  const [hingga, setHingga] = useState(activeKey === "custom" ? to : "");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (qs: string) => {
    setOpen(false);
    router.push(`${basePath}?${qs}`);
  };
  const canApply = Boolean(dari && hingga);

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
      >
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {summary}
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih julat tarikh"
          className="absolute left-0 z-30 mt-2 flex max-h-[80vh] w-[min(92vw,34rem)] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl sm:flex-row"
        >
          <ul className="max-h-60 overflow-y-auto border-b p-2 sm:max-h-none sm:w-48 sm:shrink-0 sm:border-b-0 sm:border-r">
            {presets.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => go(`range=${p.key}`)}
                  aria-current={activeKey === p.key ? "true" : undefined}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    activeKey === p.key
                      ? "bg-primary/10 font-semibold text-primary"
                      : "hover:bg-accent"
                  )}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>

          <form
            className="flex-1 space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canApply) go(`range=custom&from=${dari}&to=${hingga}`);
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Julat sendiri
            </p>
            <label className="block text-xs font-medium text-muted-foreground">
              Dari
              <input
                type="date"
                value={dari}
                max={hingga || undefined}
                onChange={(e) => setDari(e.target.value)}
                className="mt-1 block h-10 w-full rounded-xl border bg-muted/40 px-3 text-sm text-foreground"
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Hingga
              <input
                type="date"
                value={hingga}
                min={dari || undefined}
                onChange={(e) => setHingga(e.target.value)}
                className="mt-1 block h-10 w-full rounded-xl border bg-muted/40 px-3 text-sm text-foreground"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!canApply}
                className="h-10 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                Terapkan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDari("");
                  setHingga("");
                  go("range=semua");
                }}
                className="h-10 rounded-xl border px-4 text-sm font-semibold transition-colors hover:bg-accent"
              >
                Kosongkan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
