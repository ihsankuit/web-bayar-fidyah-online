import { cn } from "@/lib/utils";

/**
 * Decorative background layers for the landing page.
 *
 * Both sit at -z-10 inside a `relative` section, which puts them above that
 * section's own background but below its content — the same arrangement the
 * hero already uses for its glow. They are purely decorative, so they are
 * hidden from assistive technology and never take pointer events.
 *
 * The patterns themselves live in globals.css as CSS masks, so adding one
 * costs no network request and nothing for the browser to decode.
 *
 * To stop a pattern running into a block of text, put a
 * `bg-gradient-to-b from-transparent to-background` layer over it rather
 * than trying to fade the mask itself — same approach the hero image uses,
 * and it degrades to "no fade" on nothing.
 */

/** Faint eight-point star lattice. For large flat panels between sections. */
export function GeometricTexture({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "texture-geometric pointer-events-none absolute inset-0 -z-10",
        className
      )}
    />
  );
}

/** Fine film grain. Keeps a large panel from reading as a flat rectangle. */
export function GrainTexture({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "texture-grain pointer-events-none absolute inset-0 -z-10",
        className
      )}
    />
  );
}
