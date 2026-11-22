"use client";

import { useEffect, useRef, useState } from "react";

import { formatMYR } from "@/lib/utils";

/**
 * A number that eases to its new value instead of jumping, so a changed total
 * reads as a consequence of what the person just did.
 *
 * Server-rendered and first paint show the final value (no flash of zero, and
 * correct with JavaScript off); only later changes animate, unless `fromZero`
 * asks for a count-up on arrival. Anyone who prefers reduced motion just gets
 * the value.
 *
 * `kind` rather than a format function so server components can use it.
 */
export function AnimatedNumber({
  value,
  kind = "int",
  fromZero = false,
  durationMs = 600,
  className,
}: {
  value: number;
  kind?: "int" | "myr";
  fromZero?: boolean;
  durationMs?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = first.current && fromZero ? 0 : current.current;
    const animateFirst = first.current && fromZero;
    first.current = false;

    if (reduce || (start === value && !animateFirst)) {
      current.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }

    const t0 = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const next = start + (value - start) * eased;
      current.current = next;
      setShown(next);
      if (p < 1) id = requestAnimationFrame(tick);
      else {
        current.current = value;
        setShown(value);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value, fromZero, durationMs]);

  const text =
    kind === "myr" ? formatMYR(Math.round(shown)) : Math.round(shown).toLocaleString("en-MY");

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}
