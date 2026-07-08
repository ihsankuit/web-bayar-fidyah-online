"use client";

import { useState } from "react";

/**
 * Decorative muslimah illustration for the "Cara Kira Fidyah" section.
 * Loads from /public/muslimah-fidyah.png. If the file is not present yet, it
 * hides itself so the layout never shows a broken image.
 */
export function FidyahIllustration({ className }: { className?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/muslimah-fidyah.png"
      alt=""
      aria-hidden="true"
      className={className}
      onError={() => setOk(false)}
    />
  );
}
