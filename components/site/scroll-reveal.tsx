"use client";

import { useEffect } from "react";

/**
 * Fades sections in as they scroll into view. Mark a section with
 * `data-reveal`; this wires them up once, from a single observer.
 *
 * Progressive by design: nothing is hidden until this has run (the CSS only
 * applies under `html[data-reveal-ready]`), so with JavaScript off, before
 * hydration, or for anyone preferring reduced motion, the page is simply
 * visible. Sections already on screen are shown at once, never flashed.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    // Anything already in view must not start hidden.
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
      else io.observe(el);
    }
    document.documentElement.setAttribute("data-reveal-ready", "");

    return () => {
      io.disconnect();
      document.documentElement.removeAttribute("data-reveal-ready");
    };
  }, []);

  return null;
}
