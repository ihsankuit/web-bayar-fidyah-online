import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * Open Graph defaults for pages that set their own `openGraph` block.
 *
 * Next.js REPLACES the parent's openGraph object rather than merging into it,
 * so a page that sets only a title and description silently drops the root
 * layout's siteName and locale — and, worse, keeps whatever `url` the parent
 * declared. That is how four pages ended up advertising the homepage as their
 * og:url while their canonical pointed at themselves, which is the mismatch
 * Ahrefs flags.
 *
 * Spread this into a page's openGraph and pass its own path, so og:url and
 * the canonical can never drift apart again.
 */
export function openGraphFor(path: string): NonNullable<Metadata["openGraph"]> {
  return {
    // `type` has to be repeated here for the same reason as the rest: the
    // parent's "website" is dropped, not merged, the moment a page declares
    // its own block.
    type: "website",
    url: `${SITE_URL}${path}`,
    siteName: "Bayar Fidyah Online",
    locale: "ms_MY",
  };
}

/**
 * The site's generated share image, used when a page has nothing of its own.
 *
 * The root `opengraph-image` file convention only reaches pages that declare
 * no `openGraph` block at all; once a page declares one, it has to name the
 * image itself or share previews fall back to a blank card.
 */
// The version suffix is a cache-buster: link previews keep an image for weeks
// per URL, so a redesigned image needs a new URL to be picked up. Bump it
// whenever app/opengraph-image.tsx changes.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image?v=2`;
